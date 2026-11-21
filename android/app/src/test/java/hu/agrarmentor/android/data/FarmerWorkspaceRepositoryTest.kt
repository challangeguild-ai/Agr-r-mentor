package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertThrows
import org.junit.Test

class FarmerWorkspaceRepositoryTest{
 private val session=AuthorizedSession(PortalRole.FARMER,"token","11111111-2222-3333-4444-555555555555","",0L)

 @Test fun fieldDetailRejectsMalformedIdsBeforeAnyRequest(){
  val repository=FarmerWorkspaceRepository("https://example.supabase.co","publishable-test-key")
  for(id in listOf("-".repeat(36),"11111111-2222-3333-4444-555555555555&select=*","other","")){
   assertThrows(IllegalArgumentException::class.java){runBlocking{repository.field(session,id)}}
  }
 }
}
