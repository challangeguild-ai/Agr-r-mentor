package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** The PostgreSQL RPC verifies advisor authorization and the submitted state. */
class AdvisorTaskReview(private val baseUrl:String,private val publishableKey:String){
 suspend fun review(session:AuthorizedSession,task:AdvisorTask,approve:Boolean,note:String) = withContext(Dispatchers.IO){
  require(session.role==PortalRole.ADVISOR)
  require(task.id.matches(Regex("[a-fA-F0-9-]{36}")))
  require(task.status=="submitted"&&task.reportDate!=null&&task.taskKind=="general"&&task.fieldId==null){
   "Csak a látható, általános feladathoz tartozó teljesítési riport hagyható jóvá."
  }
  require(note.length<=1500&& (approve||note.isNotBlank()))
  val request=JSONObject().put("p_task_id",task.id).put("p_approve",approve).put("p_note",note.trim().ifBlank{null})
  val connection=(URL("${baseUrl.trimEnd('/')}/rest/v1/rpc/review_task_execution").openConnection() as HttpURLConnection).apply{
   requestMethod="POST";connectTimeout=12000;readTimeout=12000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
   setRequestProperty("Content-Type","application/json")
   doOutput=true
   outputStream.use{it.write(request.toString().toByteArray(Charsets.UTF_8))}
  }
  try{
   if(connection.responseCode !in 200..299)error("A szerver elutasította a döntést (${connection.responseCode}).")
  }finally{connection.disconnect()}
 }
}
