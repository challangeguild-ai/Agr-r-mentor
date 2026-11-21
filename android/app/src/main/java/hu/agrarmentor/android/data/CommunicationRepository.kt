package hu.agrarmentor.android.data

import android.content.ContentResolver
import android.net.Uri
import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.time.Instant
import java.util.UUID

data class MobileNotification(
 val id:String,val title:String,val message:String,val kind:String,
 val href:String?,val createdAt:String,val readAt:String?
)
data class MobileMessage(
 val id:String,val title:String,val text:String,val status:String,
 val response:String?,val fieldId:String?,val createdAt:String,
 val category:String="other",val severity:String="normal",val attachments:List<ReportAttachment> = emptyList()
)
data class ReportMediaInput(val uri:Uri,val fileName:String,val mimeType:String,val sizeBytes:Long?){
 val key:String get()="${uri}|${fileName}|${mimeType}|${sizeBytes?:"unknown"}"
}
data class ReportAttachment(
 val reportId:String,val path:String,val fileName:String,val mimeType:String,val mediaType:String,val sizeBytes:Long?
)
data class ReportField(val id:String,val name:String,val farmId:String)
data class ReportCreateResult(val id:String,val warning:String?)
data class AdvisorReport(
 val id:String,val title:String,val message:String,val status:String,
 val fieldId:String,val fieldName:String,val farmId:String,val farmerId:String,
 val category:String,val severity:String,val createdAt:String,
 val updatedAt:String,val reply:String?,val attachments:List<ReportAttachment> = emptyList()
)
data class ReportDecisionResult(val alreadySaved:Boolean,val warnings:List<String>)
data class MobileDocument(
 val id:String,val title:String,val fileName:String,val category:String,
 val storagePath:String,val createdAt:String,val notes:String?
)
data class DocumentFarm(val id:String,val name:String)
data class DocumentField(val id:String,val name:String,val farmId:String)
data class DocumentScopes(val farms:List<DocumentFarm>,val fields:List<DocumentField>)
data class DocumentUploadInput(val uri:Uri,val fileName:String,val mimeType:String,val sizeBytes:Long?){
 val key:String get()="${uri}|${fileName}|${mimeType}|${sizeBytes?:"unknown"}"
}
data class MobileProfile(val name:String,val phone:String,val city:String,val jobTitle:String)

/** User-scoped PostgREST and Storage calls. Database RLS remains the authority. */
class CommunicationRepository(private val baseUrl:String,private val publishableKey:String){
 private data class PendingReport(
  val id:String,val fieldId:String,val title:String,val message:String,val category:String,val severity:String,
  val media:List<ReportMediaInput>,val uploaded:MutableMap<Int,String> = mutableMapOf(),val linked:MutableSet<Int> = mutableSetOf()
 )
 private var pendingReport:PendingReport?=null
 fun hasPendingReport():Boolean=pendingReport!=null
 private data class PendingDocument(
  val id:String,val path:String,val farmId:String,val fieldId:String?,val title:String,
  val category:String,val notes:String,val file:DocumentUploadInput,
  var uploaded:Boolean=false,var sizeBytes:Long?=null
 ) {
  fun sameAs(other:PendingDocument)=farmId==other.farmId&&fieldId==other.fieldId&&
   title==other.title&&category==other.category&&notes==other.notes&&file.key==other.file.key
 }
 private var pendingDocument:PendingDocument?=null
 fun hasPendingDocument():Boolean=pendingDocument!=null
 suspend fun notifications(session:AuthorizedSession):List<MobileNotification> = withContext(Dispatchers.IO){
  val user=uuid(session.userId)
  getArray("rest/v1/notifications?select=id,title,message,kind,href,created_at,read_at&user_id=eq.$user&order=created_at.desc&limit=100",session)
   .map{row->MobileNotification(row.getString("id"),row.optString("title"),row.optString("message"),row.optString("kind"),row.nullable("href"),row.optString("created_at"),row.nullable("read_at"))}
 }

