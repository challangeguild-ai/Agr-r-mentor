package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import java.time.LocalDate
import java.time.ZoneId

data class FarmerOverview(
 val fieldsCount:Int,
 val activeFieldsCount:Int,
 val totalAreaHa:Double,
 val openTasksCount:Int,
 val overdueTasksCount:Int,
 val waitingReviewCount:Int,
 val attentionFieldsCount:Int,
 val criticalFieldsCount:Int,
 val attentionFields:List<FieldSummary>,
 val priorityTasks:List<MobileTask>
)

/** Deterministic, testable dashboard rules shared by the live mobile home screen. */
object FarmerOverviewCalculator {
 fun calculate(fields:List<FieldSummary>,tasks:List<MobileTask>,today:LocalDate):FarmerOverview {
  val open=tasks.filter{it.status !in setOf("done","cancelled")}
  val actionable=open.filter{it.status!="submitted"}
  val overdue=actionable.filter{dueDay(it.dueDate)?.isBefore(today)==true}
  val important=actionable.sortedWith(
   compareBy<MobileTask> { task ->
    when {
     dueDay(task.dueDate)?.isBefore(today)==true -> 0
     task.priority in setOf("urgent","high") -> 1
     dueDay(task.dueDate)?.let{!it.isAfter(today.plusDays(3))}==true -> 2
     else -> 3
    }
   }.thenBy{dueDay(it.dueDate)?:LocalDate.MAX}.thenBy{it.title}
  )
  val needingAttention=fields.filter{it.condition in setOf("attention","critical")}
   .sortedWith(compareBy<FieldSummary>{if(it.condition=="critical")0 else 1}.thenBy{it.name})
  return FarmerOverview(
   fieldsCount=fields.size,
   activeFieldsCount=fields.count{it.isActive},
   totalAreaHa=fields.sumOf{it.areaHa.replace(',','.').toDoubleOrNull()?:0.0},
   openTasksCount=open.size,
   overdueTasksCount=overdue.size,
   waitingReviewCount=open.count{it.status=="submitted"},
   attentionFieldsCount=needingAttention.size,
   criticalFieldsCount=needingAttention.count{it.condition=="critical"},
   attentionFields=needingAttention.take(4),
   priorityTasks=important.take(5)
  )
 }

 private fun dueDay(value:String?):LocalDate? =
  value?.takeIf{it.isNotBlank()}?.let{runCatching{LocalDate.parse(it.take(10))}.getOrNull()}
}

/** Uses existing RLS-aware repositories; no new backend or schema. */
class FarmerOverviewRepository(baseUrl:String,publishableKey:String){
 private val fields=FieldRepository(baseUrl,publishableKey)
 private val work=FarmerWorkspaceRepository(baseUrl,publishableKey)

 suspend fun load(session:AuthorizedSession):FarmerOverview = coroutineScope {
  val fieldList=async{fields.load(session)}
  val tasks=async{work.tasks(session)}
  val today=LocalDate.now(ZoneId.of("Europe/Budapest"))
  FarmerOverviewCalculator.calculate(fieldList.await(),tasks.await(),today)
 }
}
