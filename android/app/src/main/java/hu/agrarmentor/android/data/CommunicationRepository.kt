package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.time.Instant

data class MobileNotification(
 val id:String,val title:String,val message:String,val kind:String,
 val href:String?,val createdAt:String,val readAt:String?
)
data class MobileMessage(
 val id:String,val title:String,val text:String,val status:String,
 val response:String?,val fieldId:String?,val createdAt:String,
 val category:String="other",val severity:String="normal"
)
data class ReportField(val id:String,val name:String,val farmId:String)
data class ReportCreateResult(val id:String,val warning:String?)
data class AdvisorReport(
 val id:String,val title:String,val message:String,val status:String,
 val fieldId:String,val fieldName:String,val farmId:String,val farmerId:String,
 val category:String,val severity:String,val createdAt:String,
 val updatedAt:String,val reply:String?
)
data class ReportDecisionResult(val alreadySaved:Boolean,val warnings:List<String>)
data class MobileDocument(
 val id:String,val title:String,val fileName:String,val category:String,
 val storagePath:String,val createdAt:String,val notes:String?
)
data class MobileProfile(val name:String,val phone:String,val city:String,val jobTitle:String)

/** User-scoped PostgREST and Storage calls. Database RLS remains the authority. */
class CommunicationRepository(private val baseUrl:String,private val publishableKey:String){
 private data class PendingReport(val id:String,val fieldId:String,val title:String,val message:String,val category:String,val severity:String)
 private var pendingReport:PendingReport?=null
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
  getArray("rest/v1/farmer_reports?select=id,title,message,status,advisor_reply,field_id,created_at,category,severity&farmer_id=eq.${uuid(session.userId)}&order=created_at.desc&limit=100",session)
   .map{row->MobileMessage(row.getString("id"),row.optString("title"),row.optString("message"),row.optString("status"),row.nullable("advisor_reply"),row.nullable("field_id"),row.optString("created_at"),row.optString("category","other"),row.optString("severity","normal"))}
 }

 suspend fun reportFields(session:AuthorizedSession):List<ReportField> = withContext(Dispatchers.IO){
  val owner=uuid(session.userId)
  val farmIds=getArray("rest/v1/farms?select=id&owner_id=eq.$owner&limit=1000",session).map{it.getString("id")}.toSet()
  if(farmIds.isEmpty())return@withContext emptyList()
  getArray("rest/v1/fields?select=id,name,farm_id&order=name.asc&limit=1000",session)
   .filter{it.optString("farm_id") in farmIds}
   .map{ReportField(it.getString("id"),it.optString("name","Földtábla"),it.getString("farm_id"))}
 }

 suspend fun createReport(session:AuthorizedSession,fieldId:String,title:String,message:String,category:String,severity:String):ReportCreateResult=withContext(Dispatchers.IO){
  require(ReportWorkflowRules.validDraft(title,message,category,severity)){"Ellenőrizd a tárgyat, a leírást, a kategóriát és a sürgősséget."}
  val validField=reportFields(session).find{it.id==uuid(fieldId)}?:error("Csak a saját gazdaságod földtáblájáról küldhetsz bejelentést.")
  val proposed=PendingReport(java.util.UUID.randomUUID().toString(),validField.id,title.trim(),message.trim(),category,severity)
  val pending=pendingReport
  if(pending!=null&&!ReportWorkflowRules.sameDraft(
   ReportDraftIdentity(pending.fieldId,pending.title,pending.message,pending.category,pending.severity),
   ReportDraftIdentity(proposed.fieldId,proposed.title,proposed.message,proposed.category,proposed.severity)))
   error("A korábbi bejelentés mentése még nem igazolható. Ugyanazzal a szöveggel próbáld újra.")
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
  getArray("rest/v1/farmer_reports?select=id,title,message,status,field_id,farmer_id,category,severity,created_at,updated_at,advisor_reply&order=created_at.desc&limit=250",session).mapNotNull{r->
   val field=fields[r.optString("field_id")]?:return@mapNotNull null
   val farmId=field.optString("farm_id");val owner=farms[farmId]?.optString("owner_id")
   if(owner!=r.optString("farmer_id"))return@mapNotNull null
   AdvisorReport(r.getString("id"),r.optString("title"),r.optString("message"),r.optString("status"),
    field.getString("id"),field.optString("name","Földtábla"),farmId,r.getString("farmer_id"),
    r.optString("category","other"),r.optString("severity","normal"),r.optString("created_at"),
    r.optString("updated_at"),r.nullable("advisor_reply"))
  }
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
