package hu.agrarmentor.android.data

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class FieldProofGeometryTest {
 private val boundary=JSONObject("""{"type":"Polygon","coordinates":[
  [[19.0,47.0],[19.01,47.0],[19.01,47.01],[19.0,47.01],[19.0,47.0]],
  [[19.004,47.004],[19.006,47.004],[19.006,47.006],[19.004,47.006],[19.004,47.004]]
 ]}""")

 @Test fun acceptsInsideButRejectsHole(){
  assertEquals("inside_boundary",FieldProofGeometry.verify(47.002,19.002,boundary,null,null)?.validation)
  assertNull(FieldProofGeometry.verify(47.005,19.005,boundary,null,null))
 }

 @Test fun acceptsNearbyExteriorButRejectsDistantLocation(){
  val nearby=FieldProofGeometry.verify(47.0103,19.002,boundary,null,null)
  assertEquals("near_boundary",nearby?.validation)
  assertTrue(nearby!!.distanceMeters!! in 20.0..50.0)
  assertNull(FieldProofGeometry.verify(47.04,19.04,boundary,null,null))
 }

 @Test fun centerOnlyFallbackLimitedTo500Meters(){
  assertEquals("near_center",FieldProofGeometry.verify(47.0008,19.0,null,47.0,19.0)?.validation)
  assertNull(FieldProofGeometry.verify(47.01,19.0,null,47.0,19.0))
 }

 @Test fun staleOrInaccurateGpsIsRejected(){
  val now=1_800_000_000_000L
  assertTrue(GpsTaskPosition(47.0,19.0,5f,now-30_000).isFresh(now))
  assertFalse(GpsTaskPosition(47.0,19.0,5f,now-901_000).isFresh(now))
  assertFalse(GpsTaskPosition(47.0,19.0,201f,now).isFresh(now))
  assertFalse(GpsTaskPosition(47.0,19.0,5f,now+121_000).isFresh(now))
 }
}
