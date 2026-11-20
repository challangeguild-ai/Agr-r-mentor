package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

enum class WorkdayKind { TASK, CHECK, VISIT }

data class AdvisorWorkdayItem(
 val kind:WorkdayKind,val title:String,val subtitle:String,val dueDay:String?,
 val fieldId:String?=null,val priority:String="normal",val scheduledTime:String?=null
)

data class PlannedAdvisorVisit(val day:String,val purpose:String,val time:String?)

data class AdvisorWorkdaySnapshot(
 val items:List<AdvisorWorkdayItem>,val openReports:Int,val criticalFields:Int
)

internal fun workdayItemsForDay(items:List<AdvisorWorkdayItem>,day:String)=items
 .filter{it.dueDay==day}
 .sortedWith(compareBy<AdvisorWorkdayItem>{when(it.kind){WorkdayKind.VISIT->0;WorkdayKind.CHECK->1;WorkdayKind.TASK->2}}
  .thenBy{it.scheduledTime?:"99:99"}.thenBy{it.title})

internal fun workdayOverdueItems(items:List<AdvisorWorkdayItem>,today:String)=items
 .filter{it.dueDay!=null&&it.dueDay<today}
 .sortedWith(compareBy<AdvisorWorkdayItem>{it.dueDay}.thenBy{it.title})

internal fun workdayUnscheduledTasks(items:List<AdvisorWorkdayItem>)=items.filter{it.kind==WorkdayKind.TASK&&it.dueDay==null}

/** Dates are compared in the farm's Hungarian calendar day, including UTC timestamps. */
internal fun workdayHungarianDay(value:String?):String?{
 if(value.isNullOrBlank())return null
 return runCatching{OffsetDateTime.parse(value).atZoneSameInstant(ZoneId.of("Europe/Budapest")).toLocalDate().toString()}
  .getOrElse{value.take(10).takeIf{it.matches(Regex("\\d{4}-\\d{2}-\\d{2}"))}}
}

internal fun decodePlannedAdvisorVisit(description:String?):PlannedAdvisorVisit?{
 if(description?.startsWith("ADVISORVISIT:")!=true)return null
 return runCatching{
  val json=JSONObject(description.removePrefix("ADVISORVISIT:"))
  val stamp=json.optString("scheduledAt")
  val day=workdayHungarianDay(stamp)
  if(json.optString("status","planned")!="planned"||day==null)null
  else PlannedAdvisorVisit(day,json.optString("purpose").ifBlank{"Helyszíni szaktanácsadás"},
   runCatching{OffsetDateTime.parse(stamp).atZoneSameInstant(ZoneId.of("Europe/Budapest")).format(DateTimeFormatter.ofPattern("HH:mm"))}.getOrNull())
 }.getOrNull()
}

/** All rows are fetched with the logged-in advisor's JWT and checked by Postgres RLS. */
class AdvisorWorkdayRepository(private val baseUrl:String,private val publishableKey:String){
 suspend fun load(session:AuthorizedSession):AdvisorWorkdaySnapshot = withContext(Dispatchers.IO){
  require(session.role==PortalRole.ADVISOR){"Munkanapot csak szaktanácsadó tekinthet meg."}
  require(session.userId.matches(Regex("[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}"))){"Érvénytelen felhasználóazonosító."}
  val farms=read("farms?select=id,name&limit=1000",session).associateBy{it.getString("id")}
  val fields=read("fields?select=id,name,farm_id&limit=1000",session).associateBy{it.getString("id")}
  val tasks=read("tasks?select=id,title,field_id,farm_id,status,due_date,priority&status=neq.done&limit=500",session)
  val inspections=read("inspections?select=field_id,condition,next_check_at,issue_status,recommendation&issue_status=neq.resolved&limit=500",session)
  val visits=read("timeline_events?select=description,field_id,farm_id&event_type=eq.advisor_visit_plan&created_by=eq.${session.userId}&limit=300",session)
  val reports=read("farmer_reports?select=id&status=neq.closed&limit=1000",session)
  fun subtitle(fieldId:String?,farmId:String?):String{
   val field=fieldId?.let{fields[it]}
   val farm=(farmId?:field?.optString("farm_id"))?.let{farms[it]}
   return listOfNotNull(farm?.optString("name")?.takeIf{it.isNotBlank()},field?.optString("name")?.takeIf{it.isNotBlank()})
    .joinToString(" · ").ifBlank{"Gazdaság"}
  }
  val taskItems=tasks.filter{it.optString("status")!="cancelled"}.map{item->
   AdvisorWorkdayItem(WorkdayKind.TASK,item.optString("title","Feladat"),
    subtitle(item.optional("field_id"),item.optional("farm_id")),workdayHungarianDay(item.optional("due_date")),
    item.optional("field_id"),item.optString("priority","normal"))
  }
  val checkItems=inspections.mapNotNull{item->
   val day=workdayHungarianDay(item.optional("next_check_at"))?:return@mapNotNull null
   val fieldId=item.optional("field_id")
   AdvisorWorkdayItem(WorkdayKind.CHECK,
    if(item.optString("condition")=="critical")"Kritikus visszaellenőrzés" else "Táblavisszaellenőrzés",
    subtitle(fieldId,null),day,fieldId,if(item.optString("condition")=="critical")"urgent" else "high")
  }
  val visitItems=visits.mapNotNull{item->
   val visit=decodePlannedAdvisorVisit(item.optional("description"))?:return@mapNotNull null
   AdvisorWorkdayItem(WorkdayKind.VISIT,visit.purpose,
    subtitle(item.optional("field_id"),item.optional("farm_id")),visit.day,item.optional("field_id"),scheduledTime=visit.time)
  }
  AdvisorWorkdaySnapshot(taskItems+checkItems+visitItems,reports.size,
   inspections.filter{it.optString("condition")=="critical"}.map{it.optString("field_id")}.filter{it.isNotBlank()}.distinct().size)
 }

 private fun read(path:String,session:AuthorizedSession):List<JSONObject>{
  val conn=(URL("${baseUrl.trimEnd('/')}/rest/v1/$path").openConnection() as HttpURLConnection).apply{
   requestMethod="GET";connectTimeout=12000;readTimeout=12000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
  }
  return try{
   val status=conn.responseCode
   if(status !in 200..299)error("A munkanap adatai nem érhetők el ($status).")
   val arr=JSONArray(conn.inputStream.bufferedReader().use{it.readText()})
   (0 until arr.length()).map{arr.getJSONObject(it)}
  }finally{conn.disconnect()}
 }

 private fun JSONObject.optional(key:String):String?=if(isNull(key))null else optString(key).ifBlank{null}
}
