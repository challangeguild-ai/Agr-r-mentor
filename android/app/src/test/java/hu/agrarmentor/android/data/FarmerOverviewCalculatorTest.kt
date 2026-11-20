package hu.agrarmentor.android.data

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

class FarmerOverviewCalculatorTest {
 private val today=LocalDate.of(2026,11,20)
 private fun field(id:String,condition:String?,area:String="10.5",active:Boolean=true)=
  FieldSummary(id,"Tábla $id","Teszt gazdaság",area,"Búza",active,condition,0)
 private fun task(title:String,status:String="open",priority:String="normal",due:String?=null)=
  MobileTask(title,title,"Tábla",due,priority,status,null)

 @Test fun countsFarmAreaAndLatestAttentionStates(){
  val result=FarmerOverviewCalculator.calculate(listOf(field("a","critical"),field("b","attention","5,25"),field("c",null,"—",false)),emptyList(),today)
  assertEquals(3,result.fieldsCount)
  assertEquals(2,result.activeFieldsCount)
  assertEquals(15.75,result.totalAreaHa,0.001)
  assertEquals(2,result.attentionFieldsCount)
  assertEquals(1,result.criticalFieldsCount)
  assertEquals("a",result.attentionFields.first().id)
 }

 @Test fun overdueAndWaitingReviewAreDifferentStates(){
  val result=FarmerOverviewCalculator.calculate(emptyList(),listOf(
   task("late",due="2026-11-18"),
   task("urgent",priority="high",due="2026-11-25"),
   task("submitted",status="submitted",due="2026-11-18"),
   task("done",status="done",due="2026-11-01"),
   task("cancelled",status="cancelled",due="2026-11-01")
  ),today)
  assertEquals(3,result.openTasksCount)
  assertEquals(1,result.overdueTasksCount)
  assertEquals(1,result.waitingReviewCount)
  assertEquals(listOf("late","urgent"),result.priorityTasks.map{it.title})
 }

 @Test fun malformedDatesDoNotCrashOrBecomeOverdue(){
  val result=FarmerOverviewCalculator.calculate(emptyList(),listOf(task("unknown",due="not-a-date")),today)
  assertEquals(0,result.overdueTasksCount)
  assertEquals("unknown",result.priorityTasks.first().title)
 }
}
