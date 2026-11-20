package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.UUID

data class TaskExecutionPlan(
 val operationType:String?=null,
 val productName:String?=null,
 val plannedDose:String?=null,
 val doseUnit:String?=null,
 val plannedArea:String?=null,
 val plannedQuantity:String?=null,
 val quantityUnit:String?=null
){val isSpraying:Boolean get()=operationType in listOf("spraying","plant_protection")}

data class GpsTaskPosition(val lat:Double,val lng:Double,val accuracyMeters:Float,val capturedAtMillis:Long){
 fun isFresh(now:Long=System.currentTimeMillis())=
  accuracyMeters.isFinite()&&accuracyMeters>0&&accuracyMeters<=200&&
   capturedAtMillis>0&&(now-capturedAtMillis) in -120_000L..900_000L
}

data class FieldProofInput(
 val task:MobileTask,val position:GpsTaskPosition,val photoBytes:ByteArray,
 val photoName:String,val actualDose:String,val actualArea:String,val actualQuantity:String,
 val weather:String,val notes:String,val finishedHours:String,val workedHectares:String
)

/**
 * The existing Supabase project is used. Fail closed while the audited GPS/photo
 * RPC migration remains staged. No service-role credential is embedded in Android.
 */
class FieldTaskCompletion(private val baseUrl:String,private val publishableKey:String){
 private data class Pending(val taskId:String,val name:String,val photo:ByteArray,val path:String)
 private var pending:Pending?=null

 suspend fun plan(session:AuthorizedSession,task:MobileTask):TaskExecutionPlan = withContext(Dispatchers.IO){
  requireUuid(task.id)
  val row=JSONArray(request("GET","rest/v1/task_operation_plans?select=operation_type,product_name,planned_dose,dose_unit,planned_area,planned_quantity,quantity_unit&task_id=eq.${task.id}&limit=1",session))
   .optJSONObject(0)
  TaskExecutionPlan(row?.optNullableText("operation_type"),row?.optNullableText("product_name"),
   row?.optNullableText("planned_dose"),row?.optNullableText("dose_unit"),row?.optNullableText("planned_area"),
   row?.optNullableText("planned_quantity"),row?.optNullableText("quantity_unit"))
 }