 suspend fun markNotificationRead(session:AuthorizedSession,id:String) = withContext(Dispatchers.IO){
  request("PATCH","rest/v1/notifications?id=eq.${uuid(id)}&user_id=eq.${uuid(session.userId)}",session,JSONObject().put("read_at",Instant.now().toString()))
  Unit
 }

 suspend fun messages(session:AuthorizedSession):List<MobileMessage> = withContext(Dispatchers.IO){
  val rows=getArray("rest/v1/farmer_reports?select=id,title,message,status,advisor_reply,field_id,created_at,category,severity&farmer_id=eq.${uuid(session.userId)}&order=created_at.desc&limit=100",session)
  val media=reportAttachments(session)
  rows.map{row->MobileMessage(row.getString("id"),row.optString("title"),row.optString("message"),row.optString("status"),row.nullable("advisor_reply"),row.nullable("field_id"),row.optString("created_at"),row.optString("category","other"),row.optString("severity","normal"),media[row.getString("id")].orEmpty())}
 }

 suspend fun reportFields(session:AuthorizedSession):List<ReportField> = withContext(Dispatchers.IO){
  val owner=uuid(session.userId)
  val farmIds=getArray("rest/v1/farms?select=id&owner_id=eq.$owner&limit=1000",session).map{it.getString("id")}.toSet()
  if(farmIds.isEmpty())return@withContext emptyList()
  getArray("rest/v1/fields?select=id,name,farm_id&order=name.asc&limit=1000",session)
   .filter{it.optString("farm_id") in farmIds}
   .map{ReportField(it.getString("id"),it.optString("name","Földtábla"),it.getString("farm_id"))}
 }

 suspend fun createReport(session:AuthorizedSession,fieldId:String,title:String,message:String,category:String,severity:String,
  media:List<ReportMediaInput> = emptyList(),contentResolver:ContentResolver? = null):ReportCreateResult=withContext(Dispatchers.IO){
  require(ReportWorkflowRules.validDraft(title,message,category,severity)){"Ellenőrizd a tárgyat, a leírást, a kategóriát és a sürgősséget."}
  require(media.size<=ReportMediaRules.MAX_ITEMS){"Legfeljebb 10 csatolmány küldhető."}
  require(media.all{ReportMediaRules.valid(it.mimeType,it.sizeBytes)&&it.fileName.length in 1..255}){"Csak legfeljebb 50 MB-os JPG, PNG, WebP, MP4, WebM vagy MOV csatolható."}
  require(media.isEmpty()||contentResolver!=null){"A fájlok olvasása nem elérhető."}
  val validField=reportFields(session).find{it.id==uuid(fieldId)}?:error("Csak a saját gazdaságod földtáblájáról küldhetsz bejelentést.")
  val proposed=PendingReport(UUID.randomUUID().toString(),validField.id,title.trim(),message.trim(),category,severity,media)
  val pending=pendingReport
  if(pending!=null&&!ReportWorkflowRules.sameDraft(
   ReportDraftIdentity(pending.fieldId,pending.title,pending.message,pending.category,pending.severity,pending.media.map{it.key}),
   ReportDraftIdentity(proposed.fieldId,proposed.title,proposed.message,proposed.category,proposed.severity,proposed.media.map{it.key})))
   error("A korábbi bejelentés és mellékletek mentése még nem igazolható. Ugyanazzal a tartalommal próbáld újra.")
  val draft=pending?:proposed
  pendingReport=draft
  val body=JSONObject().put("id",draft.id).put("field_id",draft.fieldId)
   .put("farmer_id",session.userId).put("title",draft.title)
   .put("message",draft.message.ifBlank{null}).put("category",draft.category).put("severity",draft.severity)
  // The client-generated UUID enables a safe check after an uncertain network response.
  val existing=getArray("rest/v1/farmer_reports?select=id&id=eq.${draft.id}&farmer_id=eq.${uuid(session.userId)}&limit=1",session)
  if(existing.isEmpty()){
   try{request("POST","rest/v1/farmer_reports",session,body,"return=representation")}
   catch(e:Exception){
    val persisted=runCatching{getArray("rest/v1/farmer_reports?select=id&id=eq.${draft.id}&farmer_id=eq.${uuid(session.userId)}&limit=1",session)}.getOrDefault(emptyList())
    if(persisted.isEmpty())throw e
   }
  }
  for((index,file) in draft.media.withIndex()){
   if(index in draft.linked)continue
   val storedPath=draft.uploaded[index]?:"${session.userId}/${draft.id}/${UUID.randomUUID()}-${ReportMediaRules.safeName(file.fileName)}".also{
    draft.uploaded[index]=it
   }
   // Same report may already have other files: never count a foreign media row as ours.
   val hasLink=getArray("rest/v1/farmer_report_media?select=id,storage_path&report_id=eq.${draft.id}&limit=30",session)
    .any{it.optString("storage_path")==storedPath}
   if(!hasLink){
    val present=runCatching{storedObjectExists(session,storedPath)}.getOrDefault(false)
    if(!present)uploadReportMedia(session,contentResolver!!,file,storedPath)
    val row=JSONObject().put("report_id",draft.id).put("storage_path",storedPath)
     .put("file_name",file.fileName).put("media_type",ReportMediaRules.kind(file.mimeType))
     .put("mime_type",file.mimeType).put("size_bytes",file.sizeBytes?:JSONObject.NULL)
    try{request("POST","rest/v1/farmer_report_media",session,row)}
    catch(e:Exception){
     val verified=getArray("rest/v1/farmer_report_media?select=storage_path&report_id=eq.${draft.id}&limit=30",session)
      .any{it.optString("storage_path")==storedPath}
     if(!verified)throw e
    }
   }
   draft.linked.add(index)
  }
  pendingReport=null
  val warning=runCatching{
   val notice=JSONObject().put("p_kind","farmer_report")
    .put("p_title", "Új gazdálkodói bejelentés · ${severity.uppercase()}")
    .put("p_message","${validField.name} · ${draft.title}")
    .put("p_href","/admin/reports?view=new")
    .put("p_event_key","report:${draft.id}:created")
   val result=JSONArray(request("POST","rest/v1/rpc/notify_advisors",session,notice))
   if(result.length()==0)"A bejelentés rögzítve, de az értesítés átvétele nem igazolható." else null
  }.getOrElse{"A bejelentés rögzítve, de az értesítés nem igazolható. Ne küldd be ismét."}
  ReportCreateResult(draft.id,warning)
 }

