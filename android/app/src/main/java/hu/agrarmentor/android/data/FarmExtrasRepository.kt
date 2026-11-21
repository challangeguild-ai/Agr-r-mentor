package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class MobileFarm(val id:String,val name:String,val settlement:String?,val address:String?)
data class MobileMachine(val name:String,val farmName:String,val type:String,val brand:String?,val model:String?,val hours:Double?,val nextService:Double?,val active:Boolean)
data class MobileTeamMember(val name:String,val farmName:String,val memberRole:String,val active:Boolean)
data class MobileTimelineEvent(val title:String,val description:String?,val eventType:String,val date:String,val fieldId:String?)

/** Additional role-filtered farmer lists backed by the existing schema. */
class FarmExtrasRepository(private val baseUrl:String,private val publishableKey:String){
 suspend fun farms(session:AuthorizedSession):List<MobileFarm> = withContext(Dispatchers.IO){
  readAll("farms?select=id,name,settlement,address&order=name.asc,id.asc",session).map{
   MobileFarm(it.getString("id"),it.optString("name"),it.optional("settlement"),it.optional("address"))
  }
 }

 suspend fun machines(session:AuthorizedSession):List<MobileMachine> = withContext(Dispatchers.IO){
  val farms=farms(session).associateBy{it.id}
  readAll("machines?select=id,farm_id,name,machine_type,manufacturer,model,current_hours,next_service_hours,active&order=name.asc,id.asc",session).map{row->
   MobileMachine(
    row.optString("name"),farms[row.optString("farm_id")]?.name?:"Gazdaság",row.optString("machine_type"),
    row.optional("manufacturer"),row.optional("model"),row.numberOrNull("current_hours"),row.numberOrNull("next_service_hours"),row.optBoolean("active",true)
   )
  }
 }

 suspend fun team(session:AuthorizedSession):List<MobileTeamMember> = withContext(Dispatchers.IO){
  val farms=farms(session).associateBy{it.id}
  if(farms.isEmpty())return@withContext emptyList()
  val members=farms.keys.toList().chunked(50).flatMap{ids->
   readAll("farm_members?select=farm_id,user_id,member_role,active&farm_id=in.(${ids.joinToString(",")})&order=farm_id.asc,id.asc",session)
  }
  val people=runCatching{
   val userIds=members.map{it.optString("user_id")}.distinct().filter{it.isNotBlank()}
   if(userIds.isEmpty())emptyMap()else userIds.chunked(50).flatMap{ids->
    readAll("profiles?select=id,full_name&id=in.(${ids.joinToString(",")})&order=id.asc",session)
   }
    .associate{it.getString("id") to it.optString("full_name")}
  }.getOrDefault(emptyMap())
  members.map{row->
   MobileTeamMember(
    people[row.optString("user_id")]?.ifBlank{"Munkatárs"}?:"Munkatárs",
    farms[row.optString("farm_id")]?.name?:"Gazdaság",row.optString("member_role"),row.optBoolean("active",true)
   )
  }
 }

 suspend fun timeline(session:AuthorizedSession):List<MobileTimelineEvent> = withContext(Dispatchers.IO){
  readAll("timeline_events?select=title,description,event_type,event_at,created_at,field_id&order=event_at.desc,id.desc",session).map{row->
   MobileTimelineEvent(row.optString("title"),row.optional("description"),row.optString("event_type"),
    row.optional("event_at")?:row.optString("created_at"),row.optional("field_id"))
  }
 }

 private fun read(path:String,session:AuthorizedSession):List<JSONObject>{
  val conn=(URL("${baseUrl.trimEnd('/')}/rest/v1/$path").openConnection() as HttpURLConnection).apply{
   requestMethod="GET";connectTimeout=12000;readTimeout=12000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
  }
  return try{
   if(conn.responseCode !in 200..299)error("Nem érhető el az adat (${conn.responseCode}).")
   val rows=JSONArray(conn.inputStream.bufferedReader().use{it.readText()})
   (0 until rows.length()).map{rows.getJSONObject(it)}
  }finally{conn.disconnect()}
 }

 private fun readAll(path:String,session:AuthorizedSession):List<JSONObject> =
  collectPostgrestPages(path){pagedPath->read(pagedPath,session)}

 private fun JSONObject.optional(key:String):String?=if(isNull(key))null else optString(key).ifBlank{null}
 private fun JSONObject.numberOrNull(key:String):Double?=if(isNull(key))null else optDouble(key).takeIf{!it.isNaN()}
}
