package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/** The PostgreSQL RPC verifies advisor authorization and the submitted state. */
class AdvisorTaskReview(private val baseUrl:String,private val publishableKey:String){
 suspend fun review(session:AuthorizedSession,task:AdvisorTask,approve:Boolean,note:String) = withContext(Dispatchers.IO){
  require(session.role==PortalRole.ADVISOR)
  require(task.id.matches(Regex("[a-fA-F0-9-]{36}")))
  require(task.status=="submitted"&&task.reportDate!=null&&task.reportReviewStatus=="pending"){
   "Csak ellenőrzésre váró, olvasható teljesítési riport bírálható el."
  }
  require(task.fieldId!=null||task.taskKind=="general")
  if(approve&&task.fieldId!=null)require(task.evidence!=null){"A GPS- és fotóigazolás nélkül nem hagyható jóvá a tábla munka."}
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
   if(connection.responseCode !in 200..299){
    val reason=runCatching{JSONObject(connection.errorStream?.bufferedReader()?.use{it.readText()}?:"").optString("message")}.getOrDefault("")
    error(if(reason.isNotBlank())reason.take(500)else"A szerver elutasította a döntést (${connection.responseCode}).")
   }
  }finally{connection.disconnect()}
  // Do not roll back a committed review because delivery of a notification fails.
  val recipient=task.assignedTo
  if(recipient!=null&&recipient.matches(Regex("[a-fA-F0-9-]{36}")))runCatching{
   val notification=JSONObject().put("user_id",recipient)
    .put("kind",if(approve)"task_verified"else"task_revision")
    .put("title",if(approve)"Munka visszaigazolva"else"Munka javításra visszaküldve")
    .put("message",if(approve)"${task.title} – a szaktanácsadó visszaigazolta."
     else "${task.title} – ${note.trim()}")
    .put("href","/tasks")
   val notice=(URL("${baseUrl.trimEnd('/')}/rest/v1/notifications").openConnection() as HttpURLConnection).apply{
    requestMethod="POST";connectTimeout=12000;readTimeout=12000
    setRequestProperty("apikey",publishableKey)
    setRequestProperty("Authorization","Bearer ${session.accessToken}")
    setRequestProperty("Content-Type","application/json")
    doOutput=true
    outputStream.use{it.write(notification.toString().toByteArray(Charsets.UTF_8))}
   }
   try{check(notice.responseCode in 200..299)}finally{notice.disconnect()}
  }
 }

 /** One-minute URL; Storage RLS must allow the advisor to read the proof. */
 suspend fun photoUrl(session:AuthorizedSession,task:AdvisorTask):String=withContext(Dispatchers.IO){
  require(session.role==PortalRole.ADVISOR)
  val path=task.evidence?.photoPath?:error("Hiányzik a hitelesíthető helyszíni fotó.")
  require(task.assignedTo!=null&&path.startsWith("${task.assignedTo}/task-proofs/${task.id}/"))
  val encoded=path.split('/').also{segments->require(segments.all{it.isNotBlank()&&it!="."&&it!=".."})}
   .joinToString("/"){URLEncoder.encode(it,"UTF-8").replace("+","%20")}
  val connection=(URL("${baseUrl.trimEnd('/')}/storage/v1/object/sign/farmer-report-media/$encoded").openConnection() as HttpURLConnection).apply{
   requestMethod="POST";connectTimeout=12000;readTimeout=12000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
   setRequestProperty("Content-Type","application/json")
   doOutput=true
   outputStream.use{it.write("{\"expiresIn\":60}".toByteArray(Charsets.UTF_8))}
  }
  val response=try{
   if(connection.responseCode !in 200..299)error("A fénykép nem érhető el (${connection.responseCode}).")
   JSONObject(connection.inputStream.bufferedReader().use{it.readText()})
  }finally{connection.disconnect()}
  val signed=response.optString("signedURL").ifBlank{response.optString("signedUrl")}.trimStart('/')
  require(signed.startsWith("object/sign/farmer-report-media/")||signed.startsWith("storage/v1/object/sign/farmer-report-media/"))
  "${baseUrl.trimEnd('/')}/${if(signed.startsWith("storage/v1/"))signed else "storage/v1/$signed"}"
 }
}