 suspend fun advisorReports(session:AuthorizedSession):List<AdvisorReport> = withContext(Dispatchers.IO){
  require(session.role==hu.agrarmentor.android.model.PortalRole.ADVISOR)
  val farms=getArray("rest/v1/farms?select=id,owner_id&limit=1000",session).associateBy{it.getString("id")}
  val fields=getArray("rest/v1/fields?select=id,name,farm_id&limit=1000",session).associateBy{it.getString("id")}
  val media=reportAttachments(session)
  getArray("rest/v1/farmer_reports?select=id,title,message,status,field_id,farmer_id,category,severity,created_at,updated_at,advisor_reply&order=created_at.desc&limit=250",session).mapNotNull{r->
   val field=fields[r.optString("field_id")]?:return@mapNotNull null
   val farmId=field.optString("farm_id");val owner=farms[farmId]?.optString("owner_id")
   if(owner!=r.optString("farmer_id"))return@mapNotNull null
   AdvisorReport(r.getString("id"),r.optString("title"),r.optString("message"),r.optString("status"),
    field.getString("id"),field.optString("name","Földtábla"),farmId,r.getString("farmer_id"),
    r.optString("category","other"),r.optString("severity","normal"),r.optString("created_at"),
    r.optString("updated_at"),r.nullable("advisor_reply"),media[r.getString("id")].orEmpty())
  }
 }

 private fun reportAttachments(session:AuthorizedSession):Map<String,List<ReportAttachment>> =
  getArray("rest/v1/farmer_report_media?select=report_id,storage_path,file_name,media_type,mime_type,size_bytes&order=created_at.asc&limit=1000",session)
   .map{row->ReportAttachment(row.getString("report_id"),row.getString("storage_path"),row.optString("file_name"),
    row.optString("mime_type"),row.optString("media_type"),if(row.isNull("size_bytes"))null else row.optLong("size_bytes"))}
   .groupBy{it.reportId}

