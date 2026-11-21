package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.assertThrows
import org.junit.Test

class DocumentDeletionRulesTest {
 private val uploader="11111111-2222-3333-4444-555555555555"
 private val another="66666666-7777-8888-9999-aaaaaaaaaaaa"

 @Test fun originalUploaderCanDeleteButAnotherFarmerAndSystemAdminCannot(){
  assertTrue(DocumentDeletionRules.canDelete(PortalRole.FARMER,uploader,uploader))
  assertFalse(DocumentDeletionRules.canDelete(PortalRole.FARMER,another,uploader))
  assertTrue(DocumentDeletionRules.canDelete(PortalRole.ADVISOR,another,uploader))
  assertFalse(DocumentDeletionRules.canDelete(PortalRole.SYSTEM_ADMIN,uploader,uploader))
  assertFalse(DocumentDeletionRules.canDelete(PortalRole.ADVISOR,"$another&select=*",uploader))
 }

 @Test fun storagePathMustBelongToTheRecordedUploader(){
  assertTrue(DocumentDeletionRules.safeStoredPath(uploader,"$uploader/scan-2026.pdf"))
  assertFalse(DocumentDeletionRules.safeStoredPath(uploader,"$another/file.pdf"))
  assertFalse(DocumentDeletionRules.safeStoredPath(uploader,"$uploader/../file.pdf"))
  assertFalse(DocumentDeletionRules.safeStoredPath(uploader,"$uploader/"))
  assertFalse(DocumentDeletionRules.safeStoredPath(uploader,"$uploader/dir\\file.pdf"))
 }

 @Test fun malformedIdsAndForeignDocumentsNeverReachDeleteRequest(){
  val repo=CommunicationRepository("https://example.supabase.co","test-publishable")
  val session=AuthorizedSession(PortalRole.FARMER,"token",another,"",0L)
  fun doc(id:String,owner:String,path:String)=MobileDocument(id,"Napló","scan.pdf","egyeb",path,"",null,owner)
  val validId="bbbbbbbb-cccc-dddd-eeee-ffffffffffff"
  assertThrows(IllegalArgumentException::class.java){runBlocking{repo.deleteDocument(session,doc(validId,uploader,"$uploader/scan.pdf"))}}
  assertThrows(IllegalArgumentException::class.java){runBlocking{repo.deleteDocument(session,doc("bad&limit=1",another,"$another/scan.pdf"))}}
  assertThrows(IllegalArgumentException::class.java){runBlocking{repo.deleteDocument(session,doc(validId,another,"$another/../scan.pdf"))}}
 }
}
