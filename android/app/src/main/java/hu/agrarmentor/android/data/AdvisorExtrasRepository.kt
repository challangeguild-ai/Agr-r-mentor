package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class MobileAdvisorRecord(val title:String,val subtitle:String,val detail:String?,val date:String?,val fieldId:String?)

/** Advisor-only read endpoints; the JWT and Postgres RLS control visibility. */
class AdvisorExtrasRepository(private val baseUrl:String,private val publishableKey:String){
 suspend fun load(route:String,session:AuthorizedSession):List<MobileAdvisorRecord> = withContext(Dispatchers.IO){
  val fields=read("fields?select=id,name&limit=1000",session)
   .associate{it.getString("id") to it.optString("name")}
  val rows=when(route){
   "/admin/inspections"->read("inspections?select=field_id,condition,notes,recommendation,inspected_at&order=inspected_at.desc&limit=150",session)
   "/admin/reports"->read("farmer_reports?select=field_id,title,message,status,advisor_reply,created_at&order=created_at.desc&limit=150",session)
   "/admin/visits"->read("timeline_events?select=title,field_id,description,event_at&event_type=eq.advisor_visit_plan&order=event_at.asc&limit=150",session)
   else->emptyList()
  }
  rows.map{row->
   val fieldName=fields[row.optString("field_id")]?:"Gazdasági esemény"
   when(route){
    "/admin/inspections"->MobileAdvisorRecord(
     when(row.optString("condition")){"critical"->"Kritikus szemle";"attention"->"Figyelmeztető szemle";else->"Táblaszemle"},
     fieldName,listOfNotNull(row.optional("notes"),row.optional("recommendation")).joinToString(" · ").ifBlank{null},
     row.optional("inspected_at"),row.optional("field_id")
    )
    "/admin/reports"->MobileAdvisorRecord(
     row.optString("title"),"$fieldName · ${row.optString("status")}",
     listOfNotNull(row.optional("message"),row.optional("advisor_reply")?.let{"Válasz: $it"}).joinToString("\n"),
     row.optional("created_at"),row.optional("field_id")
    )
    else->MobileAdvisorRecord(
     row.optString("title"),fieldName,row.optional("description"),row.optional("event_at"),row.optional("field_id")
    )
   }
  }
 }

 private fun read(path:String,session:AuthorizedSession):List<JSONObject>{
  val connection=(URL("${baseUrl.trimEnd('/')}/rest/v1/$path").openConnection() as HttpURLConnection).apply{
   requestMethod="GET";connectTimeout=12000;readTimeout=12000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
  }
  return try{
   if(connection.responseCode !in 200..299)error("Adatlekérés sikertelen (${connection.responseCode}).")
   val rows=JSONArray(connection.inputStream.bufferedReader().use{it.readText()})
   (0 until rows.length()).map{rows.getJSONObject(it)}
  }finally{connection.disconnect()}
 }

 private fun JSONObject.optional(name:String):String?=if(isNull(name))null else optString(name).ifBlank{null}
}
