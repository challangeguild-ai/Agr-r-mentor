package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID

data class OperationField(val id:String,val name:String,val farmId:String,val farmName:String,val areaHa:Double?,val countryCode:String)
data class OperationCreateInput(
 val fieldId:String,val date:String,val type:String,val subtype:String,val product:String,
 val treatedArea:String,val dose:String,val doseUnit:String,val quantity:String,val quantityUnit:String,
 val machine:String,val operator:String,val weather:String,val notes:String,
 val productId:String?=null,val useId:String?=null,val doseMode:String="custom",val requestedApproverId:String?=null,
 val crop:String="",val target:String="",val permitAcknowledged:Boolean=false
)
data class OperationCreateResult(val id:String,val alreadyExists:Boolean,val warning:String?)

/** Owner operations, including factual HU manual and permit-verified SK records; server RLS/triggers remain authoritative. */
class OperationCreateRepository(private val baseUrl:String,private val publishableKey:String){
 private data class Pending(val id:String,val input:OperationCreateInput)
 private var pending:Pending?=null
 fun hasPending():Boolean=pending!=null
 fun pendingInput():OperationCreateInput?=pending?.input

 suspend fun huManualAvailable(session:AuthorizedSession):Boolean=withContext(Dispatchers.IO){
  // Without the migrated database guard, previews must not silently save an unverified chemical.
  if(request("POST","rpc/hu_manual_spraying_policy_version",session,JSONObject()).trim()!="2")return@withContext false
  read("plant_protection_uses?select=id,plant_protection_products!inner(country_code)&plant_protection_products.country_code=eq.HU&limit=1",session).isEmpty()
 }

 suspend fun ownedFields(session:AuthorizedSession):List<OperationField> = withContext(Dispatchers.IO){
  require(session.role==PortalRole.FARMER)
  val owner=uuid(session.userId)
  val farms=readAll("farms?select=id,name,country_code&owner_id=eq.$owner&order=id.asc",session)
   .associateBy{it.getString("id")}
  if(farms.isEmpty())return@withContext emptyList()
  farms.keys.toList().chunked(50).flatMap{ids->
   readAll("fields?select=id,name,farm_id,area_ha&farm_id=in.(${ids.joinToString(",")})&order=name.asc,id.asc",session)
  }.sortedWith(compareBy<JSONObject>{it.optString("name")}.thenBy{it.getString("id")}).mapNotNull{field->
   val farm=farms[field.optString("farm_id")]?:return@mapNotNull null
   OperationField(field.getString("id"),field.optString("name","Földtábla"),farm.getString("id"),
    farm.optString("name","Gazdaság"),if(field.isNull("area_ha"))null else field.optDouble("area_ha"),
    if(farm.optString("country_code")=="SK")"SK"else"HU")
  }
 }

