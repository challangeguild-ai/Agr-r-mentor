package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class MobileTask(
 val id:String,
 val title:String,
 val fieldName:String,
 val dueDate:String?,
 val priority:String,
 val status:String,
 val description:String?,
 val taskKind:String="general",
 val fieldId:String?=null,
 val assignedTo:String?=null
)

data class MobileOperation(
 val id:String,
 val fieldName:String,
 val date:String,
 val type:String,
 val product:String?,
 val quantity:String?,
 val approvalStatus:String?
)

data class MobileFieldDetail(
 val name:String,
 val farmName:String,
 val areaHa:String,
 val crop:String,
 val status:String,
 val condition:String?,
 val inspectedAt:String?,
 val recommendation:String?,
 val tasks:List<MobileTask>,
 val operations:List<MobileOperation>
)

/** Read-only native views of the existing farmer schema. All queries carry the user's RLS token. */
class FarmerWorkspaceRepository(private val baseUrl:String,private val publishableKey:String){
 suspend fun tasks(session:AuthorizedSession):List<MobileTask> = withContext(Dispatchers.IO){
  // RLS permits the farm owner to see their farm's tasks, including those
  // assigned to colleagues. The previous assigned_to filter hid these tasks.
  val rows=fetch("tasks?select=id,title,field_id,due_date,priority,status,description,task_kind,assigned_to&order=updated_at.desc&limit=250",session.accessToken)
  val fieldNames=fieldNames(session.accessToken)
  rows.objects().map{row->task(row,fieldNames)}
 }

 suspend fun operations(session:AuthorizedSession):List<MobileOperation> = withContext(Dispatchers.IO){
  val fieldNames=fieldNames(session.accessToken)
  if(fieldNames.isEmpty())return@withContext emptyList()
  val rows=fetch("field_operations?select=id,field_id,operation_date,operation_type,product_name,subtype,dose,dose_unit,quantity,quantity_unit,approval_status&order=operation_date.desc&limit=250",session.accessToken)
  rows.objects().filter{it.optString("field_id") in fieldNames}.map{row->operation(row,fieldNames)}
 }

 suspend fun field(session:AuthorizedSession,fieldId:String):MobileFieldDetail = withContext(Dispatchers.IO){
  // Never interpolate an untrusted path or query fragment into PostgREST filters.
  require(fieldId.matches(Regex("[a-fA-F0-9-]{36}"))){"Érvénytelen táblaazonosító."}
  val field=fetch("fields?select=id,name,farm_id,area_ha,current_crop,status&id=eq.$fieldId&limit=1",session.accessToken)
   .optJSONObject(0)?:error("A földtábla nem érhető el.")
  val farmId=field.getString("farm_id")
  val farm=fetch("farms?select=id,name&id=eq.$farmId&limit=1",session.accessToken).optJSONObject(0)
  val latest=fetch("inspections?select=condition,inspected_at,recommendation&field_id=eq.$fieldId&order=inspected_at.desc&limit=1",session.accessToken).optJSONObject(0)
  val names=mapOf(fieldId to field.optString("name","Földtábla"))
  val tasks=fetch("tasks?select=id,title,field_id,due_date,priority,status,description,task_kind,assigned_to&field_id=eq.$fieldId&order=created_at.desc&limit=50",session.accessToken)
   .objects().map{row->task(row,names)}
  val operations=fetch("field_operations?select=id,field_id,operation_date,operation_type,product_name,subtype,dose,dose_unit,quantity,quantity_unit,approval_status&field_id=eq.$fieldId&order=operation_date.desc&limit=50",session.accessToken)
   .objects().map{row->operation(row,names)}
  MobileFieldDetail(
   name=field.optString("name","Földtábla"),
   farmName=farm?.optString("name","Gazdaság")?:"Gazdaság",
   areaHa=if(field.isNull("area_ha"))"—" else field.optString("area_ha"),
   crop=field.optString("current_crop").ifBlank{"Nincs kultúra"},
   status=field.optString("status","active"),
   condition=latest?.optString("condition"),
   inspectedAt=latest?.optNullable("inspected_at"),
   recommendation=latest?.optNullable("recommendation"),
   tasks=tasks,
   operations=operations
  )
 }

 private fun task(row:JSONObject,names:Map<String,String>)=MobileTask(
  id=row.getString("id"),
  title=row.optString("title","Teendő"),
  fieldName=names[row.optString("field_id")]?:"Teljes gazdaság",
  dueDate=row.optNullable("due_date"),
  priority=row.optString("priority","normal"),
  status=row.optString("status","open"),
  description=row.optNullable("description"),
  taskKind=row.optString("task_kind","general"),
  fieldId=row.optNullable("field_id"),
  assignedTo=row.optNullable("assigned_to")
 )

 private fun operation(row:JSONObject,names:Map<String,String>):MobileOperation{
  val amount=when{
   !row.isNull("dose")->"${row.optString("dose")} ${row.optString("dose_unit")}".trim()
   !row.isNull("quantity")->"${row.optString("quantity")} ${row.optString("quantity_unit")}".trim()
   else->null
  }
  return MobileOperation(
   id=row.getString("id"),
   fieldName=names[row.optString("field_id")]?:"Földtábla",
   date=row.optString("operation_date",""),
   type=row.optString("operation_type","other"),
   product=row.optNullable("product_name")?:row.optNullable("subtype"),
   quantity=amount,
   approvalStatus=row.optNullable("approval_status")
  )
 }

 private fun fieldNames(token:String):Map<String,String> = fetch("fields?select=id,name&limit=1000",token)
  .objects().associate{it.getString("id") to it.optString("name","Földtábla")}

 private fun fetch(path:String,token:String):JSONArray{
  val conn=(URL("${baseUrl.trimEnd('/')}/rest/v1/$path").openConnection() as HttpURLConnection).apply{
   requestMethod="GET";connectTimeout=12000;readTimeout=12000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer $token")
  }
  return try{
   if(conn.responseCode !in 200..299)error("Adatlekérés sikertelen (${conn.responseCode}).")
   JSONArray(conn.inputStream.bufferedReader().use{it.readText()})
  }finally{conn.disconnect()}
 }
}

private fun JSONArray.objects():List<JSONObject> = (0 until length()).map{getJSONObject(it)}
private fun JSONObject.optNullable(key:String):String? = if(isNull(key))null else optString(key).ifBlank{null}
