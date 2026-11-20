package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.time.Instant

data class MobileNotification(
 val id:String,val title:String,val message:String,val kind:String,
 val href:String?,val createdAt:String,val readAt:String?
)
data class MobileMessage(
 val id:String,val title:String,val text:String,val status:String,
 val response:String?,val fieldId:String?,val createdAt:String
)
data class MobileDocument(
 val id:String,val title:String,val fileName:String,val category:String,
 val storagePath:String,val createdAt:String,val notes:String?
)
data class MobileProfile(val name:String,val phone:String,val city:String,val jobTitle:String)

/** User-scoped PostgREST and Storage calls. Database RLS remains the authority. */
class CommunicationRepository(private val baseUrl:String,private val publishableKey:String){
 suspend fun notifications(session:AuthorizedSession):List<MobileNotification> = withContext(Dispatchers.IO){
  val user=uuid(session.userId)
  getArray("rest/v1/notifications?select=id,title,message,kind,href,created_at,read_at&user_id=eq.$user&order=created_at.desc&limit=100",session)
   .map{row->MobileNotification(row.getString("id"),row.optString("title"),row.optString("message"),row.optString("kind"),row.nullable("href"),row.optString("created_at"),row.nullable("read_at"))}
 }

 suspend fun markNotificationRead(session:AuthorizedSession,id:String) = withContext(Dispatchers.IO){
  request("PATCH","rest/v1/notifications?id=eq.${uuid(id)}&user_id=eq.${uuid(session.userId)}",session,JSONObject().put("read_at",Instant.now().toString()))
  Unit
 }

 suspend fun messages(session:AuthorizedSession):List<MobileMessage> = withContext(Dispatchers.IO){
  getArray("rest/v1/farmer_reports?select=id,title,message,status,advisor_reply,field_id,created_at&farmer_id=eq.${uuid(session.userId)}&order=created_at.desc&limit=100",session)
   .map{row->MobileMessage(row.getString("id"),row.optString("title"),row.optString("message"),row.optString("status"),row.nullable("advisor_reply"),row.nullable("field_id"),row.optString("created_at"))}
 }

 suspend fun documents(session:AuthorizedSession):List<MobileDocument> = withContext(Dispatchers.IO){
  getArray("rest/v1/documents?select=id,title,file_name,category,storage_path,created_at,notes&order=created_at.desc&limit=100",session)
   .map{row->MobileDocument(row.getString("id"),row.optString("title"),row.optString("file_name"),row.optString("category"),row.optString("storage_path"),row.optString("created_at"),row.nullable("notes"))}
 }

 /** The signed download URL is valid for one minute and never cached on disk. */
 suspend fun signedDocumentUrl(session:AuthorizedSession,storagePath:String):String = withContext(Dispatchers.IO){
  val relative=storagePath.split('/').also{segments->
   require(segments.isNotEmpty()&&segments.all{it.isNotBlank()&&it!="."&&it!=".."})
  }.joinToString("/"){URLEncoder.encode(it,"UTF-8").replace("+","%20")}
  val response=JSONObject(request("POST","storage/v1/object/sign/documents/$relative",session,JSONObject().put("expiresIn",60)))
  val signed=response.optString("signedURL").ifBlank{response.optString("signedUrl")}
  val path=signed.trimStart('/')
  require(path.startsWith("object/sign/documents/")||path.startsWith("storage/v1/object/sign/documents/"))
  "${baseUrl.trimEnd('/')}/${if(path.startsWith("storage/v1/"))path else "storage/v1/$path"}"
 }

 suspend fun profile(session:AuthorizedSession):MobileProfile = withContext(Dispatchers.IO){
  val row=getArray("rest/v1/profiles?select=full_name,phone,city,job_title&id=eq.${uuid(session.userId)}&limit=1",session).firstOrNull()
   ?:error("A profil nem hozzáférhető.")
  MobileProfile(row.optString("full_name"),row.optString("phone"),row.optString("city"),row.optString("job_title"))
 }

 suspend fun updateProfile(session:AuthorizedSession,profile:MobileProfile) = withContext(Dispatchers.IO){
  require(profile.name.trim().length in 2..120)
  require(profile.phone.length<=40&&profile.city.length<=120&&profile.jobTitle.length<=120)
  val body=JSONObject().put("full_name",profile.name.trim())
   .put("phone",profile.phone.trim()).put("city",profile.city.trim()).put("job_title",profile.jobTitle.trim())
  request("PATCH","rest/v1/profiles?id=eq.${uuid(session.userId)}",session,body)
  Unit
 }

 private fun getArray(path:String,session:AuthorizedSession):List<JSONObject>{
  val rows=JSONArray(request("GET",path,session,null))
  return (0 until rows.length()).map{rows.getJSONObject(it)}
 }

 private fun request(method:String,path:String,session:AuthorizedSession,body:JSONObject?):String{
  require(baseUrl.startsWith("https://")&&publishableKey.isNotBlank())
  val connection=(URL("${baseUrl.trimEnd('/')}/$path").openConnection() as HttpURLConnection).apply{
   requestMethod=method
   connectTimeout=12000
   readTimeout=12000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
   setRequestProperty("Content-Type","application/json")
   if(body!=null){doOutput=true;outputStream.use{it.write(body.toString().toByteArray(Charsets.UTF_8))}}
  }
  return try{
   if(connection.responseCode !in 200..299)error("Szerverhiba (${connection.responseCode}).")
   connection.inputStream.bufferedReader().use{it.readText()}
  }finally{connection.disconnect()}
 }

 private fun uuid(value:String):String{
  require(value.matches(Regex("[a-fA-F0-9-]{36}"))){"Érvénytelen azonosító."}
  return value
 }

 private fun JSONObject.nullable(key:String):String?=if(isNull(key))null else optString(key).ifBlank{null}
}
