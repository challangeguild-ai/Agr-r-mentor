package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate
import java.time.ZoneId

data class AdvisorClient(
 val id:String,
 val name:String,
 val phone:String?,
 val farms:Int,
 val fields:Int,
 val critical:Int,
 val attention:Int
)

data class AdvisorTask(
 val id:String,
 val title:String,
 val fieldName:String,
 val status:String,
 val priority:String,
 val dueDate:String?,
 val assignedTo:String?=null,
 val taskKind:String="general",
 val fieldId:String?=null,
 val reportNotes:String?=null,
 val reportDate:String?=null,
 val reportReviewStatus:String?=null,
 val evidence:AdvisorTaskEvidence?=null,
 val plan:AdvisorTaskPlan?=null
)

/** Submitted work needs review; then urgent field work precedes later or routine work. */
internal fun priorityAdvisorTasks(tasks:List<AdvisorTask>):List<AdvisorTask> = tasks
 .filter{it.status !in setOf("done","cancelled")}
 .sortedWith(compareBy<AdvisorTask>{
  when{
   it.status=="submitted"->0
   it.priority=="urgent"->1
   it.priority=="high"->2
   else->3
  }
 }.thenBy{it.dueDate?:"9999-12-31"}.thenBy{it.title})

data class AdvisorWorkspace(
 val clients:List<AdvisorClient>,
 val tasks:List<AdvisorTask>,
 val openReports:Int,
 val totalFields:Int
)

data class AdvisorContact(val label:String,val value:String,val type:String,val primary:Boolean)
data class AdvisorFarmContacts(val name:String,val settlement:String?,val contacts:List<AdvisorContact>)
data class AdvisorContactDirectory(val own:List<AdvisorContact>,val farms:List<AdvisorFarmContacts>)

data class AdvisorDossierField(
 val id:String,
 val name:String,
 val areaHa:Double?,
 val crop:String?,
 val condition:String?,
 val lastInspection:String?,
 val openTasks:Int,
 val overdueTasks:Int
)

data class AdvisorDossierFarm(
 val id:String,
 val name:String,
 val countryCode:String,
 val fields:List<AdvisorDossierField>,
 val openTasks:Int
)

data class AdvisorClientDossier(
 val id:String,
 val name:String,
 val phone:String?,
 val farms:List<AdvisorDossierFarm>,
 val openTasks:Int,
 val awaitingReview:Int
)

internal fun dossierTaskOpen(status:String):Boolean = status !in setOf("done","cancelled","submitted")
internal fun dossierTaskOverdue(status:String,dueDate:String?,today:String):Boolean =
 dossierTaskOpen(status)&&dueDate!=null&&dueDate<today

data class AdminAccount(
 val id:String,
 val name:String,
 val role:String,
 val systemRole:String,
 val phone:String?
)

data class AdminSupportTask(
 val title:String,
 val farmName:String,
 val fieldName:String,
 val assignee:String,
 val status:String,
 val priority:String
)

data class AdminSecurityEvent(
 val title:String,
 val severity:String,
 val riskScore:Int,
 val occurredAt:String
)

data class AdminWorkspace(
 val users:List<AdminAccount>,
 val farms:Int,
 val fields:Int,
 val openReports:Int,
 val tasks:List<AdminSupportTask>,
 val securityEvents:List<AdminSecurityEvent>,
 val securityAvailable:Boolean
)

/**
 * Advisory and system-admin views use only the signed-in user's access token.
 * The mobile app NEVER embeds or emulates the web server's service-role client.
 * A missing grant or RLS policy is surfaced as a fetch failure, not bypassed.
 */
