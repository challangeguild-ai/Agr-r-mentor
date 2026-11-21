package hu.agrarmentor.android.data

import org.junit.Assert.*
import org.junit.Test

class PostgrestPagingTest{
 @Test fun fieldListsContinueBeyondSupabaseDefaultThousandRows(){
  val requested=mutableListOf<String>()
  val rows=collectPostgrestPages("fields?select=id,name&order=name.asc,id.asc",pageSize=500){path->
   requested.add(path)
   val offset=path.substringAfter("offset=").toInt()
   (offset until minOf(offset+500,1205)).toList()
  }
  assertEquals(1205,rows.size)
  assertEquals((0 until 1205).toList(),rows)
  assertEquals(listOf(
   "fields?select=id,name&order=name.asc,id.asc&limit=500&offset=0",
   "fields?select=id,name&order=name.asc,id.asc&limit=500&offset=500",
   "fields?select=id,name&order=name.asc,id.asc&limit=500&offset=1000"
  ),requested)
 }

 @Test fun anExactPageBoundaryFetchesAnEmptyFinalPage(){
  var calls=0
  val result=collectPostgrestPages("farms?select=id&order=id.asc",pageSize=2){path->
   calls++
   val offset=path.substringAfter("offset=").toInt()
   (offset until minOf(offset+2,4)).toList()
  }
  assertEquals(listOf(0,1,2,3),result)
  assertEquals(3,calls)
 }

 @Test fun aLaterFailedPageCannotProduceAnIncompleteFieldList(){
  var calls=0
  assertThrows(IllegalStateException::class.java){
   collectPostgrestPages("fields?select=id&order=id.asc",pageSize=2){
    calls++
    if(calls==2)error("Hálózati hiba a második lapon")
    listOf(1,2)
   }
  }
  assertEquals(2,calls)
 }

 @Test fun paginationFailsClosedOnIgnoredOffsetsAndMalformedRequests(){
  assertThrows(IllegalStateException::class.java){
   collectPostgrestPages("fields?select=id&order=id.asc",pageSize=2,maxPages=3){listOf(1,2)}
  }
  assertThrows(IllegalArgumentException::class.java){
   collectPostgrestPages("fields?select=id&limit=1000"){listOf(1)}
  }
  assertThrows(IllegalStateException::class.java){
   collectPostgrestPages("fields?select=id",pageSize=2){listOf(1,2,3)}
  }
 }
}
