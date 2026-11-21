package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.util.UUID

data class AdvisorFieldWorkFarm(val id:String,val name:String)
data class AdvisorFieldWorkField(val id:String,val farmId:String,val name:String)
data class AdvisorFieldWorkScopes(val farms:List<AdvisorFieldWorkFarm>,val fields:List<AdvisorFieldWorkField>)

data class AdvisorInspectionInput(
 val fieldId:String,val date:String,val condition:String,val notes:String,val recommendation:String,
 val followUp:String="",val issueStatus:String="open",val nextCheck:String=""
)
data class AdvisorVisitInput(val farmId:String,val fieldId:String?,val localDate:String,val localTime:String,val purpose:String,val note:String)
data class AdvisorWorkSave(val id:String,val warnings:List<String> = emptyList())
data class AdvisorVisitData(val scheduledAt:String,val purpose:String,val note:String,val status:String,val completedAt:String?)

private val advisorUuid=Regex("[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}")
private val budapest=ZoneId.of("Europe/Budapest")

internal fun validAdvisorInspection(input:AdvisorInspectionInput){
 require(input.fieldId.matches(advisorUuid)){"Érvénytelen földtábla."}
 require(input.condition in setOf("good","attention","critical")){"Válassz érvényes szemleállapotot."}
 require(input.followUp in setOf("","improved","unchanged","worsened")){"Érvénytelen visszaellenőrzés."}
 require(input.issueStatus in setOf("open","monitoring","resolved")){"Érvénytelen problémaállapot."}
 val date=LocalDate.parse(input.date)
 require(!date.isAfter(LocalDate.now(budapest))){"A szemle dátuma nem lehet jövőbeli."}
 if(input.nextCheck.isNotBlank())LocalDate.parse(input.nextCheck)
 require(input.notes.trim().length<=5000&&input.recommendation.trim().length<=5000){"Túl hosszú szemleszöveg."}
}

/** Date/time conversion rejects Hungary's missing and ambiguous DST clock hours. */
internal fun advisorVisitInstant(date:String,time:String):Instant{
 val local=LocalDateTime.parse("${LocalDate.parse(date)}T$time")
 val offsets=budapest.rules.getValidOffsets(local)
 require(offsets.size==1){"Ebben az óraállítási időpontban adj meg egyértelmű időt."}
 return local.atOffset(offsets.single()).toInstant()
}

internal fun validAdvisorVisit(input:AdvisorVisitInput){
 require(input.farmId.matches(advisorUuid)){"Érvénytelen gazdaság."}
 require(input.fieldId==null||input.fieldId.matches(advisorUuid)){"Érvénytelen földtábla."}
 advisorVisitInstant(input.localDate,input.localTime)
 require(input.purpose.trim().length in 1..180&&input.note.trim().length<=3000){"Látogatási cél kötelező, megjegyzés legfeljebb 3000 karakter."}
}

internal fun encodeMobileAdvisorVisit(value:AdvisorVisitData):String="ADVISORVISIT:"+JSONObject()
 .put("scheduledAt",value.scheduledAt).put("purpose",value.purpose)
 .put("note",value.note.takeIf{it.isNotBlank()}?:JSONObject.NULL).put("status",value.status)
 .put("completedAt",value.completedAt?:JSONObject.NULL).toString()

internal fun decodeMobileAdvisorVisit(raw:String?):AdvisorVisitData?=runCatching{
 if(raw?.startsWith("ADVISORVISIT:")!=true)null else {
 val row=JSONObject(raw.removePrefix("ADVISORVISIT:"))
 val scheduled=Instant.parse(row.getString("scheduledAt"))
 val status=row.optString("status","planned").takeIf{it in setOf("planned","completed","cancelled")}?:"planned"
 AdvisorVisitData(scheduled.toString(),row.optString("purpose","Helyszíni szaktanácsadás"),
  if(row.isNull("note"))"" else row.optString("note"),status,
  if(row.isNull("completedAt"))null else row.optString("completedAt"))
 }
}.getOrNull()

