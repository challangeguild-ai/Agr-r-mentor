package hu.agrarmentor.android.data

import org.json.JSONObject
import java.time.Instant

/** Only a stored TASKPROOF report can be displayed as GPS/foto evidence. */
data class AdvisorTaskEvidence(
 val latitude:Double,
 val longitude:Double,
 val accuracyMeters:Double,
 val capturedAt:String,
 val validation:String,
 val photoPath:String,
 val photoName:String,
 val distanceMeters:Double?,
 val actualDose:String?,
 val doseUnit:String?,
 val actualArea:String?,
 val actualQuantity:String?,
 val quantityUnit:String?,
 val weather:String?,
 val finishedHours:String?,
 val workedHectares:String?
){
 companion object {
  fun parse(proof:String?,report:JSONObject,taskId:String,assignedTo:String?):AdvisorTaskEvidence? {
   if(proof==null||!proof.startsWith("TASKPROOF:"))return null
   val data=runCatching{JSONObject(proof.removePrefix("TASKPROOF:"))}.getOrNull()?:return null
   val lat=data.optDouble("lat",Double.NaN)
   val lng=data.optDouble("lng",Double.NaN)
   val accuracy=data.optDouble("accuracy",Double.NaN)
   val capturedAt=data.optString("capturedAt")
   val validation=data.optString("validation")
   val path=data.optString("photoPath")
   val name=data.optString("photoName")
   if(!lat.isFinite()||lat !in -90.0..90.0||!lng.isFinite()||lng !in -180.0..180.0||
    !accuracy.isFinite()||accuracy<=0||accuracy>200||
    validation !in setOf("inside_boundary","near_boundary","near_center")||
    runCatching{Instant.parse(capturedAt)}.isFailure||
    name.isBlank()||name.length>255||path.length>512||assignedTo.isNullOrBlank()||
    !path.startsWith("$assignedTo/task-proofs/$taskId/")||
    path.split('/').any{it=="."||it==".."})return null
   return AdvisorTaskEvidence(lat,lng,accuracy,capturedAt,validation,path,name,
    if(data.isNull("distanceMeters"))null else data.optDouble("distanceMeters").takeIf{it.isFinite()},
    report.optionalText("actual_dose"),report.optionalText("dose_unit"),
    report.optionalText("actual_area"),report.optionalText("actual_quantity"),
    report.optionalText("quantity_unit"),report.optionalText("weather"),
    report.optionalText("finished_hours"),report.optionalText("worked_hectares"))
  }
  private fun JSONObject.optionalText(name:String)=if(isNull(name))null else optString(name).ifBlank{null}
 }
}

data class AdvisorTaskPlan(
 val operationType:String?,val productName:String?,val crop:String?,val target:String?,
 val plannedDose:String?,val doseUnit:String?,val doseMin:String?,val doseMax:String?,
 val plannedArea:String?,val plannedQuantity:String?
)
