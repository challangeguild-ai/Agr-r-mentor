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

data class AdvisorTeamMember(val name:String,val phone:String?,val farmName:String,val memberRole:String,val active:Boolean)

internal fun teamRoleLabel(role:String):String=when(role){
 "agronomist"->"Agronómus"
 "manager"->"Gazdaságvezető"
 "operator"->"Traktoros / gépkezelő"
 "harvester"->"Kombájnos"
 "worker"->"Munkatárs"
 else->"Munkatárs"
}

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

data class AdminInventoryFarm(val id:String,val name:String)
data class AdminInventoryField(
 val id:String,val name:String,val farmId:String,val farmName:String,
 val areaHa:String?,val crop:String?,val settlement:String?,val status:String?
)

data class AdminWorkspace(
 val users:List<AdminAccount>,
 val farms:Int,
 val fields:Int,
 val farmList:List<AdminInventoryFarm>,
 val fieldList:List<AdminInventoryField>,
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
 /** RLS-backed view of farm members; never changes assignments or user roles. */
 suspend fun advisorTeam(session:AuthorizedSession):List<AdvisorTeamMember> = withContext(Dispatchers.IO){
  require(session.role==PortalRole.ADVISOR){"Ügyfélcsapatokat csak szaktanácsadó tekinthet meg."}
  val farms=readAll("farms?select=id,name&order=id.asc",session).objects()
  val members=readAll("farm_members?select=farm_id,user_id,member_role,active&order=created_at.desc,id.desc",session).objects()
  val ids=members.mapNotNull{it.optional("user_id")}.distinct()
  val people=ids.chunked(100).flatMap{batch->
   read("profiles?select=id,full_name,phone&id=in.(${batch.joinToString(",")})&limit=100",session).objects()
  }
  val personById=people.associateBy{it.getString("id")}
  val farmById=farms.associateBy{it.getString("id")}
  members.map{member->
   val person=personById[member.optString("user_id")]
   AdvisorTeamMember(
    name=person?.optString("full_name")?.ifBlank{"Munkatárs"}?:"Munkatárs",
    phone=person?.optional("phone"),
    farmName=farmById[member.optString("farm_id")]?.optString("name")?:"Gazdaság",
    memberRole=member.optString("member_role"),active=member.optBoolean("active")
   )
  }
 }

 /** The same RLS-protected contacts that the web advisor maintains; no write authority is added. */
 suspend fun advisorContacts(session:AuthorizedSession):AdvisorContactDirectory = withContext(Dispatchers.IO){
  require(session.role==PortalRole.ADVISOR){"Elérhetőségeket csak szaktanácsadó nyithat meg."}
  require(session.userId.matches(Regex("[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}"))){"Érvénytelen felhasználóazonosító."}
  val farms=readAll("farms?select=id,name,settlement&order=name.asc,id.asc",session).objects()
  val farmContacts=readAll("farm_contacts?select=farm_id,contact_type,label,value,is_primary&order=is_primary.desc,id.asc",session).objects()
  val contactsByFarm=farmContacts.groupBy{it.optString("farm_id")}
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
     contacts=contactsByFarm[farm.getString("id")].orEmpty().map(::contact)
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
  val farms=readAll("farms?select=id,name,country_code,owner_id&owner_id=eq.$clientId&order=name.asc,id.asc",session).objects()
  if(farms.isEmpty())return@withContext AdvisorClientDossier(clientId,person.optString("full_name").ifBlank{"Gazdálkodó"},person.optional("phone"),emptyList(),0,0)
  val farmIds=farms.map{it.getString("id")}
  val fields=farmIds.chunked(50).flatMap{ids->
   readAll("fields?select=id,name,farm_id,area_ha,current_crop&farm_id=in.(${ids.joinToString(",")})&order=name.asc,id.asc",session).objects()
  }
  val fieldIds=fields.map{it.getString("id")}
  val inspections=fieldIds.chunked(50).flatMap{ids->
   readAll("inspections?select=field_id,condition,inspected_at&field_id=in.(${ids.joinToString(",")})&order=inspected_at.desc,id.desc",session).objects()
  }.sortedWith(compareByDescending<JSONObject>{it.optString("inspected_at")}.thenByDescending{it.optString("id")})
  val latestByField=linkedMapOf<String,JSONObject>()
  inspections.forEach{item->latestByField.putIfAbsent(item.optString("field_id"),item)}
  val tasks=farmIds.chunked(50).flatMap{ids->
   readAll("tasks?select=field_id,farm_id,status,due_date&farm_id=in.(${ids.joinToString(",")})&order=due_date.asc,id.asc",session).objects()
  }
  val today=LocalDate.now(ZoneId.of("Europe/Budapest")).toString()
  val activeTasks=tasks.filter{dossierTaskOpen(it.optString("status"))}
  val fieldsByFarm=fields.groupBy{it.optString("farm_id")}
  val tasksByFarm=activeTasks.groupBy{it.optString("farm_id")}
  val tasksByField=activeTasks.groupBy{it.optString("field_id")}
  val dossierFarms=farms.map{farm->
   val farmId=farm.getString("id")
   AdvisorDossierFarm(
    id=farmId,
    name=farm.optString("name").ifBlank{"Gazdaság"},
    countryCode=farm.optString("country_code","HU"),
    fields=fieldsByFarm[farmId].orEmpty().map{field->
     val fieldId=field.getString("id")
     val latest=latestByField[fieldId]
     val fieldTasks=tasksByField[fieldId].orEmpty()
     AdvisorDossierField(
      id=fieldId,name=field.optString("name").ifBlank{"Földtábla"},
      areaHa=if(field.isNull("area_ha"))null else field.optDouble("area_ha").takeIf{it.isFinite()},
      crop=field.optional("current_crop"),condition=latest?.optional("condition"),
      lastInspection=latest?.optional("inspected_at"),openTasks=fieldTasks.size,
      overdueTasks=fieldTasks.count{dossierTaskOverdue(it.optString("status"),it.optional("due_date"),today)}
     )
    },
    openTasks=tasksByFarm[farmId].orEmpty().size
   )
  }
  AdvisorClientDossier(
   clientId,person.optString("full_name").ifBlank{"Gazdálkodó"},person.optional("phone"),
   dossierFarms,activeTasks.size,tasks.count{it.optString("status")=="submitted"}
  )
 }

 suspend fun advisor(session:AuthorizedSession):AdvisorWorkspace = withContext(Dispatchers.IO){
  require(session.role==PortalRole.ADVISOR){"A szaktanácsadói portfólió csak szaktanácsadóknak érhető el."}
  val people=readAll("profiles?select=id,full_name,phone&role=eq.farmer&order=full_name.asc,id.asc",session)
  val farms=readAll("farms?select=id,name,owner_id&order=id.asc",session)
  val fields=readAll("fields?select=id,name,farm_id,status&order=id.asc",session)
  val inspections=readAll("inspections?select=field_id,condition,inspected_at&order=inspected_at.desc,id.desc",session)
  val tasks=readAll("tasks?select=id,title,field_id,assigned_to,status,priority,due_date,task_kind&order=updated_at.desc,id.desc",session)
  // Only reports returned through RLS can be reviewed; never approve blind.
  val executionReports=runCatching{readAll("task_execution_reports?select=task_id,notes,operation_date,review_status,proof,actual_dose,dose_unit,actual_area,actual_quantity,quantity_unit,weather,finished_hours,worked_hectares&order=reported_at.desc,task_id.asc",session)}
   .getOrNull()?.objects()?.associateBy{it.optString("task_id")}.orEmpty()
  val operationPlans=runCatching{readAll("task_operation_plans?select=task_id,operation_type,product_name,crop,target,planned_dose,dose_unit,dose_min,dose_max,planned_area,planned_quantity&order=task_id.asc",session)}
   .getOrNull()?.objects()?.associateBy{it.optString("task_id")}.orEmpty()
  val reports=readAll("farmer_reports?select=id,status&status=neq.closed&order=id.asc",session)

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
  require(session.role==PortalRole.SYSTEM_ADMIN){"A rendszeradmin-felülethez rendszeradmin jogosultság szükséges."}
  val people=readAll("profiles?select=id,full_name,role,system_role,phone&order=id.asc",session)
  val farms=readAll("farms?select=id,name&order=id.asc",session)
  val fields=readAll("fields?select=id,name,farm_id,area_ha,current_crop,settlement,status&order=id.asc",session)
  val tasks=read("tasks?select=id,title,field_id,farm_id,assigned_to,status,priority&order=created_at.desc&limit=120",session)
  val reports=readAll("farmer_reports?select=id,status&status=neq.closed&order=id.asc",session)
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
   farmList=farms.objects().map{row->AdminInventoryFarm(row.getString("id"),row.optString("name","Gazdaság"))},
   fieldList=fields.objects().map{row->AdminInventoryField(
    row.getString("id"),row.optString("name","Földtábla"),row.optString("farm_id"),
    farmNames[row.optString("farm_id")]?:"Gazdaság",row.optional("area_ha"),
    row.optional("current_crop"),row.optional("settlement"),row.optional("status")
   )},
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

 /** Preserve legacy JSONArray consumers while fetching every authorized page. */
 private fun readAll(path:String,session:AuthorizedSession):JSONArray{
  val rows=collectPostgrestPages(path){pagedPath->read(pagedPath,session).objects()}
  val result=JSONArray()
  rows.forEach{result.put(it)}
  return result
 }
}

private fun JSONArray.objects():List<JSONObject> = (0 until length()).map{getJSONObject(it)}
private fun JSONObject.optional(field:String):String?=if(isNull(field))null else optString(field).ifBlank{null}
