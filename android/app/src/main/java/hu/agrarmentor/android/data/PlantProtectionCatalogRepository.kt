package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.time.LocalDate
import java.time.ZoneId

data class PlantProduct(
 val id:String,val name:String,val authorizationNumber:String?,val regulatoryCategory:String?,
 val validFrom:String?,val validUntil:String?,val regulatoryStatus:String?,val graceUntil:String?,
 val active:Boolean,val approvalRequired:Boolean,val professionalOnly:Boolean,val prescriptionRequired:Boolean
)
data class PlantUse(val id:String,val productId:String,val crop:String,val target:String?,
 val doseMin:Double?,val doseMax:Double?,val doseUnit:String?,val method:String?,val restrictions:String?)
data class PlantApprover(val id:String,val name:String,val level:String,val validUntil:String)
data class VerifiedPlantProtection(
 val productId:String,val useId:String,val productName:String,val authorizationNumber:String?,
 val crop:String,val target:String?,val activeIngredient:String?,val dose:Double?,val doseUnit:String?,
 val doseMode:String,val officialDoseMax:Double?,val regulatoryCategory:String?,
 val approvalRequired:Boolean,val approverId:String?,val approverName:String?
)

/** Small RLS-scoped Data API reads; no service key or duplicate local permit database. */
class PlantProtectionCatalogRepository(private val baseUrl:String,private val publishableKey:String){
 suspend fun searchProducts(session:AuthorizedSession,country:String,raw:String):List<PlantProduct> = withContext(Dispatchers.IO){
  require(country=="HU"||country=="SK")
  val term=raw.trim().take(70).filter{it.isLetterOrDigit()||it in " -._"}.trim()
  require(term.length>=2){"Legalább két karaktert adj meg a készítmény kereséséhez."}
  val pattern=URLEncoder.encode("*$term*","UTF-8").replace("+","%20")
  read("plant_protection_products?select=id,name,authorization_number,regulatory_category,valid_from,valid_until,regulatory_status,grace_period_until,active,approval_required,professional_use_only,prescription_required&country_code=eq.$country&active=eq.true&name=ilike.$pattern&order=name.asc&limit=50",session)
   .map(::product)
 }

 suspend fun uses(session:AuthorizedSession,productId:String):List<PlantUse> = withContext(Dispatchers.IO){
  read("plant_protection_uses?select=id,product_id,crop,target,dose_min,dose_max,dose_unit,application_method,restrictions&product_id=eq.${uuid(productId)}&order=crop.asc&limit=1000",session)
   .map(::use)
 }

 suspend fun productById(session:AuthorizedSession,country:String,productId:String):PlantProduct?=withContext(Dispatchers.IO){
  require(country=="HU"||country=="SK")
  read("plant_protection_products?select=id,name,authorization_number,regulatory_category,valid_from,valid_until,regulatory_status,grace_period_until,active,approval_required,professional_use_only,prescription_required&country_code=eq.$country&id=eq.${uuid(productId)}&limit=1",session)
   .singleOrNull()?.let(::product)
 }

 suspend fun approvers(session:AuthorizedSession,farmId:String):List<PlantApprover> = withContext(Dispatchers.IO){
  val assignments=read("farm_plant_protection_approvers?select=user_id,active,valid_until&farm_id=eq.${uuid(farmId)}&active=eq.true&limit=100",session)
  val today=LocalDate.now(ZoneId.of("Europe/Budapest"))
  assignments.mapNotNull{assigned->
   if(!OperationApprovalRules.activeFarmAssignment(assigned.optBoolean("active"),assigned.optional("valid_until"),today))return@mapNotNull null
   val userId=uuid(assigned.getString("user_id"))
   val profile=read("profiles?select=id,full_name,role&id=eq.$userId&limit=1",session).singleOrNull()
    ?:return@mapNotNull null
   if(profile.optString("role")=="advisor")return@mapNotNull null
   val licence=read("profile_plant_protection_licenses?select=authorization_level,valid_until,active&user_id=eq.$userId&active=eq.true&limit=1",session).singleOrNull()
    ?:return@mapNotNull null
   if(!OperationApprovalRules.activeLicense(licence.optBoolean("active"),licence.optional("valid_until"),today))return@mapNotNull null
   PlantApprover(userId,profile.optString("full_name","Gazdasági jogosult"),licence.optString("authorization_level"),licence.getString("valid_until"))
  }
 }