 suspend fun signedReportAttachmentUrl(session:AuthorizedSession,file:ReportAttachment):String=withContext(Dispatchers.IO){
  uuid(file.reportId)
  val allowed=getArray("rest/v1/farmer_report_media?select=storage_path&report_id=eq.${file.reportId}&limit=30",session)
   .any{it.optString("storage_path")==file.path}
  require(allowed){"Nincs jogosultság a csatolmányhoz."}
  signedReportStorageUrl(session,file.path)
 }

 private fun signedReportStorageUrl(session:AuthorizedSession,path:String):String{
  val pieces=path.split('/')
  require(pieces.size>=3&&pieces.all{it.isNotBlank()&&it!="."&&it!=".."})
  val encoded=pieces.joinToString("/"){URLEncoder.encode(it,"UTF-8").replace("+","%20")}
  val result=JSONObject(request("POST","storage/v1/object/sign/farmer-report-media/$encoded",session,JSONObject().put("expiresIn",60)))
  val signed=result.optString("signedURL").ifBlank{result.optString("signedUrl")}.trimStart('/')
  require(signed.startsWith("object/sign/farmer-report-media/")||signed.startsWith("storage/v1/object/sign/farmer-report-media/"))
  return "${baseUrl.trimEnd('/')}/${if(signed.startsWith("storage/v1/"))signed else "storage/v1/$signed"}"
 }

 private fun storedObjectExists(session:AuthorizedSession,path:String):Boolean{
  val url=signedReportStorageUrl(session,path)
  val conn=(URL(url).openConnection() as HttpURLConnection).apply{
   requestMethod="HEAD";connectTimeout=10000;readTimeout=10000
  }
  return try{conn.responseCode in 200..299}finally{conn.disconnect()}
 }

 private fun uploadReportMedia(session:AuthorizedSession,resolver:ContentResolver,file:ReportMediaInput,path:String){
  val uriPath=path.split('/').joinToString("/"){URLEncoder.encode(it,"UTF-8").replace("+","%20")}
  val connection=(URL("${baseUrl.trimEnd('/')}/storage/v1/object/farmer-report-media/$uriPath").openConnection() as HttpURLConnection).apply{
   requestMethod="POST";connectTimeout=15000;readTimeout=60000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
   setRequestProperty("Content-Type",file.mimeType)
   setRequestProperty("x-upsert","false")
   doOutput=true;setChunkedStreamingMode(64*1024)
  }
  try{
   var total=0L
   val source=resolver.openInputStream(file.uri)?:error("A csatolmány nem olvasható.")
   source.use{input->connection.outputStream.use{output->
    val buffer=ByteArray(64*1024)
    while(true){
     val count=input.read(buffer)
     if(count<0)break
     total+=count
     require(total<=ReportMediaRules.MAX_BYTES){"A fájl 50 MB-nál nagyobb."}
     output.write(buffer,0,count)
    }
   }}
   require(total>0){"Üres fájl nem csatolható."}
   if(connection.responseCode !in 200..299)error("A csatolmány feltöltése sikertelen (${connection.responseCode}).")
  }finally{connection.disconnect()}
 }

