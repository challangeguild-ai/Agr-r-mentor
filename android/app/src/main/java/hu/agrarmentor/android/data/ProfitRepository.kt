package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.max
import kotlin.math.roundToLong

data class ProfitEntry(val type:String,val amount:Double=0.0,val quantity:Double=0.0,val unitPrice:Double=0.0)

data class ProfitFigures(val cost:Long,val realizedRevenue:Long,val realizedResult:Long,val projectedResult:Long,val soldTonnes:Double,val unsoldTonnes:Double)

/** All figures are calculated from recorded cost and sale rows, never invented sample data. */
fun calculateProfitFigures(harvestedTonnes:Double,expectedUnitPrice:Double,entries:List<ProfitEntry>):ProfitFigures{
 val cost=entries.filter{it.type=="cost"}.sumOf{max(0.0,it.amount)}.roundToLong()
 val sold=entries.filter{it.type=="sale"}.sumOf{max(0.0,it.quantity)}
 val revenue=entries.filter{it.type=="sale"}.sumOf{max(0.0,it.quantity)*max(0.0,it.unitPrice)}.roundToLong()
 val remaining=max(0.0,max(0.0,harvestedTonnes)-sold)
 val estimated=(remaining*max(0.0,expectedUnitPrice)).roundToLong()
 return ProfitFigures(cost,revenue,revenue-cost,revenue+estimated-cost,sold,remaining)
}

data class MobileProfitSeason(val id:String,val fieldName:String,val cropName:String,val year:Int,val harvestedTonnes:Double,val figures:ProfitFigures)

internal fun belongsToCurrentFarmer(row:JSONObject,userId:String,farmIds:Set<String>,fieldIds:Set<String>)=
 row.optString("created_by")==userId&&row.optString("farm_id") in farmIds&&row.optString("field_id") in fieldIds

internal fun belongsToCurrentFarmerEntry(row:JSONObject,userId:String,seasonIds:Set<String>)=
 row.optString("created_by")==userId&&row.optString("season_id") in seasonIds

/** A farmer can only load records visible through their own Supabase RLS token. */
class ProfitRepository(private val baseUrl:String,private val publishableKey:String){
 suspend fun load(session:AuthorizedSession):List<MobileProfitSeason> = withContext(Dispatchers.IO){
  val farmIds=fetchAll("farms?select=id&owner_id=eq.${session.userId}&order=id.asc",session.accessToken)
   .map{it.getString("id")}.toSet()
  if(farmIds.isEmpty())return@withContext emptyList()
  val fields=fetchAll("fields?select=id,farm_id,name&order=id.asc",session.accessToken)
   .filter{it.optString("farm_id") in farmIds}.associate{it.getString("id") to it.optString("name","Földtábla")}
  val seasons=fetchAll("field_profit_seasons?select=id,farm_id,field_id,created_by,season_year,crop_name,harvested_tonnes,expected_price_huf_per_tonne&created_by=eq.${session.userId}&order=season_year.desc,id.asc",session.accessToken)
   .filter{belongsToCurrentFarmer(it,session.userId,farmIds,fields.keys)}
  if(seasons.isEmpty())return@withContext emptyList()
  val seasonIds=seasons.map{it.getString("id")}.toSet()
  val entries=fetchAll("field_profit_entries?select=season_id,created_by,entry_type,amount_huf,quantity_tonnes,price_huf_per_tonne&created_by=eq.${session.userId}&order=id.asc",session.accessToken)
   .filter{belongsToCurrentFarmerEntry(it,session.userId,seasonIds)}.groupBy{it.getString("season_id")}
  seasons.map{season->
   val id=season.getString("id")
   val entryRows=entries[id].orEmpty().map{row->ProfitEntry(row.optString("entry_type"),row.optDouble("amount_huf",0.0),row.optDouble("quantity_tonnes",0.0),row.optDouble("price_huf_per_tonne",0.0))}
   MobileProfitSeason(id,fields[season.getString("field_id")]?:"Földtábla",season.optString("crop_name",""),season.optInt("season_year"),season.optDouble("harvested_tonnes",0.0),calculateProfitFigures(season.optDouble("harvested_tonnes",0.0),season.optDouble("expected_price_huf_per_tonne",0.0),entryRows))
  }
 }

 private fun fetchAll(path:String,token:String):List<JSONObject> = collectPostgrestPages(path){pagedPath->
  val connection=(URL("${baseUrl.trimEnd('/')}/rest/v1/$pagedPath").openConnection() as HttpURLConnection).apply{
   requestMethod="GET";connectTimeout=12000;readTimeout=12000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer $token")
  }
  try{
   if(connection.responseCode !in 200..299)error("A jövedelmezőségi adatok nem érhetők el (${connection.responseCode}).")
   val json=JSONArray(connection.inputStream.bufferedReader().use{it.readText()})
   (0 until json.length()).map{json.getJSONObject(it)}
  }finally{connection.disconnect()}
 }
}