 suspend fun create(session:AuthorizedSession,input:OperationCreateInput):OperationCreateResult=withContext(Dispatchers.IO){
  require(session.role==PortalRole.FARMER)
  require(OperationCreateRules.validDetails(input.type,input.date,input.subtype,input.product,input.notes)){
   "Ellenőrizd a dátumot, a művelettípust, az anyagot és a megjegyzést."
  }
  require(input.doseUnit.length<=30&&input.quantityUnit.length<=30&&input.machine.length<=150&&
   input.operator.length<=120&&input.weather.length<=180){"Túl hosszú szöveges mező."}
  val area=OperationCreateRules.parseAmount(input.treatedArea)
  val chemical=input.type=="spraying"||input.type=="plant_protection"
  val dose=if(chemical&&input.doseMode=="official_max")null else OperationCreateRules.parseAmount(input.dose)
  val quantity=OperationCreateRules.parseAmount(input.quantity)
  val field=ownedFields(session).find{it.id==uuid(input.fieldId)}
   ?:error("Csak a saját gazdaságod földtábláján rögzíthetsz műveletet.")
  val manualHu=chemical&&field.countryCode=="HU"&&input.productId.isNullOrBlank()&&input.useId.isNullOrBlank()
  if(manualHu){
   require(input.doseMode!="official_max") {"Kézi naplózáskor nincs hivatalosan ellenőrzött maximális dózis."}
   require(OperationCreateRules.validHuManualLog(field.countryCode,!huManualAvailable(session),input.product,input.crop,dose,input.doseUnit,input.permitAcknowledged)){
    "Kézi magyar növényvédelmi naplózáshoz szer, kultúra, pozitív tényleges dózis, egység és engedélyokirat-ellenőrzés szükséges."
   }
  }
  val verified=if(chemical&&!manualHu)PlantProtectionCatalogRepository(baseUrl,publishableKey).verify(session,field,input)else null
  require(!chemical||manualHu||verified!=null){"Engedélyezett készítmény és felhasználás szükséges."}
  require(OperationCreateRules.validNumbers(area,field.areaHa,dose,quantity)){
   "A terület legfeljebb a tábla mérete lehet, a dózis és a mennyiség nem lehet negatív."
  }
  val previous=pending
  if(previous!=null&&previous.input!=input)error("A korábbi művelet mentése még nem igazolható. Ugyanazokkal az adatokkal próbáld újra.")
  val draft=previous?:Pending(UUID.randomUUID().toString(),input)
  pending=draft
  val body=JSONObject().put("id",draft.id).put("farm_id",field.farmId).put("field_id",field.id)
   .put("operation_date",input.date).put("operation_type",input.type).put("country_code",field.countryCode)
   .put("subtype",input.subtype.trim().ifBlank{null})
   .put("product_name",verified?.productName?:input.product.trim().ifBlank{null})
   .put("product_id",verified?.productId?:JSONObject.NULL).put("plant_protection_use_id",verified?.useId?:JSONObject.NULL)
   .put("authorization_number",verified?.authorizationNumber?:JSONObject.NULL)
   .put("crop",verified?.crop?:input.crop.trim().ifBlank{null}).put("target",verified?.target?:input.target.trim().ifBlank{null})
   .put("active_ingredient",verified?.activeIngredient?:JSONObject.NULL)
   .put("dose",verified?.dose?:dose?:JSONObject.NULL).put("dose_unit",verified?.doseUnit?:input.doseUnit.trim().ifBlank{null})
   .put("dose_mode",verified?.doseMode?:if(manualHu)"executed"else JSONObject.NULL).put("official_dose_max",verified?.officialDoseMax?:JSONObject.NULL)
   .put("quantity",quantity?:JSONObject.NULL).put("quantity_unit",input.quantityUnit.trim().ifBlank{null})
   .put("treated_area",area?:JSONObject.NULL).put("machine_name",input.machine.trim().ifBlank{null})
   .put("operator_name",input.operator.trim().ifBlank{null}).put("weather",input.weather.trim().ifBlank{null})
   .put("notes",input.notes.trim().ifBlank{null}).put("catalog_mode",if(verified!=null)"official"else"manual")
   .put("regulatory_snapshot",if(manualHu)JSONObject().put("verification_status","not_verified")
    .put("permit_check_required",true).put("source","user_reported_actual_application") else JSONObject())
   .put("regulatory_category",verified?.regulatoryCategory?:JSONObject.NULL)
   .put("approval_required",verified?.approvalRequired?:false)
   .put("approval_status",if(verified?.approvalRequired==true)"pending"else"not_required")
   .put("requested_approver_id",verified?.approverId?:JSONObject.NULL)
   .put("approver_name",verified?.approverName?:JSONObject.NULL)
   .put("approval_basis",if(verified?.approvalRequired==true)"farm_plant_protection_approver"else JSONObject.NULL)
   .put("created_by",session.userId)
  if(manualHu)body.put("permit_check_attested",input.permitAcknowledged)
  val lookup="field_operations?select=id,farm_id,field_id,operation_date,operation_type,created_by,product_name,product_id,plant_protection_use_id,requested_approver_id${if(manualHu)",permit_check_attested"else""},treated_area,dose,quantity&id=eq.${draft.id}&limit=1"
  var saved=read(lookup,session).singleOrNull()
  var alreadyExists=saved!=null
  if(saved==null){
   try{request("POST","field_operations",session,body,"return=representation")}
   catch(e:Exception){
    saved=runCatching{read(lookup,session).singleOrNull()}.getOrNull()
    if(saved==null)throw e
    alreadyExists=true
   }
  }
  saved=saved?:read(lookup,session).singleOrNull()
  require(saved!=null&&saved.optString("id")==draft.id&&saved.optString("farm_id")==field.farmId&&
   saved.optString("field_id")==field.id&&saved.optString("operation_date")==input.date&&
   saved.optString("operation_type")==input.type&&saved.optString("created_by")==session.userId&&
   saved.optional("product_name")== (verified?.productName?:input.product.trim().ifBlank{null})&&
   saved.optional("product_id")==verified?.productId&&saved.optional("plant_protection_use_id")==verified?.useId&&
   saved.optional("requested_approver_id")==verified?.approverId&&
   saved.optBoolean("permit_check_attested",false)==(manualHu&&input.permitAcknowledged)&&
   sameAmount(saved,"treated_area",area)&&sameAmount(saved,"dose",verified?.dose?:dose)&&sameAmount(saved,"quantity",quantity)){
   "A művelet mentése nem igazolható, vagy a mentési azonosítóhoz eltérő adatok tartoznak."
  }
  pending=null
  val warning=runCatching{addTimeline(session,field,input,draft.id,verified)}.getOrElse{
   "A művelet létrejött, de az idővonal frissítését nem sikerült igazolni."
  }
  OperationCreateResult(draft.id,alreadyExists,warning)
 }