 /** Repeat every permit check at submit time. A stale screen selection is never trusted. */
 suspend fun verify(session:AuthorizedSession,field:OperationField,input:OperationCreateInput):VerifiedPlantProtection = withContext(Dispatchers.IO){
  require(input.type=="spraying"||input.type=="plant_protection")
  val productId=uuid(input.productId?:error("Válassz hivatalos készítményt."))
  val useId=uuid(input.useId?:error("Válassz engedélyezett felhasználást."))
  val record=read("plant_protection_products?select=id,name,country_code,authorization_number,regulatory_category,valid_from,valid_until,regulatory_status,grace_period_until,active,approval_required,professional_use_only,prescription_required&country_code=eq.${field.countryCode}&id=eq.$productId&limit=1",session)
   .singleOrNull()?:error("A kiválasztott készítmény már nem érhető el az ország hivatalos katalógusában.")
  val p=product(record)
  PlantProtectionRules.blockedStatus(field.countryCode,input.date,p.active,p.validFrom,p.validUntil,p.regulatoryStatus,p.graceUntil)?.let{error(it)}
  val useRow=read("plant_protection_uses?select=id,product_id,crop,target,dose_min,dose_max,dose_unit,application_method,restrictions&product_id=eq.$productId&id=eq.$useId&limit=1",session)
   .singleOrNull()?:error("A felhasználás nem tartozik a kiválasztott készítményhez.")
  val u=use(useRow)
  require(input.doseMode in listOf("custom","official_max")){"Érvénytelen dózismód."}
  val dose=if(input.doseMode=="official_max")u.doseMax?:error("Nincs hivatalos maximális dózis.")
   else OperationCreateRules.parseAmount(input.dose)
  require(PlantProtectionRules.validDose(dose,u.doseMin,u.doseMax)){
   "A dózis kívül esik az engedélyezett ${u.doseMin?:"–"}–${u.doseMax?:"–"} tartományon."
  }
  if(!u.doseUnit.isNullOrBlank()&&input.doseUnit.isNotBlank())
   require(u.doseUnit==input.doseUnit){"Az egység nem egyezik a hivatalos felhasználás egységével."}
  val required=PlantProtectionRules.requiresApprover(field.countryCode,p.regulatoryCategory,p.approvalRequired,p.professionalOnly,p.prescriptionRequired)
  val approver=if(required){
   val approverId=uuid(input.requestedApproverId?:error("Ehhez a szerhez kijelölt gazdasági jóváhagyó szükséges."))
   approvers(session,field.farmId).find{it.id==approverId&&OperationApprovalRules.levelAllows(it.level,p.regulatoryCategory)}
    ?:error("A kijelölt személynek nincs érvényes, megfelelő szintű növényvédelmi jogosultsága.")
  }else null
  val ingredientRows=read("plant_protection_ingredients?select=ingredient,concentration,concentration_unit&product_id=eq.$productId&order=ingredient.asc&limit=150",session)
  val ingredients=ingredientRows.map{row->buildString{
   append(row.optString("ingredient"))
   if(!row.isNull("concentration"))append(" ${row.optString("concentration")}")
   if(!row.isNull("concentration_unit"))append(" ${row.optString("concentration_unit")}")
  }}.filter{it.isNotBlank()}.joinToString(", ")
  VerifiedPlantProtection(productId,useId,p.name,p.authorizationNumber,u.crop,u.target,
   ingredients.ifBlank{null},dose,u.doseUnit?:input.doseUnit.trim().ifBlank{null},input.doseMode,
   u.doseMax,p.regulatoryCategory,required,approver?.id,approver?.name)
 }

 private fun product(row:JSONObject)=PlantProduct(row.getString("id"),row.optString("name"),row.optional("authorization_number"),
  row.optional("regulatory_category"),row.optional("valid_from"),row.optional("valid_until"),
  row.optional("regulatory_status"),row.optional("grace_period_until"),row.optBoolean("active"),
  row.optBoolean("approval_required"),row.optBoolean("professional_use_only"),row.optBoolean("prescription_required"))
 private fun use(row:JSONObject)=PlantUse(row.getString("id"),row.getString("product_id"),row.optString("crop"),
  row.optional("target"),row.number("dose_min"),row.number("dose_max"),row.optional("dose_unit"),
  row.optional("application_method"),row.optional("restrictions"))

 private fun read(path:String,session:AuthorizedSession):List<JSONObject>{
  require(baseUrl.startsWith("https://")&&publishableKey.isNotBlank())
  val conn=(URL("${baseUrl.trimEnd('/')}/rest/v1/$path").openConnection() as HttpURLConnection).apply{
   requestMethod="GET";connectTimeout=12000;readTimeout=15000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
  }
  return try{
   if(conn.responseCode !in 200..299)error("A hivatalos katalógus nem ellenőrizhető (${conn.responseCode}).")
   val array=JSONArray(conn.inputStream.bufferedReader().use{it.readText()})
   (0 until array.length()).map{array.getJSONObject(it)}
  }finally{conn.disconnect()}
 }
 private fun JSONObject.number(key:String):Double?=if(isNull(key))null else optDouble(key).takeIf{it.isFinite()}
 private fun JSONObject.optional(key:String):String?=if(isNull(key))null else optString(key).ifBlank{null}
 private fun uuid(value:String):String{
  require(value.matches(Regex("[a-fA-F0-9-]{36}"))){"Érvénytelen azonosító."}
  return value
 }
}
