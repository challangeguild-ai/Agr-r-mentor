package hu.agrarmentor.android.data

import org.junit.Assert.*
import org.junit.Test

class ReportMediaRulesTest {
 @Test fun onlySupportedImagesAndVideosWithinSizeLimit(){
  for(type in listOf("image/jpeg","image/png","image/webp","video/mp4","video/webm","video/quicktime"))
   assertTrue(ReportMediaRules.valid(type,50L*1024*1024))
  assertFalse(ReportMediaRules.valid("application/x-executable",1024))
  assertFalse(ReportMediaRules.valid("image/jpeg",50L*1024*1024+1))
  assertFalse(ReportMediaRules.valid("image/jpeg",0))
  assertEquals("image",ReportMediaRules.kind("image/webp"))
  assertEquals("video",ReportMediaRules.kind("video/mp4"))
 }

 @Test fun namesCannotEscapeStorageDirectory(){
  assertEquals("report.jpg",ReportMediaRules.safeName("report.jpg"))
  assertEquals(".._secret.png",ReportMediaRules.safeName("../secret.png"))
  assertEquals("csatolmany",ReportMediaRules.safeName(""))
 }

 @Test fun uncertainRetryRequiresSameSelectedFiles(){
  val original=ReportDraftIdentity("field","subject","details","other","high",listOf("content://one","content://two"))
  assertTrue(ReportWorkflowRules.sameDraft(original,original.copy()))
  assertFalse(ReportWorkflowRules.sameDraft(original,original.copy(mediaKeys=listOf("content://two"))))
 }
}