/** Creates only base inspections and visits. Advanced media, mail and task actions stay in web UI. */
class AdvisorFieldWorkRepository(private val baseUrl:String,private val publishableKey:String){
 suspend fun scopes(session:AuthorizedSession):AdvisorFieldWorkScopes=withContext(Dispatchers.IO){
  advisorOnly(session)
  val farms=read("farms?select=id,name&order=name.asc&limit=1000",session)
   .map{AdvisorFieldWorkFarm(it.getString("id"),it.optString("name","Gazdaság"))}
  val ids=farms.map{it.id}.toSet()
  val fields=read("fields?select=id,farm_id,name&order=name.asc&limit=1000",session)
   .filter{it.optString("farm_id") in ids}
   .map{AdvisorFieldWorkField(it.getString("id"),it.getString("farm_id"),it.optString("name","Földtábla"))}
  AdvisorFieldWorkScopes(farms,fields)
 }

 suspend fun createInspection(session:AuthorizedSession,input:AdvisorInspectionInput,id:String,eventId:String):AdvisorWorkSave=withContext(Dispatchers.IO){
  advisorOnly(session);validAdvisorInspection(input)
  require(id.matches(advisorUuid)&&eventId.matches(advisorUuid)){"Érvénytelen mentésazonosító."}
  val field=read("fields?select=id,farm_id&id=eq.${input.fieldId}&limit=1",session).singleOrNull()
   ?:error("A földtábla nem hozzáférhető.")
  val farmId=field.getString("farm_id")
  val storedBefore=read("inspections?select=id,field_id,advisor_id,condition,notes,recommendation,follow_up_status,issue_status,next_check_at,inspected_at,previous_inspection_id&id=eq.$id&limit=1",session).singleOrNull()
  val previous=if(storedBefore==null)read("inspections?select=id&field_id=eq.${input.fieldId}&order=inspected_at.desc&limit=1",session).singleOrNull() else null
  val whenAt=LocalDate.parse(input.date).atTime(12,0).atZone(budapest).toOffsetDateTime().toString()
  val body=JSONObject().put("id",id).put("field_id",input.fieldId).put("advisor_id",session.userId)
   .put("inspected_at",whenAt).put("condition",input.condition)
   .put("notes",input.notes.trim().takeIf{it.isNotBlank()}?:JSONObject.NULL)
   .put("recommendation",input.recommendation.trim().takeIf{it.isNotBlank()}?:JSONObject.NULL)
   .put("follow_up_status",input.followUp.takeIf{it.isNotBlank()}?:JSONObject.NULL)
   .put("previous_inspection_id",previous?.optString("id")?:JSONObject.NULL)
   .put("next_check_at",input.nextCheck.takeIf{it.isNotBlank()}?:JSONObject.NULL).put("issue_status",input.issueStatus)
   .put("closed_at",if(input.issueStatus=="resolved")Instant.now().toString() else JSONObject.NULL)
   .put("problem_markers",JSONArray())
  var warning:String?=null
  if(storedBefore==null)try{request("POST","inspections?on_conflict=id",session,body,"resolution=ignore-duplicates,return=minimal")}
   catch(e:CancellationException){throw e}
   catch(_:Exception){warning="A kapcsolat megszakadt. A szemle szerveroldali mentését külön ellenőriztem."}
  val saved=read("inspections?select=id,field_id,advisor_id,condition,notes,recommendation,follow_up_status,issue_status,next_check_at,inspected_at,previous_inspection_id&id=eq.$id&limit=1",session).singleOrNull()
  check(saved!=null&&saved.optString("field_id")==input.fieldId&&saved.optString("advisor_id")==session.userId&&
   saved.optString("condition")==input.condition&&saved.textOrEmpty("notes")==input.notes.trim()&&
   saved.textOrEmpty("recommendation")==input.recommendation.trim()&&saved.optString("issue_status")==input.issueStatus&&
   saved.textOrEmpty("follow_up_status")==input.followUp&&saved.textOrEmpty("next_check_at")==input.nextCheck&&
   runCatching{OffsetDateTime.parse(saved.getString("inspected_at")).toLocalDate()==LocalDate.parse(input.date)}.getOrDefault(false)){
   "A szemle mentése nem igazolható; ellenőrizd a listát."
  }
  val followUp=saved.textOrEmpty("previous_inspection_id").isNotBlank()
  val description=listOfNotNull(input.recommendation.trim().takeIf{it.isNotBlank()}?.let{"Javaslat: $it"},
   input.followUp.takeIf{it.isNotBlank()}?.let{"Visszaellenőrzés: $it"},
   input.nextCheck.takeIf{it.isNotBlank()}?.let{"Következő ellenőrzés: $it"}).joinToString(" · ")
  val eventBody=JSONObject().put("id",eventId).put("farm_id",farmId).put("field_id",input.fieldId)
   .put("event_type",if(followUp)"inspection_followup" else "inspection")
   .put("title",if(followUp)"Visszaellenőrző táblaszemle" else "Táblaszemle")
   .put("description",description.takeIf{it.isNotBlank()}?:JSONObject.NULL).put("event_at",whenAt)
   .put("created_by",session.userId).put("source_id",id)
  val warnings=mutableListOf<String>()
  if(warning!=null)warnings.add(warning)
  try{request("POST","timeline_events?on_conflict=id",session,eventBody,"resolution=ignore-duplicates,return=minimal")}
  catch(e:CancellationException){throw e}
  catch(_:Exception){warnings.add("Az idővonalesemény nem menthető vagy nem ellenőrizhető.")}
  val eventVerified=runCatching{
   read("timeline_events?select=id,source_id,event_type,field_id,created_by&id=eq.$eventId&limit=1",session).singleOrNull()?.let{
    it.optString("source_id")==id&&it.optString("field_id")==input.fieldId&&it.optString("created_by")==session.userId&&
     it.optString("event_type")== (if(followUp)"inspection_followup" else "inspection")
   }==true
  }.getOrDefault(false)
  if(eventVerified)warnings.removeAll{it.startsWith("Az idővonalesemény")}
  else if(!warnings.any{it.startsWith("Az idővonalesemény")})warnings.add("Az idővonalesemény mentése nem igazolható.")
  AdvisorWorkSave(id,warnings)
 }

