package hu.agrarmentor.android.data

import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.*

/** Client-side preview only. The hardened database RPC rechecks the actual boundary. */
internal object FieldProofGeometry {
 data class Verdict(val validation:String,val distanceMeters:Double?)

 fun verify(lat:Double,lng:Double,boundary:JSONObject?,centerLat:Double?,centerLng:Double?):Verdict? {
  if(!lat.isFinite()||lat !in -90.0..90.0||!lng.isFinite()||lng !in -180.0..180.0)return null
  if(boundary==null){
   if(centerLat==null||centerLng==null||!centerLat.isFinite()||!centerLng.isFinite())return null
   val distance=haversine(lat,lng,centerLat,centerLng)
   return if(distance<=500)Verdict("near_center",distance)else null
  }
  val polygons=polygons(boundary)
  if(polygons.isEmpty())return null
  if(polygons.any{polygon->polygon.isNotEmpty()&&inRing(lat,lng,polygon[0])&&polygon.drop(1).none{inRing(lat,lng,it)}})
   return Verdict("inside_boundary",null)
  // A hole is never a valid 150 m boundary override.
  if(polygons.any{polygon->polygon.isNotEmpty()&&inRing(lat,lng,polygon[0])&&polygon.drop(1).any{inRing(lat,lng,it)}})
   return null
  val distance=polygons.mapNotNull{it.firstOrNull()}.flatMap{ring->
   ring.indices.map{index->segmentDistance(lat,lng,ring[index],ring[(index+1)%ring.size])}
  }.minOrNull()?:return null
  return if(distance<=150)Verdict("near_boundary",distance)else null
 }

 private data class Point(val lat:Double,val lng:Double)
 private fun polygons(boundary:JSONObject):List<List<List<Point>>> {
  val coordinates=boundary.optJSONArray("coordinates")?:return emptyList()
  val raw=when(boundary.optString("type")) {
   "Polygon"->listOf(coordinates)
   "MultiPolygon"->(0 until coordinates.length()).mapNotNull{coordinates.optJSONArray(it)}
   else->emptyList()
  }
  return raw.map{polygon->(0 until polygon.length()).mapNotNull{index->
   val rawRing=polygon.optJSONArray(index)?:return@mapNotNull null
   val ring=(0 until rawRing.length()).mapNotNull{pointIndex->
    val item=rawRing.optJSONArray(pointIndex)?:return@mapNotNull null
    val lng=item.optDouble(0,Double.NaN);val lat=item.optDouble(1,Double.NaN)
    if(lat.isFinite()&&lng.isFinite())Point(lat,lng)else null
   }
   ring.takeIf{it.size>=3}
  }}.filter{it.isNotEmpty()}
 }

 private fun inRing(lat:Double,lng:Double,ring:List<Point>):Boolean {
  var inside=false
  for(i in ring.indices){
   val a=ring[i];val b=ring[(i+1)%ring.size]
   if((a.lat>lat)!=(b.lat>lat)&&lng<(b.lng-a.lng)*(lat-a.lat)/(b.lat-a.lat)+a.lng)inside=!inside
  }
  return inside
 }

 private fun haversine(lat:Double,lng:Double,otherLat:Double,otherLng:Double):Double {
  val dLat=Math.toRadians(otherLat-lat);val dLng=Math.toRadians(otherLng-lng)
  val a=sin(dLat/2).pow(2)+cos(Math.toRadians(lat))*cos(Math.toRadians(otherLat))*sin(dLng/2).pow(2)
  return 2*6371000*atan2(sqrt(a),sqrt(max(0.0,1-a)))
 }

 private fun segmentDistance(lat:Double,lng:Double,a:Point,b:Point):Double {
  val scaleX=Math.PI/180*6371000*cos(Math.toRadians((lat+a.lat+b.lat)/3))
  val scaleY=Math.PI/180*6371000
  val ax=(a.lng-lng)*scaleX;val ay=(a.lat-lat)*scaleY
  val bx=(b.lng-lng)*scaleX;val by=(b.lat-lat)*scaleY
  val dx=bx-ax;val dy=by-ay;val lengthSquared=dx*dx+dy*dy
  val t=if(lengthSquared>0)(-(ax*dx+ay*dy)/lengthSquared).coerceIn(0.0,1.0)else 0.0
  return hypot(ax+t*dx,ay+t*dy)
 }
}
