package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

data class OperationApproval(
 val id:String,val farmId:String,val farmName:String,val fieldName:String,
 val date:String,val type:String,val product:String,val category:String?,val crop:String?,val target:String?,
 val dose:String?,val doseUnit:String?,val operator:String?,val status:String,val approvedAt:String?,
 val requestedApproverId:String,val required:Boolean,val updatedAt:String
)

/** User-scoped native plant-protection approvals. Database triggers and RLS remain authoritative. */
class OperationApprovalRepository(private val baseUrl:String,private val publishableKey:String){
 suspend fun approvals(session:AuthorizedSession):List<OperationApproval> = withContext(Dispatchers.IO){
  require(session.role==PortalRole.FARMER)
  val user=uuid(session.userId)
  val operations=read("field_operations?select=id,farm_id,field_id,operation_date,operation_type,product_name,regulatory_category,crop,target,dose,dose_unit,operator_name,approval_required,approval_status,approved_at,requested_approver_id,updated_at&requested_approver_id=eq.$user&approval_required=eq.true&order=operation_date.desc&limit=250",session)
  if(operations.isEmpty())return@withContext emptyList()
  // Approvers can see assigned operations even when they are not the farm owner.
  val farmNames=runCatching{read("farms?select=id,name&limit=1000",session)
   .associate{it.getString("id") to it.optString("name","Gazdaság")}}.getOrDefault(emptyMap())
  val fieldNames=runCatching{read("fields?select=id,name&limit=1000",session)
   .associate{it.getString("id") to it.optString("name","Földtábla")}}.getOrDefault(emptyMap())
  operations.map{row->OperationApproval(
   row.getString("id"),row.getString("farm_id"),farmNames[row.optString("farm_id")]?:"Gazdaság",
   fieldNames[row.optString("field_id")]?:"Földtábla",row.optString("operation_date"),
   row.optString("operation_type"),row.optString("product_name","Növényvédelmi művelet"),
   row.optional("regulatory_category"),row.optional("crop"),row.optional("target"),
   row.optional("dose"),row.optional("dose_unit"),row.optional("operator_name"),
   row.optString("approval_status"),row.optional("approved_at"),row.optString("requested_approver_id"),
   row.optBoolean("approval_required"),row.optString("updated_at")
  )}
 }

 suspend fun approve(session:AuthorizedSession,entry:OperationApproval):Boolean = withContext(Dispatchers.IO){
  require(session.role==PortalRole.FARMER)
  val user=uuid(session.userId)
  val id=uuid(entry.id)
  val original=read("field_operations?select=id,farm_id,approval_required,approval_status,requested_approver_id,regulatory_category,updated_at,approved_by&id=eq.$id&limit=1",session)
   .singleOrNull()?:error("A művelet nem hozzáférhető.")
  if(original.optString("approval_status")=="approved"&&original.optString("approved_by")==user)
   return@withContext true
  require(OperationApprovalRules.canApprove(original.optBoolean("approval_required"),original.optString("approval_status"),original.optString("requested_approver_id"),user)){
   "A művelet nem vár rád jóváhagyásra. Frissítsd a listát."
  }
  require(original.optString("updated_at")==entry.updatedAt&&original.optString("farm_id")==entry.farmId){
   "A művelet időközben megváltozott. Frissítsd a listát."
  }
  val today=LocalDate.now(ZoneId.of("Europe/Budapest"))
  val assignment=read("farm_plant_protection_approvers?select=authorization_level,valid_until,active&farm_id=eq.${uuid(entry.farmId)}&user_id=eq.$user&active=eq.true&limit=1",session).singleOrNull()
   ?:error("Nem vagy aktív jóváhagyó ebben a gazdaságban.")
  require(OperationApprovalRules.activeFarmAssignment(assignment.optBoolean("active"),assignment.optional("valid_until"),today)){
   "A gazdasági jóváhagyói engedély lejárt vagy hiányzik."
  }
  val personal=read("profile_plant_protection_licenses?select=authorization_level,valid_until,active&user_id=eq.$user&active=eq.true&limit=1",session).singleOrNull()
   ?:error("A személyes növényvédelmi jogosultság nem érhető el.")
  require(OperationApprovalRules.activeLicense(personal.optBoolean("active"),personal.optional("valid_until"),today)){
   "A személyes növényvédelmi engedély nem érvényes."
  }
  val category=original.optional("regulatory_category")
  require(OperationApprovalRules.levelAllows(assignment.optString("authorization_level"),category)&&
   OperationApprovalRules.levelAllows(personal.optString("authorization_level"),category)){
   "A jogosultsági szint nem elegendő ehhez a növényvédő szerhez."
  }
  val timestamp=URLEncoder.encode(entry.updatedAt,"UTF-8")
  val now=Instant.now().toString()
  val patch=JSONObject().put("approval_status","approved").put("approved_by",user)
   .put("approved_at",now).put("approval_basis","farm_plant_protection_approver")
  val result=request("PATCH","field_operations?id=eq.$id&requested_approver_id=eq.$user&approval_status=eq.pending&updated_at=eq.$timestamp",session,patch,"return=representation")
  if(JSONArray(result).length()==1)return@withContext false
  val current=read("field_operations?select=approval_status,approved_by&id=eq.$id&limit=1",session).singleOrNull()
  if(current?.optString("approval_status")=="approved"&&current.optString("approved_by")==user)return@withContext true
  error("A művelet időközben megváltozott. Frissítsd a listát.")
 }

 private fun read(path:String,session:AuthorizedSession):List<JSONObject>{
  val json=JSONArray(request("GET",path,session,null))
  return (0 until json.length()).map{json.getJSONObject(it)}
 }

 private fun request(method:String,path:String,session:AuthorizedSession,body:JSONObject?,prefer:String?=null):String{
  require(baseUrl.startsWith("https://")&&publishableKey.isNotBlank())
  val conn=(URL("${baseUrl.trimEnd('/')}/rest/v1/$path").openConnection() as HttpURLConnection).apply{
   requestMethod=method;connectTimeout=12000;readTimeout=12000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
   setRequestProperty("Content-Type","application/json")
   if(prefer!=null)setRequestProperty("Prefer",prefer)
   if(body!=null){doOutput=true;outputStream.use{it.write(body.toString().toByteArray(Charsets.UTF_8))}}
  }
  return try{
   if(conn.responseCode !in 200..299)error("A szerver nem fogadta el a műveletet (${conn.responseCode}).")
   conn.inputStream.bufferedReader().use{it.readText()}
  }finally{conn.disconnect()}
 }

 private fun uuid(value:String):String{
  require(value.matches(Regex("[a-fA-F0-9-]{36}"))){"Érvénytelen azonosító."}
  return value
 }
 private fun JSONObject.optional(key:String):String?=if(isNull(key))null else optString(key).ifBlank{null}
}