 suspend fun decideReport(session:AuthorizedSession,report:AdvisorReport,reply:String,close:Boolean):ReportDecisionResult=withContext(Dispatchers.IO){
  require(session.role==hu.agrarmentor.android.model.PortalRole.ADVISOR)
  require(uuid(report.id).isNotBlank()&&uuid(report.fieldId).isNotBlank()&&uuid(report.farmerId).isNotBlank())
  require(ReportWorkflowRules.canRespond(report.status,close,reply)){"A bejelentés már lezárt, vagy érvénytelen a válasz."}
  val original=getArray("rest/v1/farmer_reports?select=id,status,advisor_reply,updated_at,farmer_id,field_id&id=eq.${report.id}&limit=1",session).singleOrNull()
   ?:error("A bejelentés nem található.")
  require(original.optString("farmer_id")==report.farmerId&&original.optString("field_id")==report.fieldId)
  if(original.optString("status")=="closed"&&close)return@withContext ReportDecisionResult(true,emptyList())
  if(original.optString("status")=="closed")error("Lezárt bejelentésre nem válaszolhatsz.")
  if(!close&&original.optString("status")=="reviewed"&&original.optString("advisor_reply")==reply.trim())
   return@withContext ReportDecisionResult(true,emptyList())
  require(original.optString("updated_at")==report.updatedAt){"A bejelentés időközben módosult. Frissítsd a listát."}
  val now=Instant.now().toString()
  val changes=if(close)JSONObject().put("status","closed").put("closed_at",now).put("updated_at",now)
   else JSONObject().put("status","reviewed").put("advisor_reply",reply.trim()).put("replied_by",session.userId)
    .put("replied_at",now).put("updated_at",now)
  val timestamp=java.net.URLEncoder.encode(report.updatedAt,"UTF-8")
  val response=request("PATCH","rest/v1/farmer_reports?id=eq.${report.id}&status=neq.closed&updated_at=eq.$timestamp",session,changes,"return=representation")
  if(JSONArray(response).length()!=1)error("A bejelentés időközben módosult. Frissítsd a listát.")

  val warnings=mutableListOf<String>()
  val eventKind=if(close)"report_closed"else"advisor_reply"
  val title=if(close)"Bejelentés lezárva"else"Szaktanácsadói válasz"
  runCatching{
   request("POST","rest/v1/timeline_events",session,JSONObject()
    .put("farm_id",report.farmId).put("field_id",report.fieldId).put("event_type",eventKind)
    .put("title",title).put("description",if(close)report.title else reply.trim())
    .put("event_at",now).put("created_by",session.userId).put("source_id",report.id))
  }.onFailure{warnings.add("Az idővonal frissítése nem igazolható.")}
  runCatching{
   request("POST","rest/v1/notifications",session,JSONObject().put("user_id",report.farmerId)
    .put("kind",eventKind).put("title",if(close)"Bejelentés lezárva"else"Szaktanácsadói válasz érkezett")
    .put("message",report.title).put("href","/fields/${report.fieldId}")
    .put("event_key","report:${report.id}:${if(close)"closed"else"reply"}"))
  }.onFailure{warnings.add("A gazdálkodói értesítés nem igazolható.")}
  ReportDecisionResult(false,warnings)
 }

 suspend fun documents(session:AuthorizedSession):List<MobileDocument> = withContext(Dispatchers.IO){
  getArray("rest/v1/documents?select=id,title,file_name,category,storage_path,created_at,notes&order=created_at.desc&limit=100",session)
   .map{row->MobileDocument(row.getString("id"),row.optString("title"),row.optString("file_name"),row.optString("category"),row.optString("storage_path"),row.optString("created_at"),row.nullable("notes"))}
 }

 /** Farmers see owned farms, advisors see RLS-authorized farms; Storage/REST validate on write. */
 suspend fun documentScopes(session:AuthorizedSession):DocumentScopes=withContext(Dispatchers.IO){
  require(DocumentUploadRules.canUpload(session.role))
  val farmsPath=if(session.role==PortalRole.FARMER){
   "rest/v1/farms?select=id,name&owner_id=eq.${uuid(session.userId)}&order=name.asc&limit=1000"
  }else "rest/v1/farms?select=id,name&order=name.asc&limit=1000"
  val farms=getArray(farmsPath,session)
   .map{DocumentFarm(it.getString("id"),it.optString("name","Gazdaság"))}
  val accessible=farms.map{it.id}.toSet()
  val fields=if(accessible.isEmpty())emptyList() else
   getArray("rest/v1/fields?select=id,name,farm_id&order=name.asc&limit=1000",session)
    .filter{it.optString("farm_id") in accessible}
    .map{DocumentField(it.getString("id"),it.optString("name","Földtábla"),it.getString("farm_id"))}
  DocumentScopes(farms,fields)
 }