 suspend fun submit(session:AuthorizedSession,input:FieldProofInput,plan:TaskExecutionPlan):Boolean = withContext(Dispatchers.IO){
  val task=input.task
  requireUuid(task.id)
  require(task.fieldId!=null){"Ehhez a munkához nincs földtábla."}
  requireUuid(task.fieldId)
  require(task.assignedTo==session.userId){"Csak a saját munkádat igazolhatod."}
  require(task.status in listOf("open","in_progress")){"Ez a munka nem küldhető be."}
  require(input.position.isFresh()){ "Kérj új, legfeljebb 15 perces, 200 méteren belüli pontosságú GPS-mérést." }
  require(input.photoBytes.isNotEmpty()&&input.photoBytes.size<=15*1024*1024){"A fotó legfeljebb 15 MB lehet."}
  require(input.photoName.length in 1..255){"Érvénytelen fényképnév."}
  require(input.notes.length<=3000&&input.weather.length<=1000){"A megjegyzés túl hosszú."}
  if(plan.isSpraying)require(input.actualDose.isNotBlank()){ "Növényvédelmi munkánál kötelező a tényleges dózis." }
  val dose=decimal(input.actualDose);val area=decimal(input.actualArea);val quantity=decimal(input.actualQuantity)
  val hours=decimal(input.finishedHours);val hectares=decimal(input.workedHectares)

  // Missing marker means the production RPC may accept an unverified text proof.
  val policyVersion=runCatching{
   request("POST","rest/v1/rpc/verified_task_proof_policy_version",session,"{}".toByteArray()).trim().toIntOrNull()
  }.getOrNull()
  check(policyVersion==1){"A szerveroldali GPS-/fotóellenőrzés még nincs élesítve. A munka biztonságosan nem küldhető be."}

  val rows=JSONArray(request("GET","rest/v1/fields?select=id,center_lat,center_lng,boundary_geojson&id=eq.${task.fieldId}&limit=1",session))
  val field=rows.optJSONObject(0)?:error("A földtábla nem érhető el.")
  val geometry=FieldProofGeometry.verify(
   input.position.lat,input.position.lng,field.optJSONObject("boundary_geojson"),
   field.optNumber("center_lat"),field.optNumber("center_lng")
  )?:error("A GPS alapján nem vagy a földtáblán vagy annak megengedett közelében.")

  val previous=pending
  if(previous!=null&&previous.taskId!=task.id)error("Egy korábbi feltöltés még ellenőrzésre vár. Próbáld meg újra azt a munkát.")
  if(previous!=null&&(previous.name!=input.photoName||!previous.photo.contentEquals(input.photoBytes)))
   error("A korábbi fotó mentése még nem igazolható. Ugyanazzal a képpel próbáld újra.")
  val upload=previous?:Pending(task.id,input.photoName,input.photoBytes,
   "${session.userId}/task-proofs/${task.id}/${UUID.randomUUID()}-android.jpg")
  if(previous==null){
   request("POST","storage/v1/object/farmer-report-media/${upload.path}",session,input.photoBytes,"image/jpeg")
   pending=upload
  }

  val capturedAt=DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
   .withZone(ZoneOffset.UTC).format(Instant.ofEpochMilli(input.position.capturedAtMillis))
  val proof=JSONObject()
   .put("lat",input.position.lat).put("lng",input.position.lng)
   .put("accuracy",input.position.accuracyMeters.toDouble())
   .put("capturedAt",capturedAt).put("photoPath",upload.path)
   .put("photoName",input.photoName).put("validation",geometry.validation)
   .put("distanceMeters",geometry.distanceMeters?:JSONObject.NULL)
  val operationDate=LocalDate.now(ZoneId.of("Europe/Budapest")).toString()
  val rpc=JSONObject().put("p_task_id",task.id).put("p_proof","TASKPROOF:$proof")
   .put("p_operation_date",operationDate).put("p_actual_dose",dose?:JSONObject.NULL)
   .put("p_dose_unit",plan.doseUnit?:JSONObject.NULL)
   .put("p_actual_area",area?:JSONObject.NULL).put("p_actual_quantity",quantity?:JSONObject.NULL)
   .put("p_quantity_unit",plan.quantityUnit?:JSONObject.NULL)
   .put("p_weather",input.weather.trim().takeIf{it.isNotBlank()}?:JSONObject.NULL)
   .put("p_notes",input.notes.trim().takeIf{it.isNotBlank()}?:JSONObject.NULL)
   .put("p_finished_hours",hours?:JSONObject.NULL).put("p_worked_hectares",hectares?:JSONObject.NULL)
  try{
   request("POST","rest/v1/rpc/submit_verified_task_execution",session,rpc.toString().toByteArray())
   pending=null
   true
  }catch(e:Exception){
   // PostgREST errors are transactional, but a broken connection could mean
   // the write succeeded. Keep the uploaded proof and verify persistence.
   val stored=runCatching{
    JSONArray(request("GET","rest/v1/task_execution_reports?select=proof&task_id=eq.${task.id}&limit=1",session))
     .optJSONObject(0)?.optString("proof")
   }.getOrNull()
   if(stored!=null&&stored.startsWith("TASKPROOF:")&&
    runCatching{JSONObject(stored.removePrefix("TASKPROOF:")).optString("photoPath")==upload.path}.getOrDefault(false)){
    pending=null
    true
   }else throw e
  }
 }

 private fun requireUuid(value:String){require(value.matches(Regex("[a-fA-F0-9-]{36}"))){"Érvénytelen azonosító."}}
 private fun decimal(text:String):Double?{
  val trimmed=text.trim().replace(',','.')
  if(trimmed.isEmpty())return null
  val value=trimmed.toDoubleOrNull()
  require(value!=null&&value.isFinite()&&value>=0){"Csak nemnegatív szám adható meg."}
  return value
 }
 private fun JSONObject.optNullableText(name:String):String?=if(isNull(name))null else optString(name).ifBlank{null}
 private fun JSONObject.optNumber(name:String):Double?=if(isNull(name))null else optDouble(name).takeIf{it.isFinite()}

 private fun request(method:String,path:String,session:AuthorizedSession,body:ByteArray?=null,contentType:String="application/json"):String{
  val connection=(URL("${baseUrl.trimEnd('/')}/$path").openConnection() as HttpURLConnection).apply{
   requestMethod=method;connectTimeout=15_000;readTimeout=25_000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
   if(body!=null){setRequestProperty("Content-Type",contentType);doOutput=true}
  }
  return try{
   if(body!=null)connection.outputStream.use{it.write(body)}
   val code=connection.responseCode
   if(code !in 200..299){
    val message=connection.errorStream?.bufferedReader()?.use{it.readText()}?:""
    val reason=runCatching{JSONObject(message).optString("message")}.getOrDefault("")
    error(if(reason.isNotBlank())reason.take(500)else"A szerver elutasította a kérést ($code).")
   }
   connection.inputStream.bufferedReader().use{it.readText()}
  }finally{connection.disconnect()}
 }
}
