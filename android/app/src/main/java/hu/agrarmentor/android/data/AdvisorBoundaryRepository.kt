package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.OffsetDateTime

data class MobileBoundaryProposal(
 val id:String,val fieldId:String,val fieldName:String,val farmName:String,
 val createdAt:String?,val source:String,val hasBoundary:Boolean,val note:String
)

data class MobileBoundaryReview(
 val proposal:MobileBoundaryProposal,val previous:NativeMapField,val proposed:NativeMapField,
 val stale:Boolean,val declaredAreaHa:Double?,val previousVersion:String?,val proposedVersion:String?
)

internal fun boundaryVersionChanged(previous:String?,baseline:String?):Boolean{
 if(previous==null||baseline==null)return previous!=baseline
 val a=runCatching{OffsetDateTime.parse(previous).toInstant()}.getOrNull()
 val b=runCatching{OffsetDateTime.parse(baseline).toInstant()}.getOrNull()
 return if(a!=null&&b!=null)a!=b else previous!=baseline
}

/** Advisor-only RLS reads and the existing server-validated approval RPC. */
class AdvisorBoundaryRepository(private val baseUrl:String,private val publishableKey:String){
 suspend fun queue(session:AuthorizedSession):List<MobileBoundaryProposal> = withContext(Dispatchers.IO){
  requireAdvisor(session)
  val proposals=read("field_boundary_proposals?select=id,field_id,farm_id,created_at,geometry_source,has_boundary,note&status=eq.pending&order=created_at.asc&limit=200",session)
  if(proposals.isEmpty())return@withContext emptyList()
  val farms=read("farms?select=id,name&limit=1000",session).associateBy{it.getString("id")}
  val fields=read("fields?select=id,name&limit=1000",session).associateBy{it.getString("id")}
  proposals.map{p->summary(p,fields[p.optString("field_id")]?.optString("name"),farms[p.optString("farm_id")]?.optString("name"))}
 }

 suspend fun detail(session:AuthorizedSession,id:String):MobileBoundaryReview = withContext(Dispatchers.IO){
  requireAdvisor(session);require(id.matches(UUID_PATTERN)){"Érvénytelen javaslatazonosító."}
  val p=read("field_boundary_proposals?select=*&id=eq.$id&limit=1",session).singleOrNull()
   ?:error("A javaslat nem érhető el.")
  val field=read("fields?select=id,name,farm_id,area_ha,center_lat,center_lng,boundary_geojson,boundary_updated_at&id=eq.${p.getString("field_id")}&limit=1",session).singleOrNull()
   ?:error("A javaslat földtáblája nem érhető el.")
  check(field.optString("farm_id")==p.optString("farm_id")){"A javaslat gazdasága megváltozott."}
  val farm=read("farms?select=id,name&id=eq.${p.getString("farm_id")}&limit=1",session).singleOrNull()
  val name=field.optString("name").ifBlank{"Földtábla"}
  val farmName=farm?.optString("name")?:"Gazdaság"
  val fieldId=field.getString("id")
  val oldVersion=field.optional("boundary_updated_at")
  val baseline=p.optional("base_boundary_updated_at")
  MobileBoundaryReview(
   summary(p,name,farmName),
   NativeMapField(fieldId,name,farmName,field.number("center_lat"),field.number("center_lng"),field.geometry("boundary_geojson")),
   NativeMapField(fieldId,"Javasolt: $name",farmName,p.number("center_lat"),p.number("center_lng"),p.geometry("boundary_geojson")),
   boundaryVersionChanged(oldVersion,baseline),field.number("area_ha"),oldVersion,baseline
  )
 }

 /** Always verifies that this advisor's exact decision was persisted, including after lost responses. */
 suspend fun review(session:AuthorizedSession,id:String,approve:Boolean,confirmed:Boolean,note:String):String = withContext(Dispatchers.IO){
  requireAdvisor(session);require(id.matches(UUID_PATTERN)){"Érvénytelen javaslatazonosító."}
  require(!approve||confirmed){"Jóváhagyás előtt ellenőrizd a két térképet."}
  val trimmed=note.trim()
  require(trimmed.length<=1000){"A megjegyzés túl hosszú."}
  val body=JSONObject().put("p_proposal_id",id).put("p_approve",approve).put("p_note",if(trimmed.isBlank())JSONObject.NULL else trimmed)
  val conn=(URL("${baseUrl.trimEnd('/')}/rest/v1/rpc/review_field_boundary_proposal").openConnection() as HttpURLConnection).apply{
   requestMethod="POST";doOutput=true;connectTimeout=12000;readTimeout=15000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
   setRequestProperty("Content-Type","application/json")
  }
  var rpcError:String?=null
  try{
   conn.outputStream.use{it.write(body.toString().toByteArray(Charsets.UTF_8))}
   if(conn.responseCode !in 200..299)rpcError="Az elbírálás nem sikerült (${conn.responseCode})."
   else conn.inputStream.bufferedReader().use{it.readText()}
  }catch(e:CancellationException){throw e}
  catch(e:Exception){rpcError="A kapcsolat megszakadt az elbírálás közben."}
  finally{conn.disconnect()}
  val saved=read("field_boundary_proposals?select=field_id,status,reviewed_by,review_note&id=eq.$id&limit=1",session).singleOrNull()
  val wanted=if(approve)"approved" else "rejected"
  check(saved!=null&&saved.optString("status")==wanted&&saved.optString("reviewed_by")==session.userId&&
   saved.optString("review_note").trim()==trimmed){
   rpcError?:"Az elbírálás nem igazolható. Ellenőrizd a javaslat állapotát, mielőtt újra döntesz."
  }
  saved!!.getString("field_id")
 }

 private fun requireAdvisor(session:AuthorizedSession){
  require(session.role==PortalRole.ADVISOR){"Táblahatárt csak szaktanácsadó bírálhat el."}
  require(session.userId.matches(UUID_PATTERN)){"Érvénytelen felhasználóazonosító."}
 }

 private fun summary(p:JSONObject,fieldName:String?,farmName:String?)=MobileBoundaryProposal(
  p.getString("id"),p.getString("field_id"),fieldName?.ifBlank{"Földtábla"}?:"Földtábla",
  farmName?.ifBlank{"Gazdaság"}?:"Gazdaság",p.optional("created_at"),
  p.optString("geometry_source","manual"),p.optBoolean("has_boundary"),p.optString("note")
 )

 private fun read(path:String,session:AuthorizedSession):List<JSONObject>{
  val conn=(URL("${baseUrl.trimEnd('/')}/rest/v1/$path").openConnection() as HttpURLConnection).apply{
   requestMethod="GET";connectTimeout=12000;readTimeout=12000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
  }
  return try{
   val status=conn.responseCode
   if(status !in 200..299)error("A táblahatár-adatok nem tölthetők be ($status).")
   val arr=JSONArray(conn.inputStream.bufferedReader().use{it.readText()})
   (0 until arr.length()).map{arr.getJSONObject(it)}
  }finally{conn.disconnect()}
 }

 private fun JSONObject.optional(key:String):String?=if(isNull(key))null else optString(key).ifBlank{null}
 private fun JSONObject.number(key:String):Double?=if(isNull(key))null else optDouble(key).takeIf{it.isFinite()}
 private fun JSONObject.geometry(key:String):String?=if(isNull(key))null else optJSONObject(key)?.toString()
 private companion object{val UUID_PATTERN=Regex("[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}")}
}
