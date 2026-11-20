package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate
import java.time.MonthDay

data class MobileSupervisionConfig(
 val activeFrom:String="03-15",val activeTo:String="10-31",
 val inspectionIntervalDays:Int=30,val enabled:Boolean=true,val note:String=""
)
data class MobileSupervisionFarm(val id:String,val name:String,val config:MobileSupervisionConfig,val version:String?)

internal fun decodeMobileSupervision(description:String?):MobileSupervisionConfig?{
 if(description?.startsWith("SUPERVISION:")!=true)return null
 return runCatching{
  val raw=JSONObject(description.removePrefix("SUPERVISION:"))
  MobileSupervisionConfig(
   raw.optString("activeFrom","03-15"),raw.optString("activeTo","10-31"),
   raw.optInt("inspectionIntervalDays",30).coerceIn(1,365),raw.optBoolean("enabled",true),raw.optString("note")
  )
 }.getOrNull()
}

internal fun validateMobileSupervision(config:MobileSupervisionConfig){
 fun monthDay(value:String):MonthDay{
  require(value.matches(Regex("\\d{2}-\\d{2}"))){"A szezon dátuma HH-NN formátumú legyen."}
  return runCatching{MonthDay.parse("--$value")}.getOrElse{throw IllegalArgumentException("Érvénytelen hónap vagy nap.")}
 }
 monthDay(config.activeFrom);monthDay(config.activeTo)
 require(config.inspectionIntervalDays in 1..365){"A szemleciklus 1–365 nap lehet."}
 require(config.note.length<=500){"A megjegyzés legfeljebb 500 karakter lehet."}
}

internal fun mobileSupervisionActive(config:MobileSupervisionConfig,date:LocalDate):Boolean{
 if(!config.enabled)return false
 val current=MonthDay.from(date)
 val start=MonthDay.parse("--${config.activeFrom}")
 val end=MonthDay.parse("--${config.activeTo}")
 return if(start<=end)current>=start&&current<=end else current>=start||current<=end
}

/** Writes the same SUPERVISION timeline event as the web UI under the advisor JWT. */
class AdvisorSupervisionRepository(private val baseUrl:String,private val publishableKey:String){
 suspend fun load(session:AuthorizedSession):List<MobileSupervisionFarm> = withContext(Dispatchers.IO){
  requireAdvisor(session)
  val farms=read("farms?select=id,name&order=name.asc&limit=1000",session)
  val events=read("timeline_events?select=id,farm_id,description,event_at&event_type=eq.supervision_config&order=event_at.desc&limit=2000",session)
  val latest=linkedMapOf<String,JSONObject>()
  events.forEach{event->latest.putIfAbsent(event.optString("farm_id"),event)}
  farms.map{farm->
   val id=farm.getString("id")
   MobileSupervisionFarm(id,farm.optString("name").ifBlank{"Gazdaság"},
    decodeMobileSupervision(latest[id]?.optString("description"))?:MobileSupervisionConfig(),
    latest[id]?.optString("id"))
  }
 }

 /** eventId stays constant across retries to avoid duplicate season entries. */
 suspend fun save(session:AuthorizedSession,farmId:String,config:MobileSupervisionConfig,eventId:String):Unit = withContext(Dispatchers.IO){
  requireAdvisor(session)
  require(farmId.matches(UUID_PATTERN)&&eventId.matches(UUID_PATTERN)){"Érvénytelen azonosító."}
  validateMobileSupervision(config)
  val farm=read("farms?select=id,name&id=eq.$farmId&limit=1",session).singleOrNull()
   ?:error("Ez a gazdaság nem érhető el a jogosultságaiddal.")
  val description="SUPERVISION:"+JSONObject()
   .put("activeFrom",config.activeFrom).put("activeTo",config.activeTo)
   .put("inspectionIntervalDays",config.inspectionIntervalDays)
   .put("enabled",config.enabled).put("note",config.note).toString()
  val body=JSONObject().put("id",eventId).put("farm_id",farmId).put("field_id",JSONObject.NULL)
   .put("event_type","supervision_config")
   .put("title","Szemlézési szezon: ${farm.optString("name")}")
   .put("description",description).put("event_at",java.time.Instant.now().toString())
   .put("created_by",session.userId)
  val conn=(URL("${baseUrl.trimEnd('/')}/rest/v1/timeline_events?on_conflict=id").openConnection() as HttpURLConnection).apply{
   requestMethod="POST";doOutput=true;connectTimeout=12000;readTimeout=12000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
   setRequestProperty("Content-Type","application/json")
   setRequestProperty("Prefer","resolution=ignore-duplicates,return=minimal")
  }
  try{
   conn.outputStream.use{it.write(body.toString().toByteArray(Charsets.UTF_8))}
   val code=conn.responseCode
   if(code !in 200..299)error("Nem sikerült menteni a szemlézési szezont ($code).")
  }finally{conn.disconnect()}
  val stored=read("timeline_events?select=id,farm_id,description,created_by&id=eq.$eventId&limit=1",session).singleOrNull()
  check(stored!=null&&stored.optString("farm_id")==farmId&&stored.optString("created_by")==session.userId&&stored.optString("description")==description){
   "A szezon mentése nem igazolható. Frissítsd az adatokat, mielőtt újra próbálkozol."
  }
 }

 private fun requireAdvisor(session:AuthorizedSession){
  require(session.role==PortalRole.ADVISOR){"Szezonbeállítást csak szaktanácsadó kezelhet."}
  require(session.userId.matches(UUID_PATTERN)){"Érvénytelen felhasználóazonosító."}
 }

 private fun read(path:String,session:AuthorizedSession):List<JSONObject>{
  val conn=(URL("${baseUrl.trimEnd('/')}/rest/v1/$path").openConnection() as HttpURLConnection).apply{
   requestMethod="GET";connectTimeout=12000;readTimeout=12000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
  }
  return try{
   if(conn.responseCode !in 200..299)error("A szezonadatok nem tölthetők be (${conn.responseCode}).")
   val rows=JSONArray(conn.inputStream.bufferedReader().use{it.readText()})
   (0 until rows.length()).map{rows.getJSONObject(it)}
  }finally{conn.disconnect()}
 }

 private companion object{val UUID_PATTERN=Regex("[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}")}
}