class RoleWorkspaceRepository(private val baseUrl:String,private val publishableKey:String){
 /** The same RLS-protected contacts that the web advisor maintains; no write authority is added. */
 suspend fun advisorContacts(session:AuthorizedSession):AdvisorContactDirectory = withContext(Dispatchers.IO){
  require(session.role==PortalRole.ADVISOR){"Elérhetőségeket csak szaktanácsadó nyithat meg."}
  require(session.userId.matches(Regex("[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}"))){"Érvénytelen felhasználóazonosító."}
  val farms=read("farms?select=id,name,settlement&order=name.asc&limit=1000",session).objects()
  val farmContacts=read("farm_contacts?select=farm_id,contact_type,label,value,is_primary&order=is_primary.desc&limit=1000",session).objects()
  val own=read("profile_contacts?select=contact_type,label,value,is_primary&profile_id=eq.${session.userId}&order=is_primary.desc&limit=100",session).objects()
  fun contact(value:JSONObject)=AdvisorContact(
   label=value.optString("label"),value=value.optString("value"),
   type=value.optString("contact_type"),primary=value.optBoolean("is_primary")
  )
  AdvisorContactDirectory(
   own=own.map(::contact),
   farms=farms.map{farm->
    AdvisorFarmContacts(
     name=farm.optString("name").ifBlank{"Gazdaság"},settlement=farm.optional("settlement"),
     contacts=farmContacts.filter{it.optString("farm_id")==farm.getString("id")}.map(::contact)
    )
   }
  )
 }

 /** Fetches only the requested farmer and the farms returned by advisor RLS. */
 suspend fun clientDossier(session:AuthorizedSession,clientId:String):AdvisorClientDossier = withContext(Dispatchers.IO){
  require(session.role==PortalRole.ADVISOR){"Ügyféldossziét csak szaktanácsadó nyithat meg."}
  require(clientId.matches(Regex("[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}"))){"Érvénytelen ügyfélazonosító."}
  val person=read("profiles?select=id,full_name,phone&role=eq.farmer&id=eq.$clientId&limit=1",session)
   .objects().singleOrNull()?:error("Ez az ügyfél nem érhető el a jogosultságaiddal.")
  val farms=read("farms?select=id,name,country_code,owner_id&owner_id=eq.$clientId&order=name.asc&limit=1000",session).objects()
  if(farms.isEmpty())return@withContext AdvisorClientDossier(clientId,person.optString("full_name").ifBlank{"Gazdálkodó"},person.optional("phone"),emptyList(),0,0)
  val farmIds=farms.map{it.getString("id")}
  val farmFilter="in.(${farmIds.joinToString(",")})"
  val fields=read("fields?select=id,name,farm_id,area_ha,current_crop&farm_id=$farmFilter&order=name.asc&limit=1000",session).objects()
  val fieldIds=fields.map{it.getString("id")}
  val inspections=if(fieldIds.isEmpty())emptyList() else read(
   "inspections?select=field_id,condition,inspected_at&field_id=in.(${fieldIds.joinToString(",")})&order=inspected_at.desc&limit=1000",session).objects()
  val latestByField=linkedMapOf<String,JSONObject>()
  inspections.forEach{item->latestByField.putIfAbsent(item.optString("field_id"),item)}
  val tasks=read("tasks?select=field_id,farm_id,status,due_date&farm_id=$farmFilter&order=due_date.asc&limit=1000",session).objects()
  val today=LocalDate.now(ZoneId.of("Europe/Budapest")).toString()
  val activeTasks=tasks.filter{dossierTaskOpen(it.optString("status"))}
  val dossierFarms=farms.map{farm->
   val farmId=farm.getString("id")
   AdvisorDossierFarm(
    id=farmId,
    name=farm.optString("name").ifBlank{"Gazdaság"},
    countryCode=farm.optString("country_code","HU"),
    fields=fields.filter{it.optString("farm_id")==farmId}.map{field->
     val fieldId=field.getString("id")
     val latest=latestByField[fieldId]
     val fieldTasks=activeTasks.filter{it.optString("field_id")==fieldId}
     AdvisorDossierField(
      id=fieldId,name=field.optString("name").ifBlank{"Földtábla"},
      areaHa=if(field.isNull("area_ha"))null else field.optDouble("area_ha").takeIf{it.isFinite()},
      crop=field.optional("current_crop"),condition=latest?.optional("condition"),
      lastInspection=latest?.optional("inspected_at"),openTasks=fieldTasks.size,
      overdueTasks=fieldTasks.count{dossierTaskOverdue(it.optString("status"),it.optional("due_date"),today)}
     )
    },
    openTasks=activeTasks.count{it.optString("farm_id")==farmId}
   )
  }
  AdvisorClientDossier(
   clientId,person.optString("full_name").ifBlank{"Gazdálkodó"},person.optional("phone"),
   dossierFarms,activeTasks.size,tasks.count{it.optString("status")=="submitted"}
  )
 }

