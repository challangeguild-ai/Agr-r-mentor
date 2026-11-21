package hu.agrarmentor.android.data

import org.junit.Assert.*
import org.junit.Test
import hu.agrarmentor.android.model.PortalRole

class DocumentUploadRulesTest {
 @Test fun uploadsRequireFarmerOrAdvisorRole(){
  assertTrue(DocumentUploadRules.canUpload(PortalRole.FARMER))
  assertTrue(DocumentUploadRules.canUpload(PortalRole.ADVISOR))
  assertFalse(DocumentUploadRules.canUpload(PortalRole.SYSTEM_ADMIN))
 }
 @Test fun acceptsOnlyBucketSupportedFiles(){
  for(type in listOf("application/pdf","image/jpeg","image/png","image/webp","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
   assertTrue(DocumentUploadRules.validFile(type,DocumentUploadRules.MAX_BYTES))
  assertFalse(DocumentUploadRules.validFile("application/zip",1024))
  assertFalse(DocumentUploadRules.validFile("application/pdf",0))
  assertFalse(DocumentUploadRules.validFile("application/pdf",DocumentUploadRules.MAX_BYTES+1))
 }

 @Test fun requiresValidMetadata(){
  assertTrue(DocumentUploadRules.validDetails("Talajvizsgálati jegyzőkönyv","Eredmény","talajvizsgalat"))
  assertFalse(DocumentUploadRules.validDetails("   ","","egyeb"))
  assertFalse(DocumentUploadRules.validDetails("Jegyzőkönyv","","rendszeradmin"))
  assertFalse(DocumentUploadRules.validDetails("J","a".repeat(501),"egyeb"))
 }

 @Test fun storedPathCannotContainDirectoryTraversal(){
  assertEquals(".._szamla.pdf",DocumentUploadRules.safeName("../szamla.pdf"))
  assertEquals("dokumentum",DocumentUploadRules.safeName(""))
 }
}