 private fun addTimeline(session:AuthorizedSession,field:OperationField,input:OperationCreateInput,operationId:String,verified:VerifiedPlantProtection?):String?{
  val eventId=UUID.nameUUIDFromBytes("field-operation:$operationId".toByteArray(StandardCharsets.UTF_8)).toString()
  if(read("timeline_events?select=id&id=eq.$eventId&limit=1",session).isNotEmpty())return null
  val summary=JSONObject().put("type",input.type).put("countryCode",field.countryCode)
   .put("subtype",input.subtype).put("product",verified?.productName?:input.product)
   .put("productId",verified?.productId).put("useId",verified?.useId)
   .put("authorizationNumber",verified?.authorizationNumber).put("crop",verified?.crop?:input.crop)
   .put("target",verified?.target?:input.target).put("activeIngredient",verified?.activeIngredient)
   .put("verificationStatus",when{
    verified!=null->"official"
    input.type in setOf("spraying","plant_protection")->"not_verified"
    else->"not_applicable"
   })
   .put("dose",verified?.dose?:OperationCreateRules.parseAmount(input.dose))
   .put("doseUnit",verified?.doseUnit?:input.doseUnit).put("quantity",OperationCreateRules.parseAmount(input.quantity))
   .put("quantityUnit",input.quantityUnit).put("treatedArea",OperationCreateRules.parseAmount(input.treatedArea))
   .put("machine",input.machine).put("operator",input.operator).put("weather",input.weather).put("notes",input.notes)
  val title="Művelet: ${OperationCreateRules.types.find{it.first==input.type}?.second?:"Gazdálkodási művelet"}"
  val eventAt=LocalDate.parse(input.date).atTime(12,0).atZone(ZoneId.of("Europe/Budapest")).toInstant().toString()
  val payload=JSONObject().put("id",eventId).put("farm_id",field.farmId).put("field_id",field.id)
   .put("event_type","field_operation").put("title",title).put("description","OPJSON:$summary")
   .put("event_at",eventAt).put("created_by",session.userId).put("source_id",operationId)
  try{request("POST","timeline_events",session,payload)}catch(e:Exception){
   if(read("timeline_events?select=id&id=eq.$eventId&limit=1",session).isEmpty())throw e
  }
  return null
 }

 private fun sameAmount(row:JSONObject,key:String,expected:Double?):Boolean =
  if(expected==null)row.isNull(key) else !row.isNull(key)&&row.optDouble(key).let{it.isFinite()&&kotlin.math.abs(it-expected)<1e-8}

 private fun read(path:String,session:AuthorizedSession):List<JSONObject>{
  val result=JSONArray(request("GET",path,session,null))
  return (0 until result.length()).map{result.getJSONObject(it)}
 }

 private fun readAll(path:String,session:AuthorizedSession):List<JSONObject> =
  collectPostgrestPages(path){pagedPath->read(pagedPath,session)}

 private fun request(method:String,path:String,session:AuthorizedSession,body:JSONObject?,prefer:String?=null):String{
  require(baseUrl.startsWith("https://")&&publishableKey.isNotBlank())
  val conn=(URL("${baseUrl.trimEnd('/')}/rest/v1/$path").openConnection() as HttpURLConnection).apply{
   requestMethod=method;connectTimeout=12000;readTimeout=12000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
   setRequestProperty("Content-Type","application/json")
   if(prefer!=null)setRequestProperty("Prefer",prefer)
   if(body!=null){doOutput=true;outputStream.use{it.write(body.toString().toByteArray(StandardCharsets.UTF_8))}}
  }
  return try{
   if(conn.responseCode !in 200..299)error("Szerverhiba (${conn.responseCode}).")
   conn.inputStream.bufferedReader().use{it.readText()}
  }finally{conn.disconnect()}
 }
 private fun uuid(value:String):String{
  require(validMapFieldId(value)){"Érvénytelen azonosító."}
  return value
 }
 private fun JSONObject.optional(key:String):String?=if(isNull(key))null else optString(key).ifBlank{null}
}
