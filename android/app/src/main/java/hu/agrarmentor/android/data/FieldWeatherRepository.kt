package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.temporal.ChronoUnit

internal data class DailyRainMeasurement(
 val date:LocalDate,
 val millimeters:Double,
 val provider:String,
 val station:String?,
 val distanceKm:Double?,
 val fetchedAt:Instant?
)

internal data class FieldRainSummary(
 val rain7:Double,
 val rain30:Double,
 val measuredDays7:Int,
 val measuredDays30:Int,
 val rainyDays7:Int,
 val rainyDays30:Int,
 val measurements:List<DailyRainMeasurement>
){
 val latest:DailyRainMeasurement? get()=measurements.firstOrNull()
 val lastRain:DailyRainMeasurement? get()=measurements.firstOrNull{it.millimeters>0}
}

/** Match the web portal: only measured days, one station per calendar day. */
internal fun summarizeFieldRain(rows:List<DailyRainMeasurement>,today:LocalDate):FieldRainSummary{
 val byDay=linkedMapOf<LocalDate,DailyRainMeasurement>()
 val newestFirst=rows.sortedWith(
  compareByDescending<DailyRainMeasurement>{it.fetchedAt?:Instant.EPOCH}
   .thenBy{it.distanceKm?:Double.POSITIVE_INFINITY}
   .thenBy{it.provider}
 )
 for(row in newestFirst){
  val age=ChronoUnit.DAYS.between(row.date,today)
  if(age !in 0L..29L||!row.millimeters.isFinite()||row.millimeters<0)continue
  byDay.putIfAbsent(row.date,row)
 }
 val measurements=byDay.values.sortedByDescending{it.date}
 val last7=measurements.filter{ChronoUnit.DAYS.between(it.date,today)<7}
 return FieldRainSummary(
  rain7=last7.sumOf{it.millimeters},rain30=measurements.sumOf{it.millimeters},
  measuredDays7=last7.size,measuredDays30=measurements.size,
  rainyDays7=last7.count{it.millimeters>0},rainyDays30=measurements.count{it.millimeters>0},
  measurements=measurements
 )
}

internal fun parseMeasuredRain(row:JSONObject):DailyRainMeasurement?{
 if(row.optString("source_type")!="measured")return null
 val dateText=row.optString("weather_date")
 if(!Regex("\\d{4}-\\d{2}-\\d{2}").matches(dateText))return null
 val date=runCatching{LocalDate.parse(dateText)}.getOrNull()?:return null
 val amount=when(val value=row.opt("precipitation_mm")){
  is Number->value.toDouble()
  is String->value.trim().toDoubleOrNull()
  else->null
 }?.takeIf{it.isFinite()&&it>=0}?:return null
 val distance=when(val value=row.opt("distance_km")){
  is Number->value.toDouble()
  is String->value.trim().toDoubleOrNull()
  else->null
 }?.takeIf{it.isFinite()&&it>=0}
 val fetchedAt=runCatching{OffsetDateTime.parse(row.optString("fetched_at")).toInstant()}.getOrNull()
 return DailyRainMeasurement(
  date=date,millimeters=amount,
  provider=row.optString("provider").ifBlank{"Ismeretlen mérőállomás"},
  station=row.optString("station_name").takeIf{it.isNotBlank()},
  distanceKm=distance,fetchedAt=fetchedAt
 )
}

/** Never uses a service-role key: Supabase's authenticated RLS policy scopes field_weather_daily. */
internal class FieldWeatherRepository(private val baseUrl:String,private val publishableKey:String){
 suspend fun load(session:AuthorizedSession,fieldId:String):FieldRainSummary=withContext(Dispatchers.IO){
  require(validMapFieldId(fieldId)){"Érvénytelen táblaazonosító."}
  val today=LocalDate.now(ZoneId.of("Europe/Budapest"))
  val since=today.minusDays(29)
  val path="field_weather_daily?select=weather_date,precipitation_mm,source_type,provider,station_name,distance_km,fetched_at"+
   "&field_id=eq.$fieldId&source_type=eq.measured&weather_date=gte.$since&weather_date=lte.$today"+
   "&order=weather_date.desc,fetched_at.desc,id.desc"
  val observations=collectPostgrestPages(path,pageSize=200){pagePath->
   read(pagePath,session.accessToken)
  }.mapNotNull(::parseMeasuredRain)
  summarizeFieldRain(observations,today)
 }

 private fun read(path:String,token:String):List<JSONObject>{
  val connection=(URL("${baseUrl.trimEnd('/')}/rest/v1/$path").openConnection() as HttpURLConnection).apply{
   requestMethod="GET";connectTimeout=12000;readTimeout=15000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer $token")
  }
  return try{
   if(connection.responseCode !in 200..299)error("A csapadékadatok nem érhetők el (${connection.responseCode}).")
   val rows=JSONArray(connection.inputStream.bufferedReader().use{it.readText()})
   (0 until rows.length()).map{rows.getJSONObject(it)}
  }finally{connection.disconnect()}
 }
}
