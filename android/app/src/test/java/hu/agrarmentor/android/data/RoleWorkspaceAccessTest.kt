package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertThrows
import org.junit.Test

class RoleWorkspaceAccessTest{
 private val repository=RoleWorkspaceRepository("https://example.supabase.co","public-test-key")
 private fun session(role:PortalRole)=AuthorizedSession(role,"untrusted-token","11111111-1111-1111-1111-111111111111","",0L)

 @Test fun noFarmerCanReadAdvisorPortfolio(){
  assertThrows(IllegalArgumentException::class.java){runBlocking{repository.advisor(session(PortalRole.FARMER))}}
 }

 @Test fun neitherFarmerNorAdvisorCanUseSystemAdminRepository(){
  for(role in listOf(PortalRole.FARMER,PortalRole.ADVISOR)){
   assertThrows(IllegalArgumentException::class.java){runBlocking{repository.admin(session(role))}}
  }
 }
}
