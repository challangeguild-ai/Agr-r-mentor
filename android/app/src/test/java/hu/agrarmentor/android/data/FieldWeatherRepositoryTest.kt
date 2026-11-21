package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test
import java.time.Instant
import java.time.LocalDate

class FieldWeatherRepositoryTest{
 private val today=LocalDate.parse("2026-11-21")
 private fun measurement(day:String,mm:Double,fetched:String="2026-11-21T08:00:00Z",distance:Double?=3.0)=
  DailyRainMeasurement(LocalDate.parse(day),mm,"HungaroMet","Monor",distance,Instant.parse(fetched))

 @Test fun noMeasurementIsNotARecordedDryDay(){
  val summary=summarizeFieldRain(emptyList(),today)
  assertEquals(0,summary.measuredDays7)
  assertEquals(0,summary.measuredDays30)
  assertEquals(0,summary.rainyDays30)
  assertNull(summary.latest)
  assertNull(summary.lastRain)
 }

 @Test fun countsMeasuredDaysAndKeepsZeroDistinctFromMissing(){
  val summary=summarizeFieldRain(listOf(
   measurement("2026-11-21",0.0),measurement("2026-11-20",8.5),
   measurement("2026-11-14",4.0),measurement("2026-10-23",2.5),
   measurement("2026-10-22",99.0),measurement("2026-11-22",88.0)
  ),today)
  assertEquals(8.5,summary.rain7,0.001)
  assertEquals(15.0,summary.rain30,0.001)
  assertEquals(2,summary.measuredDays7)
  assertEquals(4,summary.measuredDays30)
  assertEquals(1,summary.rainyDays7)
  assertEquals(3,summary.rainyDays30)
  assertEquals(today,summary.latest?.date)
  assertEquals(LocalDate.parse("2026-11-20"),summary.lastRain?.date)
 }

 @Test fun latestImportBeatsNearestStationAndNoDoubleCounting(){
  val summary=summarizeFieldRain(listOf(
   measurement("2026-11-20",14.0,"2026-11-20T11:00:00Z",1.0),
   measurement("2026-11-20",3.0,"2026-11-21T09:00:00Z",7.0),
   measurement("2026-11-20",9.0,"2026-11-21T09:00:00Z",2.0)
  ),today)
  assertEquals(1,summary.measuredDays30)
  assertEquals(9.0,summary.rain30,0.001)
  assertEquals(2.0,summary.latest?.distanceKm?:-1.0,0.001)
 }

 @Test fun calendarDaysAreIndependentOfDstHours(){
  val summary=summarizeFieldRain(listOf(
   measurement("2026-10-25",5.0),measurement("2026-10-26",0.0),
   measurement("2026-10-23",2.0)
  ),LocalDate.parse("2026-10-31"))
  assertEquals(5.0,summary.rain7,0.001)
  assertEquals(7.0,summary.rain30,0.001)
  assertEquals(2,summary.measuredDays7)
  assertEquals(3,summary.measuredDays30)
 }

 @Test fun rejectsNonMeasuredAndInvalidWeatherRows(){
  val normal="""{"source_type":"measured","weather_date":"2026-11-20","precipitation_mm":"0", "provider":"HungaroMet","station_name":"Monor","fetched_at":"2026-11-21T08:00:00+00:00"}"""
  assertEquals(0.0,parseMeasuredRain(JSONObject(normal))?.millimeters?:-1.0,0.001)
  for(changed in listOf(
   normal.replace("measured","forecast"),
   normal.replace("2026-11-20","2026-11-31"),
   normal.replace("\"0\"","\"-1\""),
   normal.replace("\"0\"","\"\""),
   normal.replace("2026-11-20","2026-11-20&or=(true)")
  ))assertNull(parseMeasuredRain(JSONObject(changed)))
 }

 @Test fun badIdsAreRejectedBeforeNetworkAccess(){
  val repo=FieldWeatherRepository("https://example.supabase.co","publishable-key")
  val session=AuthorizedSession(PortalRole.FARMER,"token","11111111-2222-3333-4444-555555555555","",0L)
  assertThrows(IllegalArgumentException::class.java){
   runBlocking{repo.load(session,"11111111-2222-3333-4444-555555555555&field_id=neq.x")}
  }
 }
}
