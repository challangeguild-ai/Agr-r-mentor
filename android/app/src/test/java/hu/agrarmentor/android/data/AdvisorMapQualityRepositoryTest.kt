package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class AdvisorMapQualityRepositoryTest {
 private val square="""{"type":"Polygon","coordinates":[[[19.0,47.0],[19.001,47.0],[19.001,47.001],[19.0,47.001],[19.0,47.0]]]}"""

 @Test fun differentiatesMissingPointMalformedAndCompleteBoundary(){
  assertEquals(MobileBoundaryQuality.MISSING,mobileBoundaryQuality(null,null,null,1.0).first)
  assertEquals(MobileBoundaryQuality.POINT,mobileBoundaryQuality(null,47.0,19.0,1.0).first)
  assertEquals(MobileBoundaryQuality.INVALID,mobileBoundaryQuality("invalid",47.0,19.0,1.0).first)
  val summary=summarizeMobilePolygon(square)!!
  assertTrue(summary.hectares in 0.7..0.9)
  assertEquals(4,summary.vertices)
  assertEquals(MobileBoundaryQuality.BOUNDED,mobileBoundaryQuality(square,null,null,summary.hectares).first)
  assertEquals(MobileBoundaryQuality.WARNING,mobileBoundaryQuality(square,null,null,10.0).first)
 }

 @Test fun polygonMustBeClosedAndValidlyLocated(){
  val open="""{"type":"Polygon","coordinates":[[[19,47],[20,47],[20,48],[19,48]]]}"""
  assertNull(summarizeMobilePolygon(open))
  val wrong="""{"type":"Polygon","coordinates":[[[191,47],[192,47],[192,48],[191,48],[191,47]]]}"""
  assertNull(summarizeMobilePolygon(wrong))
 }

 @Test fun onlyAdvisorLoadsFarmBoundaryQuality(){
  val repo=AdvisorMapQualityRepository("https://example.supabase.co","public-test-key")
  val farmer=AuthorizedSession(PortalRole.FARMER,"token","id","",0L)
  assertThrows(IllegalArgumentException::class.java){runBlocking{repo.load(farmer)}}
 }
}
