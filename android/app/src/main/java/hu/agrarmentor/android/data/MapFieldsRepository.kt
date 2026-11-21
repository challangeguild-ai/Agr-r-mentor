package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class NativeMapField(
 val id:String,
 val name:String,
 val farmName:String,
 val latitude:Double?,
 val longitude:Double?,
 val boundary:String?
)

/** Rejects extra path segments or query fragments before constructing a PostgREST URL. */
internal fun validMapFieldId(fieldId:String):Boolean=fieldId.matches(
 Regex("[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}")
)

/** RLS-scoped geometry reader. The map renders only what this user can access. */
class MapFieldsRepository(private val baseUrl:String,private val publishableKey:String){
 suspend fun loadOne(session:AuthorizedSession,fieldId:String):NativeMapField? = withContext(Dispatchers.IO){
  require(validMapFieldId(fieldId)){"Érvénytelen földtábla-azonosító."}
  val row=read("fields?select=id,name,farm_id,center_lat,center_lng,boundary_geojson&id=eq.$fieldId&limit=1",session)
   .singleOrNull()?:return@withContext null
  val farmId=row.getString("farm_id")
  require(validMapFieldId(farmId)){"Érvénytelen gazdaságazonosító."}
  val farm=read("farms?select=id,name&id=eq.$farmId&limit=1",session).singleOrNull()
  mapField(row,farm?.optString("name")?:"Gazdaság")
 }

 suspend fun load(session:AuthorizedSession):List<NativeMapField> = withContext(Dispatchers.IO){
  val farmNames=readAll("farms?select=id,name&order=name.asc,id.asc",session)
   .associate{it.getString("id") to it.optString("name")}
  readAll("fields?select=id,name,farm_id,center_lat,center_lng,boundary_geojson&order=name.asc,id.asc",session).map{row->
   mapField(row,farmNames[row.optString("farm_id")]?:"Gazdaság")
  }
 }

 private fun readAll(path:String,session:AuthorizedSession):List<JSONObject> =
  collectPostgrestPages(path,pageSize=200){pagedPath->read(pagedPath,session)}

 private fun mapField(row:JSONObject,farmName:String):NativeMapField=NativeMapField(
    id=row.getString("id"),
    name=row.optString("name","Földtábla"),
    farmName=farmName,
    latitude=row.numberOrNull("center_lat"),
    longitude=row.numberOrNull("center_lng"),
    boundary=if(row.isNull("boundary_geojson"))null else row.getJSONObject("boundary_geojson").toString()
 )

 private fun read(path:String,session:AuthorizedSession):List<JSONObject>{
  val conn=(URL("${baseUrl.trimEnd('/')}/rest/v1/$path").openConnection() as HttpURLConnection).apply{
   requestMethod="GET";connectTimeout=12000;readTimeout=15000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
  }
  return try{
   if(conn.responseCode !in 200..299)error("A térképi adatok nem érhetők el (${conn.responseCode}).")
   val rows=JSONArray(conn.inputStream.bufferedReader().use{it.readText()})
   (0 until rows.length()).map{rows.getJSONObject(it)}
  }finally{conn.disconnect()}
 }

 private fun JSONObject.numberOrNull(key:String):Double?=if(isNull(key))null else optDouble(key).takeIf{!it.isNaN()&&it.isFinite()}
}
