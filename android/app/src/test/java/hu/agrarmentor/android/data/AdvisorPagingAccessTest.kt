package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertThrows
import org.junit.Test

class AdvisorPagingAccessTest{
 private val farmer=AuthorizedSession(PortalRole.FARMER,"token","11111111-2222-3333-4444-555555555555","",0L)
 private val advisor=AuthorizedSession(PortalRole.ADVISOR,"token","invalid-user-id","",0L)
 private val url="https://example.supabase.co"
 private val key="publishable-test-key"

 @Test fun advisorMapQualityRejectsFarmerBeforeNetwork(){
  assertThrows(IllegalArgumentException::class.java){runBlocking{
   AdvisorMapQualityRepository(url,key).load(farmer)
  }}
 }

 @Test fun advisorWorkdayRejectsFarmerAndMalformedUserIdBeforeNetwork(){
  for(session in listOf(farmer,advisor)){
   assertThrows(IllegalArgumentException::class.java){runBlocking{
    AdvisorWorkdayRepository(url,key).load(session)
   }}
  }
 }

 @Test fun advisorBoundaryQueueRejectsFarmerAndMalformedUserIdBeforeNetwork(){
  for(session in listOf(farmer,advisor)){
   assertThrows(IllegalArgumentException::class.java){runBlocking{
    AdvisorBoundaryRepository(url,key).queue(session)
   }}
  }
 }
}