 suspend fun uploadDocument(session:AuthorizedSession,resolver:ContentResolver,farmId:String,fieldId:String?,
  title:String,category:String,notes:String,file:DocumentUploadInput):String=withContext(Dispatchers.IO){
  require(DocumentUploadRules.canUpload(session.role))
  require(DocumentUploadRules.validFile(file.mimeType,file.sizeBytes)&&file.fileName.length in 1..DocumentUploadRules.MAX_NAME){
   "PDF, JPG, PNG, WebP, DOC vagy DOCX fájl tölthető fel, legfeljebb 20 MB méretben."
  }
  require(DocumentUploadRules.validDetails(title,notes,category)){
   "Ellenőrizd a megnevezést, kategóriát és megjegyzést."
  }
  val scopes=documentScopes(session)
  val ownedFarm=scopes.farms.find{it.id==uuid(farmId)}?:error("Csak az elérhető gazdasághoz tölthetsz fel dokumentumot.")
  val field=fieldId?.let{id->scopes.fields.find{it.id==uuid(id)&&it.farmId==ownedFarm.id}
   ?:error("A földtábla nem ehhez a gazdasághoz tartozik.")}
  val newDocument=PendingDocument(UUID.randomUUID().toString(),
   "${session.userId}/${UUID.randomUUID()}-${DocumentUploadRules.safeName(file.fileName)}",
   ownedFarm.id,field?.id,title.trim(),category,notes.trim(),file)
  val previous=pendingDocument
  if(previous!=null&&!previous.sameAs(newDocument))
   error("A korábbi fájl feltöltésének eredménye nem egyértelmű. Ugyanazzal a dokumentummal próbáld újra.")
  val draft=previous?:newDocument
  pendingDocument=draft
  val found=getArray("rest/v1/documents?select=id,storage_path&id=eq.${draft.id}&limit=1",session)
  if(found.isEmpty()){
   if(!draft.uploaded){
    val size=uploadDocumentObject(session,resolver,draft)
    draft.uploaded=true
    draft.sizeBytes=size
   }
   val body=JSONObject().put("id",draft.id).put("uploaded_by",session.userId)
    .put("farm_id",draft.farmId).put("field_id",draft.fieldId?:JSONObject.NULL)
    .put("title",draft.title).put("category",draft.category).put("notes",draft.notes.ifBlank{null})
    .put("storage_path",draft.path).put("file_name",draft.file.fileName)
    .put("media_type",draft.file.mimeType).put("file_size",draft.sizeBytes?:draft.file.sizeBytes)
   try{request("POST","rest/v1/documents",session,body)}
   catch(e:Exception){
    val saved=runCatching{getArray("rest/v1/documents?select=id,storage_path&id=eq.${draft.id}&limit=1",session)}
     .getOrDefault(emptyList())
    if(saved.singleOrNull()?.optString("storage_path")!=draft.path)throw e
   }
  }else require(found.single().optString("storage_path")==draft.path){"A dokumentum azonosítója ütközik."}
  val confirmed=getArray("rest/v1/documents?select=id,storage_path&id=eq.${draft.id}&limit=1",session)
  require(confirmed.singleOrNull()?.optString("storage_path")==draft.path){"A dokumentum mentése nem igazolható."}
  pendingDocument=null
  draft.id
 }

 private fun uploadDocumentObject(session:AuthorizedSession,resolver:ContentResolver,draft:PendingDocument):Long{
  val encoded=draft.path.split('/').joinToString("/"){URLEncoder.encode(it,"UTF-8").replace("+","%20")}
  val conn=(URL("${baseUrl.trimEnd('/')}/storage/v1/object/documents/$encoded").openConnection() as HttpURLConnection).apply{
   requestMethod="POST";connectTimeout=15000;readTimeout=60000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
   setRequestProperty("Content-Type",draft.file.mimeType)
   setRequestProperty("x-upsert","false")
   doOutput=true
   if(draft.file.sizeBytes!=null)setFixedLengthStreamingMode(draft.file.sizeBytes) else setChunkedStreamingMode(64*1024)
  }
  try{
   var size=0L
   val input=resolver.openInputStream(draft.file.uri)?:error("A kiválasztott dokumentum nem olvasható.")
   input.use{source->conn.outputStream.use{target->
    val buffer=ByteArray(64*1024)
    while(true){
     val read=source.read(buffer)
     if(read<0)break
     size+=read
     require(size<=DocumentUploadRules.MAX_BYTES){"A dokumentum meghaladja a 20 MB-ot."}
     target.write(buffer,0,read)
    }
   }}
   require(size>0){"Üres dokumentum nem tölthető fel."}
   draft.sizeBytes=size
   val status=conn.responseCode
   // An uncertain previous POST may have saved this unique object before the connection failed.
   if(status==409&&pendingDocument===draft)return size
   if(status !in 200..299)error("A feltöltés sikertelen ($status).")
   return size
  }finally{conn.disconnect()}
 }

