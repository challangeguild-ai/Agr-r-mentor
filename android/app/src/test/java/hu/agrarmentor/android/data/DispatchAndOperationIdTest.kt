package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertThrows
import org.junit.Test

class DispatchAndOperationIdTest{
 private val url="https://example.supabase.co"
 private val key="publishable-test-key"

 @Test fun dispatchChoicesRejectMalformedUserUuidBeforeNetwork(){
  val repository=TaskDispatchRepository(url,key)
  for(userId in listOf("-".repeat(36),"11111111-2222-3333-4444-555555555555&select=*","invalid")){
   val session=AuthorizedSession(PortalRole.FARMER,"token",userId,"",0L)
   assertThrows(IllegalArgumentException::class.java){runBlocking{repository.choices(session)}}
  }
 }

 @Test fun operationFieldChoicesRejectMalformedUserUuidBeforeNetwork(){
  val repository=OperationCreateRepository(url,key)
  for(userId in listOf("-".repeat(36),"11111111-2222-3333-4444-555555555555&select=*","invalid")){
   val session=AuthorizedSession(PortalRole.FARMER,"token",userId,"",0L)
   assertThrows(IllegalArgumentException::class.java){runBlocking{repository.ownedFields(session)}}
  }
 }
}
