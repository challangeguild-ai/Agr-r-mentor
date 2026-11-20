package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class MobileCatalogCountry(
 val code:String,val sourceName:String?,val status:String?,val lastImported:String?,
 val activeProducts:Int?,val uses:Int?,val dose:Int?,val bbch:Int?,val restrictions:Int?
)
data class MobileCatalogImport(val country:String,val source:String,val date:String?,val rows:Int,val uses:Int)
data class MobileCatalogSnapshot(val countries:List<MobileCatalogCountry>,val recentImports:List<MobileCatalogImport>)

/** Read-only authoritative catalog coverage, shared with the web application. */
class AdvisorCatalogRepository(private val baseUrl:String,private val publishableKey:String){
 suspend fun load(session:AuthorizedSession):MobileCatalogSnapshot = withContext(Dispatchers.IO){
  require(session.role==PortalRole.ADVISOR){"Katalógusadatokat csak szaktanácsadó tekinthet meg."}
  val sources=read("operation_catalog_sources?select=country_code,source_name,status,last_imported_at&country_code=in.(HU,SK)",session)
   .associateBy{it.optString("country_code")}
  val batches=read("plant_protection_import_batches?select=country_code,source_name,imported_at,row_count,use_count&order=imported_at.desc&limit=10",session)
  val countries=listOf("HU","SK").map{country->
   val source=sources[country]
   val coverage=runCatching{coverage(country,session)}.getOrNull()
   MobileCatalogCountry(country,source?.optString("source_name"),source?.optString("status"),source?.optional("last_imported_at"),
    runCatching{countProducts(country,session)}.getOrNull(),coverage?.optInt("uses"),coverage?.optInt("dose"),
    coverage?.optInt("bbch"),coverage?.optInt("restrictions"))
  }
  MobileCatalogSnapshot(countries,batches.map{MobileCatalogImport(
   it.optString("country_code"),it.optString("source_name"),it.optional("imported_at"),it.optInt("row_count"),it.optInt("use_count")
  )})
 }

 private fun coverage(country:String,session:AuthorizedSession):JSONObject{
  val conn=(URL("${baseUrl.trimEnd('/')}/rest/v1/rpc/plant_protection_use_coverage").openConnection() as HttpURLConnection).apply{
   requestMethod="POST";doOutput=true;connectTimeout=12000;readTimeout=12000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
   setRequestProperty("Content-Type","application/json")
  }
  return try{
   conn.outputStream.use{it.write(JSONObject().put("p_country_code",country).toString().toByteArray())}
   if(conn.responseCode !in 200..299)error("Nem elérhető a lefedettség.")
   JSONArray(conn.inputStream.bufferedReader().use{it.readText()}).getJSONObject(0)
  }finally{conn.disconnect()}
 }

 private fun countProducts(country:String,session:AuthorizedSession):Int{
  val conn=(URL("${baseUrl.trimEnd('/')}/rest/v1/plant_protection_products?select=id&country_code=eq.$country&active=eq.true&limit=1").openConnection() as HttpURLConnection).apply{
   requestMethod="HEAD";connectTimeout=12000;readTimeout=12000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
   setRequestProperty("Prefer","count=exact")
  }
  return try{
   if(conn.responseCode !in 200..299)error("Nem elérhető a készítményszám.")
   conn.getHeaderField("Content-Range")?.substringAfterLast('/')?.toIntOrNull()
    ?:error("A készítményszám nem igazolható.")
  }finally{conn.disconnect()}
 }

 private fun read(path:String,session:AuthorizedSession):List<JSONObject>{
  val conn=(URL("${baseUrl.trimEnd('/')}/rest/v1/$path").openConnection() as HttpURLConnection).apply{
   requestMethod="GET";connectTimeout=12000;readTimeout=12000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
  }
  return try{
   if(conn.responseCode !in 200..299)error("A katalógusállapot nem tölthető be (${conn.responseCode}).")
   val arr=JSONArray(conn.inputStream.bufferedReader().use{it.readText()})
   (0 until arr.length()).map{arr.getJSONObject(it)}
  }finally{conn.disconnect()}
 }

 private fun JSONObject.optional(name:String):String?=if(isNull(name))null else optString(name).ifBlank{null}
}
