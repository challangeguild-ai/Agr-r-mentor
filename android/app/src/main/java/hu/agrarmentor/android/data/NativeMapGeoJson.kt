package hu.agrarmentor.android.data

import org.json.JSONArray
import org.json.JSONObject

/** Converts the stored Polygon/MultiPolygon geometries to MapLibre features. */
object NativeMapGeoJson{
 fun polygons(fields:List<NativeMapField>):String{
  val features=JSONArray()
  fields.forEach{field->
   val geometry=runCatching{JSONObject(field.boundary?:return@forEach)}.getOrNull()?:return@forEach
   if(geometry.optString("type") !in listOf("Polygon","MultiPolygon"))return@forEach
   if((geometry.optJSONArray("coordinates")?.length()?:0)==0)return@forEach
   features.put(JSONObject().put("type","Feature")
    .put("geometry",geometry)
    .put("properties",JSONObject().put("id",field.id).put("name",field.name)))
  }
  return JSONObject().put("type","FeatureCollection").put("features",features).toString()
 }

 fun points(fields:List<NativeMapField>):String{
  val features=JSONArray()
  fields.forEach{field->
   val center=center(field)?:return@forEach
   features.put(JSONObject().put("type","Feature")
    .put("geometry",JSONObject().put("type","Point").put("coordinates",JSONArray().put(center.second).put(center.first)))
    .put("properties",JSONObject().put("id",field.id).put("name",field.name)))
  }
  return JSONObject().put("type","FeatureCollection").put("features",features).toString()
 }

 /** Latitude, longitude. Database centers take precedence over polygon vertices. */
 fun center(field:NativeMapField):Pair<Double,Double>?{
  if(field.latitude!=null&&field.longitude!=null&&valid(field.latitude,field.longitude))return field.latitude to field.longitude
  val geometry=runCatching{JSONObject(field.boundary?:return null)}.getOrNull()?:return null
  val coordinates=geometry.optJSONArray("coordinates")?:return null
  val firstRing=if(geometry.optString("type")=="MultiPolygon")coordinates.optJSONArray(0)?.optJSONArray(0)
   else coordinates.optJSONArray(0)
  val vertex=firstRing?.optJSONArray(0)?:return null
  val longitude=vertex.optDouble(0,Double.NaN)
  val latitude=vertex.optDouble(1,Double.NaN)
  return if(valid(latitude,longitude))latitude to longitude else null
 }

 private fun valid(lat:Double,lng:Double)=lat.isFinite()&&lng.isFinite()&&lat in -90.0..90.0&&lng in -180.0..180.0
}
