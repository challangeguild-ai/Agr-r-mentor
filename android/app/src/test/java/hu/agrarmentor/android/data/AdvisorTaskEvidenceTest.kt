package hu.agrarmentor.android.data

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class AdvisorTaskEvidenceTest {
 private val userId="12345678-1234-1234-1234-123456789abc"
 private val taskId="87654321-4321-4321-4321-cba987654321"
 private fun proof(path:String="$userId/task-proofs/$taskId/abc-photo.jpg",accuracy:Double=8.5,validation:String="inside_boundary")=
  "TASKPROOF:"+JSONObject().put("lat",47.5).put("lng",19.2).put("accuracy",accuracy)
   .put("capturedAt","2026-11-20T11:05:00.000Z").put("photoPath",path)
   .put("photoName","helyszini-foto.jpg").put("validation",validation).toString()

 @Test fun validProofAndActualDataAreRead(){
  val report=JSONObject().put("actual_dose",1.8).put("dose_unit","l/ha").put("actual_area",12.5)
  val parsed=AdvisorTaskEvidence.parse(proof(),report,taskId,userId)
  assertNotNull(parsed)
  assertEquals("inside_boundary",parsed!!.validation)
  assertEquals("1.8",parsed.actualDose)
  assertEquals("l/ha",parsed.doseUnit)
  assertEquals("12.5",parsed.actualArea)
 }

 @Test fun cannotUseSomeOtherTaskOrSomeOtherUsersPhoto(){
  val report=JSONObject()
  assertNull(AdvisorTaskEvidence.parse(proof(),report,"bad-task",userId))
  assertNull(AdvisorTaskEvidence.parse(proof(),report,taskId,"another-user"))
  assertNull(AdvisorTaskEvidence.parse(proof("$userId/task-proofs/$taskId/../secret.jpg"),report,taskId,userId))
 }

 @Test fun badGpsAndNonGpsProofAreNotApprovable(){
  val report=JSONObject()
  assertNull(AdvisorTaskEvidence.parse(proof(accuracy=201.0),report,taskId,userId))
  assertNull(AdvisorTaskEvidence.parse(proof(validation="outside"),report,taskId,userId))
  assertNull(AdvisorTaskEvidence.parse("GENERAL:done",report,taskId,userId))
  assertNull(AdvisorTaskEvidence.parse("TASKPROOF:not-json",report,taskId,userId))
 }
}
