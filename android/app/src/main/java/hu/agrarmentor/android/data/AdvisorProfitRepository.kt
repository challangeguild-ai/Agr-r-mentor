package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI
import kotlin.math.roundToLong

data class AdvisorFinanceSeason(val field:String,val crop:String,val year:Int,val harvested:Double,val figures:ProfitFigures)
data class AdvisorFinanceFarm(val name:String,val seasons:List<AdvisorFinanceSeason>)

internal fun parseAdvisorFinance(body:JSONObject):List<AdvisorFinanceFarm>{
 val farms=body.getJSONArray("farms")
 return (0 until farms.length()).map{i->
  val farm=farms.getJSONObject(i)
  val seasons=farm.getJSONArray("seasons")
  AdvisorFinanceFarm(farm.getString("name"),(0 until seasons.length()).map{j->
   val row=seasons.getJSONObject(j);val totals=row.getJSONObject("totals")
   AdvisorFinanceSeason(row.getString("fieldName"),row.getString("cropName"),row.getInt("year"),row.getDouble("harvestedTonnes"),
    ProfitFigures(totals.getDouble("totalCost").roundToLong(),totals.getDouble("realizedRevenue").roundToLong(),totals.getDouble("realizedResult").roundToLong(),totals.getDouble("projectedResult").roundToLong(),totals.getDouble("soldTonnes"),totals.getDouble("unsoldTonnes")))
  })
 }
}

/** No direct advisor Supabase finance-table query: only the logged HTTPS API. */
class AdvisorProfitRepository(private val webOrigin:String){
 suspend fun load(session:AuthorizedSession):List<AdvisorFinanceFarm> = withContext(Dispatchers.IO){
  require(session.role==PortalRole.ADVISOR){"Csak szaktanácsadói fiók használhatja."}
  val origin=URI(webOrigin.trimEnd('/'))
  require(origin.scheme=="https"&&origin.host!=null&&origin.userInfo==null&&origin.rawQuery==null&&origin.rawFragment==null&&origin.path.orEmpty().trim('/').isEmpty()){"Érvénytelen biztonságos szervercím."}
  val connection=(origin.resolve("/api/advisor/profit").toURL().openConnection() as HttpURLConnection).apply{
   requestMethod="GET";connectTimeout=12000;readTimeout=15000;useCaches=false
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
   setRequestProperty("Accept","application/json")
   setRequestProperty("Cache-Control","no-store")
  }
  try{
   if(connection.responseCode !in 200..299)error("A pénzügyi kimutatás nem érhető el (${connection.responseCode}).")
   parseAdvisorFinance(JSONObject(connection.inputStream.bufferedReader().use{it.readText()}))
  }finally{connection.disconnect()}
 }
}
