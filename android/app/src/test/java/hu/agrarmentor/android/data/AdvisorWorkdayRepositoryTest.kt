package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class AdvisorWorkdayRepositoryTest {
 @Test fun utcVisitTimestampsUseHungarianCalendarDays(){
  assertEquals("2026-11-21",workdayHungarianDay("2026-11-20T23:30:00Z"))
  assertEquals("2026-11-20",workdayHungarianDay("2026-11-20"))
  assertNull(workdayHungarianDay(null))
  assertNull(workdayHungarianDay("not-a-date"))
 }

 @Test fun onlyPlannedVisitsBecomeWorkdayEntries(){
  val planned="ADVISORVISIT:{\"scheduledAt\":\"2026-11-20T23:30:00Z\",\"purpose\":\"Talajvizsgálat\",\"status\":\"planned\"}"
  assertEquals(PlannedAdvisorVisit("2026-11-21","Talajvizsgálat","00:30"),decodePlannedAdvisorVisit(planned))
  assertNull(decodePlannedAdvisorVisit(planned.replace("planned","completed")))
  assertNull(decodePlannedAdvisorVisit("other:message"))
  assertNull(decodePlannedAdvisorVisit("ADVISORVISIT:{"))
 }

 @Test fun overdueAndUnscheduledItemsAreSeparate(){
  val items=listOf(
   AdvisorWorkdayItem(WorkdayKind.TASK,"Késő feladat","Föld", "2026-11-19"),
   AdvisorWorkdayItem(WorkdayKind.TASK,"Mai feladat","Föld","2026-11-20"),
   AdvisorWorkdayItem(WorkdayKind.TASK,"Dátum nélkül","Föld",null),
   AdvisorWorkdayItem(WorkdayKind.VISIT,"Holnap látogatás","Föld","2026-11-21")
  )
  assertEquals(1,workdayOverdueItems(items,"2026-11-20").size)
  assertEquals("Mai feladat",workdayItemsForDay(items,"2026-11-20").single().title)
  assertEquals("Dátum nélkül",workdayUnscheduledTasks(items).single().title)
 }

 @Test fun workdayRequiresAdvisorBeforeAccessingNetwork(){
  val repo=AdvisorWorkdayRepository("https://example.supabase.co","public-test-key")
  val farmer=AuthorizedSession(PortalRole.FARMER,"token","11111111-1111-1111-1111-111111111111","",0L)
  assertThrows(IllegalArgumentException::class.java){runBlocking{repo.load(farmer)}}
  assertThrows(IllegalArgumentException::class.java){runBlocking{repo.load(farmer.copy(role=PortalRole.ADVISOR,userId="invalid&role=eq.admin"))}}
 }
}
