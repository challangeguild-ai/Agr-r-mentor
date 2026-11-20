package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class AdvisorDossierRulesTest {
 @Test fun onlyActualOutstandingTasksCountAsOpen(){
  assertTrue(dossierTaskOpen("open"))
  assertTrue(dossierTaskOpen("in_progress"))
  assertFalse(dossierTaskOpen("submitted"))
  assertFalse(dossierTaskOpen("done"))
  assertFalse(dossierTaskOpen("cancelled"))
 }

 @Test fun overdueExcludesSubmittedCompletedAndToday(){
  val today="2026-11-20"
  assertTrue(dossierTaskOverdue("open","2026-11-19",today))
  assertFalse(dossierTaskOverdue("submitted","2026-11-19",today))
  assertFalse(dossierTaskOverdue("done","2026-11-19",today))
  assertFalse(dossierTaskOverdue("open","2026-11-20",today))
  assertFalse(dossierTaskOverdue("in_progress",null,today))
 }

 @Test fun dossierCannotBeRequestedAsFarmerOrWithForgedId(){
  val repository=RoleWorkspaceRepository("https://example.supabase.co","public-test-key")
  val farmer=AuthorizedSession(PortalRole.FARMER,"test","id","",0L)
  val advisor=farmer.copy(role=PortalRole.ADVISOR)
  assertThrows(IllegalArgumentException::class.java){runBlocking{
   repository.clientDossier(farmer,"11111111-1111-1111-1111-111111111111")
  }}
  assertThrows(IllegalArgumentException::class.java){runBlocking{
   repository.clientDossier(advisor,"11111111-1111-1111-1111-111111111111&role=eq.admin")
  }}
 }

 @Test fun prioritiesPutSubmittedAndUrgentWorkBeforeRoutineWork(){
  fun task(id:String,status:String,priority:String,date:String?)=AdvisorTask(id,id,"Tábla",status,priority,date)
  val ordered=priorityAdvisorTasks(listOf(
   task("normal","open","normal","2026-11-19"),
   task("done","done","urgent","2026-11-19"),
   task("urgent","open","urgent","2026-11-21"),
   task("submitted","submitted","normal","2026-11-22"),
   task("high","open","high","2026-11-19")
  )).map{it.id}
  assertEquals(listOf("submitted","urgent","high","normal"),ordered)
 }
}