 suspend fun createVisit(session:AuthorizedSession,input:AdvisorVisitInput,eventId:String):AdvisorWorkSave=withContext(Dispatchers.IO){
  advisorOnly(session);validAdvisorVisit(input);require(eventId.matches(advisorUuid)){"Érvénytelen mentésazonosító."}
  val farm=read("farms?select=id&id=eq.${input.farmId}&limit=1",session).singleOrNull()?:error("A gazdaság nem érhető el.")
  if(input.fieldId!=null)check(read("fields?select=id&farm_id=eq.${farm.getString("id")}&id=eq.${input.fieldId}&limit=1",session).size==1){"A földtábla nem ehhez a gazdasághoz tartozik."}
  val time=advisorVisitInstant(input.localDate,input.localTime).toString()
  val payload=encodeMobileAdvisorVisit(AdvisorVisitData(time,input.purpose.trim(),input.note.trim(),"planned",null))
  val body=JSONObject().put("id",eventId).put("farm_id",input.farmId)
   .put("field_id",input.fieldId?:JSONObject.NULL).put("event_type","advisor_visit_plan")
   .put("title","Tervezett látogatás: ${input.purpose.trim()}").put("description",payload)
   .put("event_at",time).put("created_by",session.userId)
  var disconnected=false
  try{request("POST","timeline_events?on_conflict=id",session,body,"resolution=ignore-duplicates,return=minimal")}
  catch(e:CancellationException){throw e}
  catch(_:Exception){disconnected=true}
  val saved=read("timeline_events?select=id,farm_id,field_id,event_type,description,created_by&id=eq.$eventId&limit=1",session).singleOrNull()
  check(saved!=null&&saved.optString("farm_id")==input.farmId&&saved.textOrEmpty("field_id")==input.fieldId.orEmpty()&&
   saved.optString("created_by")==session.userId&&saved.optString("event_type")=="advisor_visit_plan"&&
   saved.optString("description")==payload){"A látogatás mentése nem igazolható; ellenőrizd a listát."}
  AdvisorWorkSave(eventId,if(disconnected)listOf("A hálózati válasz megszakadt, de a látogatás mentését igazoltam.")else emptyList())
 }