 suspend fun advisor(session:AuthorizedSession):AdvisorWorkspace = withContext(Dispatchers.IO){
  val people=read("profiles?select=id,full_name,phone&role=eq.farmer&order=full_name.asc&limit=500",session)
  val farms=read("farms?select=id,name,owner_id&limit=1000",session)
  val fields=read("fields?select=id,name,farm_id,status&limit=1000",session)
  val inspections=read("inspections?select=field_id,condition,inspected_at&order=inspected_at.desc&limit=1000",session)
  val tasks=read("tasks?select=id,title,field_id,assigned_to,status,priority,due_date,task_kind&order=updated_at.desc&limit=300",session)
  // Only reports returned through RLS can be reviewed; never approve blind.
  val executionReports=runCatching{read("task_execution_reports?select=task_id,notes,operation_date,review_status,proof,actual_dose,dose_unit,actual_area,actual_quantity,quantity_unit,weather,finished_hours,worked_hectares&order=reported_at.desc&limit=500",session)}
   .getOrNull()?.objects()?.associateBy{it.optString("task_id")}.orEmpty()
  val operationPlans=runCatching{read("task_operation_plans?select=task_id,operation_type,product_name,crop,target,planned_dose,dose_unit,dose_min,dose_max,planned_area,planned_quantity&limit=500",session)}
   .getOrNull()?.objects()?.associateBy{it.optString("task_id")}.orEmpty()
  val reports=read("farmer_reports?select=id,status&status=neq.closed&limit=1000",session)

  val ownerByFarm=farms.objects().associate{it.getString("id") to it.optString("owner_id")}
  val fieldNames=fields.objects().associate{it.getString("id") to it.optString("name","Földtábla")}
  val fieldOwners=fields.objects().associate{it.getString("id") to ownerByFarm[it.optString("farm_id")]}
  val latest=linkedMapOf<String,String>()
  inspections.objects().forEach{entry->
   val fieldId=entry.optString("field_id")
   if(fieldId !in latest)latest[fieldId]=entry.optString("condition")
  }
  val farmers=people.objects().map{person->
   val personId=person.getString("id")
   val ownedFields=fieldOwners.filterValues{it==personId}.keys
   AdvisorClient(
    id=personId,
    name=person.optString("full_name").ifBlank{"Névtelen ügyfél"},
    phone=person.optional("phone"),
    farms=ownerByFarm.values.count{it==personId},
    fields=ownedFields.size,
    critical=ownedFields.count{latest[it]=="critical"},
    attention=ownedFields.count{latest[it]=="attention"}
   )
  }.sortedWith(compareByDescending<AdvisorClient>{it.critical}.thenByDescending{it.attention}.thenBy{it.name})

  AdvisorWorkspace(
   clients=farmers,
   tasks=tasks.objects().map{entry->
    val taskId=entry.getString("id")
    val report=executionReports[taskId]
    val rawPlan=operationPlans[taskId]
    AdvisorTask(
     id=entry.getString("id"),
     title=entry.optString("title","Teendő"),
     fieldName=fieldNames[entry.optString("field_id")]?:"Teljes gazdaság",
     status=entry.optString("status","open"),
     priority=entry.optString("priority","normal"),
     dueDate=entry.optional("due_date"),
     assignedTo=entry.optional("assigned_to"),
     taskKind=entry.optString("task_kind","general"),
     fieldId=entry.optional("field_id"),
     reportNotes=report?.optional("notes"),
     reportDate=report?.optional("operation_date"),
     reportReviewStatus=report?.optional("review_status"),
     evidence=if(entry.optional("field_id")!=null&&report!=null)
      AdvisorTaskEvidence.parse(report.optional("proof"),report,taskId,entry.optional("assigned_to")) else null,
     plan=rawPlan?.let{AdvisorTaskPlan(
      it.optional("operation_type"),it.optional("product_name"),it.optional("crop"),it.optional("target"),
      it.optional("planned_dose"),it.optional("dose_unit"),it.optional("dose_min"),it.optional("dose_max"),
      it.optional("planned_area"),it.optional("planned_quantity"))}
    )
   },
   openReports=reports.length(),
   totalFields=fields.length()
  )
 }

