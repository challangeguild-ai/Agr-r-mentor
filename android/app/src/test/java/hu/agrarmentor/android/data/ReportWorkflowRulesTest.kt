package hu.agrarmentor.android.data

import org.junit.Assert.*
import org.junit.Test

class ReportWorkflowRulesTest {
 @Test fun reportRequiresValidTitleCategorySeverityAndLength(){
  assertTrue(ReportWorkflowRules.validDraft("Sárgulás","Déli sorok","crop_health","high"))
  assertFalse(ReportWorkflowRules.validDraft("   ","Leírás","crop_health","normal"))
  assertFalse(ReportWorkflowRules.validDraft("Jelzés","Leírás","fake_category","normal"))
  assertFalse(ReportWorkflowRules.validDraft("Jelzés","Leírás","weed","fake_severity"))
  assertFalse(ReportWorkflowRules.validDraft("Jelzés","x".repeat(5001),"weed","urgent"))
 }

 @Test fun uncertainReportRetryMustKeepExactlySameDraft(){
  val first=ReportDraftIdentity("field1","Jelzés","Részletek","other","normal")
  assertTrue(ReportWorkflowRules.sameDraft(first,first.copy()))
  assertFalse(ReportWorkflowRules.sameDraft(first,first.copy(fieldId="field2")))
  assertFalse(ReportWorkflowRules.sameDraft(first,first.copy(message="Új szöveg")))
 }

 @Test fun advisorCannotWriteIntoClosedCase(){
  assertTrue(ReportWorkflowRules.canRespond("new",false,"Válasz"))
  assertTrue(ReportWorkflowRules.canRespond("reviewed",false,"Új megállapítás"))
  assertFalse(ReportWorkflowRules.canRespond("closed",false,"További válasz"))
  assertFalse(ReportWorkflowRules.canRespond("new",false,"  "))
  assertTrue(ReportWorkflowRules.canRespond("reviewed",true,""))
 }
}
