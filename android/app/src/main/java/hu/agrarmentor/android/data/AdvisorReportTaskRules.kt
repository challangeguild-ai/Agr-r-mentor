package hu.agrarmentor.android.data

import java.nio.charset.StandardCharsets
import java.time.LocalDate
import java.util.UUID

data class AdvisorReportTaskInput(val title:String,val dueDate:String?,val priority:String)

internal object AdvisorReportTaskRules {
 private val priorities=setOf("normal","high","urgent")

 fun validate(input:AdvisorReportTaskInput):Boolean =
  input.title.trim().length in 1..180 && input.priority in priorities &&
   (input.dueDate.isNullOrBlank()||runCatching{LocalDate.parse(input.dueDate)}.isSuccess)

 /** Same source report and reply always refer to the same task on uncertain retries. */
 fun stableId(reportId:String,reply:String):String {
  require(validMapFieldId(reportId)&&reply.trim().isNotEmpty())
  val identity="agrar-mentor:report-task:v1:$reportId:${reply.trim()}"
  return UUID.nameUUIDFromBytes(identity.toByteArray(StandardCharsets.UTF_8)).toString()
 }
}
