package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertThrows
import org.junit.Test

class AdvisorCatalogRepositoryTest {
 @Test fun farmerCannotInspectAdvisorImportCatalog(){
  val repo=AdvisorCatalogRepository("https://example.supabase.co","public-test-key")
  val farmer=AuthorizedSession(PortalRole.FARMER,"token","id","",0L)
  assertThrows(IllegalArgumentException::class.java){runBlocking{repo.load(farmer)}}
 }
}
