package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.*

enum class MobileBoundaryQuality{MISSING,POINT,WARNING,BOUNDED,INVALID}

data class MobileFieldQuality(
 val id:String,val name:String,val farmName:String,val areaHa:Double?,
 val status:MobileBoundaryQuality,val note:String
)

data class MobilePolygonSummary(val hectares:Double,val vertices:Int)

/** Approximate area check for display. This does not attest parcel boundaries or neighbor topology. */
internal fun summarizeMobilePolygon(raw:String):MobilePolygonSummary? {
 return runCatching{
 val geometry=JSONObject(raw)
 val coordinates=geometry.getJSONArray("coordinates")
 val parts:List<JSONArray> = when(geometry.getString("type")){
  "Polygon"->listOf(coordinates)
  "MultiPolygon"->(0 until coordinates.length()).map{coordinates.getJSONArray(it)}
  else->return null
 }
 if(parts.isEmpty())return null
 var squareMeters=0.0;var vertices=0
 for(part in parts){
  if(part.length()==0)return null
  for(ringIndex in 0 until part.length()){
   val ring=part.getJSONArray(ringIndex)
   if(ring.length()<4)return null
   val points=(0 until ring.length()).map{index->
    val p=ring.getJSONArray(index)
    p.getDouble(0) to p.getDouble(1)
   }
   if(points.any{!it.first.isFinite()||!it.second.isFinite()||it.first !in -180.0..180.0||it.second !in -90.0..90.0})return null
   if(points.first()!=points.last())return null
   val lat=points.map{it.second}.average()
   val longitudeScale=111_320.0*cos(Math.toRadians(lat))
   val latitudeScale=111_132.0
   var sum=0.0
   for(i in 0 until points.size-1){
    val a=points[i];val b=points[i+1]
    sum+=(a.first*b.second-b.first*a.second)
   }
   val area=abs(sum)*longitudeScale*latitudeScale/2.0
   squareMeters+=if(ringIndex==0)area else -area
   vertices+=points.size-1
  }
 }
 if(squareMeters<=0||!squareMeters.isFinite())null else MobilePolygonSummary(squareMeters/10_000.0,vertices)
 }.getOrNull()
}

internal fun mobileBoundaryQuality(boundary:String?,lat:Double?,lng:Double?,declaredHa:Double?):Pair<MobileBoundaryQuality,String>{
 if(boundary==null)return if(lat==null||lng==null)MobileBoundaryQuality.MISSING to "Nincs térképi hely" else MobileBoundaryQuality.POINT to "Csak helypont"
 val summary=summarizeMobilePolygon(boundary)?:return MobileBoundaryQuality.INVALID to "Hibás vagy nem értelmezhető poligon"
 if(declaredHa!=null&&declaredHa>0){
  val ratio=summary.hectares/declaredHa
  if(ratio<0.65||ratio>1.4)return MobileBoundaryQuality.WARNING to "Területeltérés: poligon kb. %.2f ha, nyilvántartva %.2f ha".format(java.util.Locale.US,summary.hectares,declaredHa)
 }
 return MobileBoundaryQuality.BOUNDED to "Kb. %.2f ha · %d töréspont".format(java.util.Locale.US,summary.hectares,summary.vertices)
}

class AdvisorMapQualityRepository(private val baseUrl:String,private val publishableKey:String){
 suspend fun load(session:AuthorizedSession):List<MobileFieldQuality> = withContext(Dispatchers.IO){
  require(session.role==PortalRole.ADVISOR){"Térképi minőségellenőrzést csak szaktanácsadó tekinthet meg."}
  val farms=readAll("farms?select=id,name&order=name.asc,id.asc",session).associate{it.getString("id") to it.optString("name")}
  readAll("fields?select=id,name,farm_id,area_ha,center_lat,center_lng,boundary_geojson&order=name.asc,id.asc",session).map{field->
   val area=field.number("area_ha")
   val geometry=if(field.isNull("boundary_geojson"))null else field.optJSONObject("boundary_geojson")?.toString()?:"invalid"
   val (state,note)=mobileBoundaryQuality(geometry,field.number("center_lat"),field.number("center_lng"),area)
   MobileFieldQuality(field.getString("id"),field.optString("name").ifBlank{"Földtábla"},
    farms[field.optString("farm_id")]?:"Gazdaság",area,state,note)
  }.sortedWith(compareBy<MobileFieldQuality>{when(it.status){
   MobileBoundaryQuality.INVALID->0;MobileBoundaryQuality.MISSING->1;MobileBoundaryQuality.WARNING->2
   MobileBoundaryQuality.POINT->3;MobileBoundaryQuality.BOUNDED->4
  }}.thenBy{it.name})
 }

 private fun readAll(path:String,session:AuthorizedSession):List<JSONObject> =
  collectPostgrestPages(path,pageSize=200){pagedPath->read(pagedPath,session)}

 private fun read(path:String,session:AuthorizedSession):List<JSONObject>{
  val conn=(URL("${baseUrl.trimEnd('/')}/rest/v1/$path").openConnection() as HttpURLConnection).apply{
   requestMethod="GET";connectTimeout=12000;readTimeout=15000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
  }
  return try{
   if(conn.responseCode !in 200..299)error("A térképi minőségi adatok nem érhetők el (${conn.responseCode}).")
   val rows=JSONArray(conn.inputStream.bufferedReader().use{it.readText()})
   (0 until rows.length()).map{rows.getJSONObject(it)}
  }finally{conn.disconnect()}
 }

 private fun JSONObject.number(key:String):Double?=if(isNull(key))null else optDouble(key).takeIf{it.isFinite()}
}
