package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertThrows
import org.junit.Test

class CatalogAndCommunicationIdTest{
 private val url="https://example.supabase.co"
 private val key="publishable-test-key"
 private val valid=AuthorizedSession(PortalRole.FARMER,"token","11111111-2222-3333-4444-555555555555","",0L)

 @Test fun catalogUseAndApproverQueriesRejectInvalidIdentifiersBeforeNetwork(){
  val repo=PlantProtectionCatalogRepository(url,key)
  for(id in listOf("-".repeat(36),"11111111-2222-3333-4444-555555555555&select=*","invalid")){
   assertThrows(IllegalArgumentException::class.java){runBlocking{repo.uses(valid,id)}}
   assertThrows(IllegalArgumentException::class.java){runBlocking{repo.approvers(valid,id)}}
  }
 }

 @Test fun approvalAndCommunicationQueriesRejectMalformedCallerIdsBeforeNetwork(){
  val approval=OperationApprovalRepository(url,key)
  val communication=CommunicationRepository(url,key)
  for(id in listOf("-".repeat(36),"11111111-2222-3333-4444-555555555555&limit=10","invalid")){
   val session=AuthorizedSession(PortalRole.FARMER,"token",id,"",0L)
   assertThrows(IllegalArgumentException::class.java){runBlocking{approval.approvals(session)}}
   assertThrows(IllegalArgumentException::class.java){runBlocking{communication.notifications(session)}}
   assertThrows(IllegalArgumentException::class.java){runBlocking{communication.reportFields(session)}}
  }
 }
}