 suspend fun admin(session:AuthorizedSession):AdminWorkspace = withContext(Dispatchers.IO){
  val people=read("profiles?select=id,full_name,role,system_role,phone&limit=1000",session)
  val farms=read("farms?select=id,name&limit=1000",session)
  val fields=read("fields?select=id,name,farm_id&limit=1000",session)
  val tasks=read("tasks?select=id,title,field_id,farm_id,assigned_to,status,priority&order=created_at.desc&limit=120",session)
  val reports=read("farmer_reports?select=id,status&status=neq.closed&limit=1000",session)
  val events=runCatching{read("security_events?select=event_type,severity,risk_score,created_at&order=created_at.desc&limit=60",session)}

  val accounts=people.objects().map{row->
   AdminAccount(
    id=row.getString("id"),
    name=row.optString("full_name").ifBlank{"Névtelen felhasználó"},
    role=row.optString("role"),
    systemRole=row.optString("system_role"),
    phone=row.optional("phone")
   )
  }
  val farmNames=farms.objects().associate{it.getString("id") to it.optString("name","Gazdaság")}
  val fieldNames=fields.objects().associate{it.getString("id") to it.optString("name","Földtábla")}
  val usersById=accounts.associateBy{it.id}
  AdminWorkspace(
   users=accounts,
   farms=farms.length(),
   fields=fields.length(),
   openReports=reports.length(),
   tasks=tasks.objects().map{row->
    AdminSupportTask(
     title=row.optString("title","Teendő"),
     farmName=farmNames[row.optString("farm_id")]?:"Gazdaság",
     fieldName=fieldNames[row.optString("field_id")]?:"Teljes gazdaság",
     assignee=usersById[row.optString("assigned_to")]?.name?:"Nincs végrehajtó",
     status=row.optString("status","open"),
     priority=row.optString("priority","normal")
    )
   },
   securityEvents=events.getOrNull()?.objects().orEmpty().map{row->
    AdminSecurityEvent(
     title=row.optString("event_type","Biztonsági esemény"),
     severity=row.optString("severity","unknown"),
     riskScore=row.optInt("risk_score",0),
     occurredAt=row.optString("created_at","")
    )
   },
   securityAvailable=events.isSuccess
  )
 }

 private fun read(path:String,session:AuthorizedSession):JSONArray{
  val conn=(URL("${baseUrl.trimEnd('/')}/rest/v1/$path").openConnection() as HttpURLConnection).apply{
   requestMethod="GET";connectTimeout=12000;readTimeout=12000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
  }
  return try{
   val status=conn.responseCode
   if(status !in 200..299)error("Nincs jogosultság a kért adatokhoz vagy kapcsolati hiba ($status).")
   JSONArray(conn.inputStream.bufferedReader().use{it.readText()})
  }finally{conn.disconnect()}
 }
}

private fun JSONArray.objects():List<JSONObject> = (0 until length()).map{getJSONObject(it)}
private fun JSONObject.optional(field:String):String?=if(isNull(field))null else optString(field).ifBlank{null}