 /** The signed download URL is valid for one minute and never cached on disk. */
 suspend fun signedDocumentUrl(session:AuthorizedSession,storagePath:String):String = withContext(Dispatchers.IO){
  val relative=storagePath.split('/').also{segments->
   require(segments.isNotEmpty()&&segments.all{it.isNotBlank()&&it!="."&&it!=".."})
  }.joinToString("/"){URLEncoder.encode(it,"UTF-8").replace("+","%20")}
  val response=JSONObject(request("POST","storage/v1/object/sign/documents/$relative",session,JSONObject().put("expiresIn",60)))
  val signed=response.optString("signedURL").ifBlank{response.optString("signedUrl")}
  val path=signed.trimStart('/')
  require(path.startsWith("object/sign/documents/")||path.startsWith("storage/v1/object/sign/documents/"))
  "${baseUrl.trimEnd('/')}/${if(path.startsWith("storage/v1/"))path else "storage/v1/$path"}"
 }

 suspend fun profile(session:AuthorizedSession):MobileProfile = withContext(Dispatchers.IO){
  val row=getArray("rest/v1/profiles?select=full_name,phone,city,job_title&id=eq.${uuid(session.userId)}&limit=1",session).firstOrNull()
   ?:error("A profil nem hozzáférhető.")
  MobileProfile(row.optString("full_name"),row.optString("phone"),row.optString("city"),row.optString("job_title"))
 }

 suspend fun updateProfile(session:AuthorizedSession,profile:MobileProfile) = withContext(Dispatchers.IO){
  require(profile.name.trim().length in 2..120)
  require(profile.phone.length<=40&&profile.city.length<=120&&profile.jobTitle.length<=120)
  val body=JSONObject().put("full_name",profile.name.trim())
   .put("phone",profile.phone.trim()).put("city",profile.city.trim()).put("job_title",profile.jobTitle.trim())
  request("PATCH","rest/v1/profiles?id=eq.${uuid(session.userId)}",session,body)
  Unit
 }

 private fun getArray(path:String,session:AuthorizedSession):List<JSONObject>{
  val rows=JSONArray(request("GET",path,session,null))
  return (0 until rows.length()).map{rows.getJSONObject(it)}
 }

 private fun request(method:String,path:String,session:AuthorizedSession,body:JSONObject?,prefer:String?=null):String{
  require(baseUrl.startsWith("https://")&&publishableKey.isNotBlank())
  val connection=(URL("${baseUrl.trimEnd('/')}/$path").openConnection() as HttpURLConnection).apply{
   requestMethod=method
   connectTimeout=12000
   readTimeout=12000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
   setRequestProperty("Content-Type","application/json")
   if(prefer!=null)setRequestProperty("Prefer",prefer)
   if(body!=null){doOutput=true;outputStream.use{it.write(body.toString().toByteArray(Charsets.UTF_8))}}
  }
  return try{
   if(connection.responseCode !in 200..299)error("Szerverhiba (${connection.responseCode}).")
   connection.inputStream.bufferedReader().use{it.readText()}
  }finally{connection.disconnect()}
 }

 private fun uuid(value:String):String{
  require(value.matches(Regex("[a-fA-F0-9-]{36}"))){"Érvénytelen azonosító."}
  return value
 }

 private fun JSONObject.nullable(key:String):String?=if(isNull(key))null else optString(key).ifBlank{null}
}
