package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class AdvisorBoundaryRepositoryTest {
 @Test fun timestampsComparedByInstantNotTextFormat(){
  assertFalse(boundaryVersionChanged("2026-11-20T10:00:00+00:00","2026-11-20T11:00:00+01:00"))
  assertTrue(boundaryVersionChanged("2026-11-20T10:00:01Z","2026-11-20T10:00:00Z"))
  assertFalse(boundaryVersionChanged(null,null))
  assertTrue(boundaryVersionChanged(null,"2026-11-20T10:00:00Z"))
 }

 @Test fun onlyAdvisorMayReviewAndConfirmationIsMandatory(){
  val repo=AdvisorBoundaryRepository("https://example.supabase.co","public-test-key")
  val farmer=AuthorizedSession(PortalRole.FARMER,"test","11111111-1111-1111-1111-111111111111","",0L)
  val advisor=farmer.copy(role=PortalRole.ADVISOR)
  val proposal="22222222-2222-2222-2222-222222222222"
  assertThrows(IllegalArgumentException::class.java){runBlocking{repo.queue(farmer)}}
  assertThrows(IllegalArgumentException::class.java){runBlocking{repo.detail(farmer,proposal)}}
  assertThrows(IllegalArgumentException::class.java){runBlocking{repo.review(farmer,proposal,false,false,"")}}
  assertThrows(IllegalArgumentException::class.java){runBlocking{repo.review(advisor,proposal,true,false,"")}}
  assertThrows(IllegalArgumentException::class.java){runBlocking{repo.review(advisor,"not-a-uuid",false,false,"")}}
  assertThrows(IllegalArgumentException::class.java){runBlocking{repo.review(advisor,proposal,false,false,"a".repeat(1001))}}
 }
}
