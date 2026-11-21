package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertThrows
import org.junit.Test

class TaskIdentifierGuardsTest{
 private val userId="11111111-2222-3333-4444-555555555555"
 private val farmer=AuthorizedSession(PortalRole.FARMER,"token",userId,"",0L)
 private val advisor=AuthorizedSession(PortalRole.ADVISOR,"token",userId,"",0L)
 private val url="https://example.supabase.co"
 private val key="publishable-test-key"

 @Test fun generalTaskCannotSubmitMalformedIdentifiers(){
  for(id in listOf("-".repeat(36),"11111111-2222-3333-4444-555555555555&limit=1")){
   val task=MobileTask(id,"Általános munka","Gazdaság",null,"normal","open",null,
    taskKind="general",assignedTo=userId)
   assertThrows(IllegalArgumentException::class.java){runBlocking{
    GeneralTaskCompletion(url,key).submit(farmer,task,"Munka befejezve")
   }}
  }
 }

 @Test fun advisorCannotReviewMalformedTaskIdentifiers(){
  val task=AdvisorTask("-".repeat(36),"Feladat","Gazdaság","submitted","normal",null,
   taskKind="general",reportDate="2026-11-21",reportReviewStatus="pending")
  assertThrows(IllegalArgumentException::class.java){runBlocking{
   AdvisorTaskReview(url,key).review(advisor,task,true,"")
  }}
 }
}
