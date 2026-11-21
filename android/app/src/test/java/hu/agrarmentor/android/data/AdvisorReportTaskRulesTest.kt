package hu.agrarmentor.android.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class AdvisorReportTaskRulesTest {
 private val reportId="11111111-2222-3333-4444-555555555555"

 @Test fun taskFieldsAreCheckedBeforeMutatingTheReport(){
  assertTrue(AdvisorReportTaskRules.validate(AdvisorReportTaskInput("Állomány ellenőrzése",null,"normal")))
  assertTrue(AdvisorReportTaskRules.validate(AdvisorReportTaskInput("Sürgős szemle","2026-12-01","urgent")))
  assertFalse(AdvisorReportTaskRules.validate(AdvisorReportTaskInput("  ",null,"normal")))
  assertFalse(AdvisorReportTaskRules.validate(AdvisorReportTaskInput("x".repeat(181),null,"normal")))
  assertFalse(AdvisorReportTaskRules.validate(AdvisorReportTaskInput("Szemle","2026-02-30","high")))
  assertFalse(AdvisorReportTaskRules.validate(AdvisorReportTaskInput("Szemle",null,"unknown")))
 }

 @Test fun sameReportAndReplyYieldTheSameTaskIdAcrossRetries(){
  val original=AdvisorReportTaskRules.stableId(reportId,"  Ellenőrzés szükséges  ")
  assertEquals(original,AdvisorReportTaskRules.stableId(reportId,"Ellenőrzés szükséges"))
  assertFalse(original==AdvisorReportTaskRules.stableId(reportId,"Másik válasz"))
  assertTrue(validMapFieldId(original))
  assertThrows(IllegalArgumentException::class.java){AdvisorReportTaskRules.stableId("invalid","Válasz")}
 }
}
