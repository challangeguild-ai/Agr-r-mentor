package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate
import java.time.ZoneId

/**
 * General, farm-wide tasks can be submitted without GPS only through the
 * database's audited, owner/assignee-checked RPC. Field tasks cannot use it.
 */
class GeneralTaskCompletion(private val baseUrl:String,private val publishableKey:String){
 suspend fun submit(session:AuthorizedSession,task:MobileTask,notes:String):Boolean = withContext(Dispatchers.IO){
  require(task.taskKind=="general"&&task.fieldId==null){"A földtáblás munkához GPS-igazolás szükséges."}
  require(task.assignedTo==session.userId){"Csak a saját feladatod jelentheted készre."}
  require(task.status in listOf("open","in_progress")){"Ez a feladat nem küldhető be."}
  val trimmed=notes.trim()
  require(trimmed.length in 3..1500){"A megjegyzés 3–1500 karakter lehet."}
  require(validMapFieldId(task.id))
  val date=LocalDate.now(ZoneId.of("Europe/Budapest")).toString()
  val body=JSONObject().put("p_task_id",task.id).put("p_notes",trimmed).put("p_operation_date",date)
  val connection=(URL("${baseUrl.trimEnd('/')}/rest/v1/rpc/submit_general_task_execution").openConnection() as HttpURLConnection).apply{
   requestMethod="POST";connectTimeout=12000;readTimeout=12000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
   setRequestProperty("Content-Type","application/json")
   doOutput=true
   outputStream.use{it.write(body.toString().toByteArray(Charsets.UTF_8))}
  }
  try{
   if(connection.responseCode !in 200..299)error("A beküldés nem sikerült (${connection.responseCode}).")
   connection.inputStream.bufferedReader().use{it.readText()}.trim()=="true"
  }finally{connection.disconnect()}
 }
}
