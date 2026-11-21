package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class FieldSummary(
 val id:String,
 val name:String,
 val farmName:String,
 val areaHa:String,
 val crop:String,
 val isActive:Boolean,
 val condition:String?,
 val openTasks:Int
)

/** Mirrors the existing farmer web field catalog queries; RLS stays authoritative. */
class FieldRepository(private val baseUrl:String,private val publishableKey:String){
 suspend fun load(session:AuthorizedSession):List<FieldSummary> = withContext(Dispatchers.IO){
  val farms=fetchAll("farms?select=id,name,settlement&order=name.asc,id.asc",session.accessToken)
  val farmNames=mutableMapOf<String,String>()
  for(farm in farms){
   farmNames[farm.getString("id")]=farm.optString("name","Gazdaság")
  }
  if(farmNames.isEmpty())return@withContext emptyList()
  // Bound URL size even when a user's RLS scope spans hundreds of farms.
  val fields=farmNames.keys.toList().chunked(50).flatMap{farmIds->
   fetchAll("fields?select=id,name,farm_id,area_ha,current_crop,status&farm_id=in.(${farmIds.joinToString(",")})&order=name.asc,id.asc",session.accessToken)
  }.sortedWith(compareBy<JSONObject>{it.optString("name")}.thenBy{it.getString("id")})
  val fieldIds=fields.map{it.getString("id")}
  if(fieldIds.isEmpty())return@withContext emptyList()
  // All RLS-visible farm tasks count toward the field's warning state.
  val tasks=fieldIds.chunked(50).flatMap{ids->
   fetchAll("tasks?select=field_id,status,priority&field_id=in.(${ids.joinToString(",")})&order=field_id.asc,id.asc",session.accessToken)
  }
  val inspections=fieldIds.chunked(50).flatMap{ids->
   fetchAll("inspections?select=field_id,condition,inspected_at&field_id=in.(${ids.joinToString(",")})&order=field_id.asc,inspected_at.desc,id.asc",session.accessToken)
  }

  val openTasks=mutableMapOf<String,Int>()
  val highPriority=mutableSetOf<String>()
  for(task in tasks){
   if(task.optString("status") in listOf("done","cancelled"))continue
   val id=task.optString("field_id")
   openTasks[id]=(openTasks[id]?:0)+1
   if(task.optString("priority") in listOf("high","urgent"))highPriority.add(id)
  }
  val condition=mutableMapOf<String,String>()
  for(row in inspections){
   val id=row.optString("field_id")
   if(!condition.containsKey(id))condition[id]=row.optString("condition")
  }
  fields.map{field->
   val id=field.getString("id")
   val active=field.optString("status") !in listOf("inactive","archived")
   val severity=if(id in highPriority&&condition[id]!="critical")"attention" else condition[id]
   FieldSummary(
    id=id,
    name=field.optString("name","Névtelen tábla"),
    farmName=farmNames[field.optString("farm_id")]?:"Gazdaság",
    areaHa=if(field.isNull("area_ha"))"—" else field.optString("area_ha"),
    crop=field.optString("current_crop").ifBlank{"Nincs kultúra"},
    isActive=active,
    condition=severity,
    openTasks=openTasks[id]?:0
   )
  }
 }

 private fun fetchAll(path:String,token:String):List<JSONObject> =
  collectPostgrestPages(path){pagedPath->
   val rows=fetch(pagedPath,token)
   (0 until rows.length()).map{rows.getJSONObject(it)}
  }

 private fun fetch(path:String,token:String):JSONArray{
  val conn=(URL("${baseUrl.trimEnd('/')}/rest/v1/$path").openConnection() as HttpURLConnection).apply{
   requestMethod="GET"
   connectTimeout=12000;readTimeout=12000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer $token")
  }
  return try{
   if(conn.responseCode !in 200..299)error("Adatlekérés nem sikerült (${conn.responseCode})")
   JSONArray(conn.inputStream.bufferedReader().use{it.readText()})
  }finally{conn.disconnect()}
 }
}
