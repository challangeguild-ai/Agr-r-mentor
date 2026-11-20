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
  val farms=fetch("farms?select=id,name,settlement&order=name.asc",session.accessToken)
  val farmNames=mutableMapOf<String,String>()
  for(i in 0 until farms.length()){
   val farm=farms.getJSONObject(i)
   farmNames[farm.getString("id")]=farm.optString("name","Gazdaság")
  }
  if(farmNames.isEmpty())return@withContext emptyList()
  val farmIds=farmNames.keys.joinToString(",")
  val fields=fetch("fields?select=id,name,farm_id,area_ha,current_crop,status&farm_id=in.($farmIds)&order=name.asc",session.accessToken)
  val fieldIds=(0 until fields.length()).map{fields.getJSONObject(it).getString("id")}
  if(fieldIds.isEmpty())return@withContext emptyList()
  val idFilter=fieldIds.joinToString(",")
  // All RLS-visible farm tasks count toward the field's warning state.
  val tasks=fetch("tasks?select=field_id,status,priority&field_id=in.($idFilter)",session.accessToken)
  val inspections=fetch("inspections?select=field_id,condition,inspected_at&field_id=in.($idFilter)&order=inspected_at.desc",session.accessToken)

  val openTasks=mutableMapOf<String,Int>()
  val highPriority=mutableSetOf<String>()
  for(i in 0 until tasks.length()){
   val task=tasks.getJSONObject(i)
   if(task.optString("status") in listOf("done","cancelled"))continue
   val id=task.optString("field_id")
   openTasks[id]=(openTasks[id]?:0)+1
   if(task.optString("priority") in listOf("high","urgent"))highPriority.add(id)
  }
  val condition=mutableMapOf<String,String>()
  for(i in 0 until inspections.length()){
   val row=inspections.getJSONObject(i)
   val id=row.optString("field_id")
   if(!condition.containsKey(id))condition[id]=row.optString("condition")
  }
  (0 until fields.length()).map{index->
   val field=fields.getJSONObject(index)
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