 /** Compare-and-swap on the original description; a changed visit cannot be overwritten blindly. */
 suspend fun updateVisit(session:AuthorizedSession,id:String,expected:String,status:String):Unit=withContext(Dispatchers.IO){
  advisorOnly(session);require(id.matches(advisorUuid)&&status in setOf("completed","cancelled"))
  val old=decodeMobileAdvisorVisit(expected)?:error("Érvénytelen látogatási adat.")
  val current=read("timeline_events?select=id,created_by,event_type,description&id=eq.$id&limit=1",session).singleOrNull()
   ?:error("A látogatás nem található.")
  check(current.optString("created_by")==session.userId&&current.optString("event_type")=="advisor_visit_plan"){"Nem a saját látogatásod."}
  val currentValue=decodeMobileAdvisorVisit(current.optString("description"))?:error("A látogatás adatai sérültek.")
  if(currentValue.status==status)return@withContext
  check(current.optString("description")==expected&&old.status=="planned"&&currentValue.status=="planned"){
   "A látogatás közben megváltozott; frissítsd az adatokat."
  }
  val updated=encodeMobileAdvisorVisit(currentValue.copy(status=status,completedAt=if(status=="completed")Instant.now().toString() else null))
  val body=JSONObject().put("description",updated).put("title","${if(status=="completed")"Elvégzett" else "Lemondott"} látogatás: ${currentValue.purpose}")
  val encoded=java.net.URLEncoder.encode("\"${expected.replace("\\","\\\\").replace("\"","\\\"")}\"","UTF-8")
  try{request("PATCH","timeline_events?id=eq.$id&created_by=eq.${session.userId}&description=eq.$encoded",session,body,"return=representation")}
  catch(e:CancellationException){throw e}
  catch(_:Exception){/* Verify the stored state after a lost HTTP response. */}
  val saved=read("timeline_events?select=id,created_by,description&id=eq.$id&limit=1",session).singleOrNull()
  check(saved!=null&&saved.optString("created_by")==session.userId&&decodeMobileAdvisorVisit(saved.optString("description"))?.status==status){
   "A látogatás állapotváltozása nem igazolható; frissítsd a listát."
  }
 }

 private fun advisorOnly(session:AuthorizedSession){
  require(session.role==PortalRole.ADVISOR&&session.userId.matches(advisorUuid)){"Szaktanácsadói jogosultság szükséges."}
 }

 private fun JSONObject.textOrEmpty(name:String):String=if(isNull(name))"" else optString(name)

 private fun read(path:String,session:AuthorizedSession):List<JSONObject>{
  val body=request("GET",path,session,null,null)
  val rows=JSONArray(body)
  return (0 until rows.length()).map{rows.getJSONObject(it)}
 }

 private fun request(method:String,path:String,session:AuthorizedSession,body:JSONObject?,prefer:String?):String{
  val conn=(URL("${baseUrl.trimEnd('/')}/rest/v1/$path").openConnection() as HttpURLConnection).apply{
   requestMethod=method;connectTimeout=12000;readTimeout=15000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
   setRequestProperty("Content-Type","application/json")
   if(prefer!=null)setRequestProperty("Prefer",prefer)
   if(body!=null)doOutput=true
  }
  return try{
   if(body!=null)conn.outputStream.use{it.write(body.toString().toByteArray(Charsets.UTF_8))}
   val status=conn.responseCode
   if(status !in 200..299)error("Az adatmentés vagy lekérés nem sikerült ($status).")
   conn.inputStream.bufferedReader().use{it.readText()}
  }finally{conn.disconnect()}
 }
}
