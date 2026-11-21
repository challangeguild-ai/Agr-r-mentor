package hu.agrarmentor.android.data

/**
 * Supabase/PostgREST commonly caps a single request at 1,000 rows. Fetch every
 * RLS-visible page, or fail the whole read: a partial field list must never be
 * mistaken for a complete farm or map.
 *
 * Callers must give the query a deterministic order with a unique tie-breaker.
 */
internal fun <T> collectPostgrestPages(
 path:String,
 pageSize:Int=500,
 maxPages:Int=100,
 fetchPage:(String)->List<T>
):List<T>{
 require(pageSize in 1..1000&&maxPages>0)
 require(!Regex("(?:[?&])(?:limit|offset)=").containsMatchIn(path))
 val result=ArrayList<T>()
 var offset=0
 repeat(maxPages){
  val separator=if('?' in path)'&' else '?'
  val page=fetchPage("$path${separator}limit=$pageSize&offset=$offset")
  check(page.size<=pageSize){"A lekérdezés a kért lapméretnél több rekordot adott vissza."}
  result.addAll(page)
  if(page.size<pageSize)return result
  offset+=pageSize
 }
 error("A teljes adathalmaz a lapozási biztonsági korlát fölé nőtt.")
}
