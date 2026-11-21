package hu.agrarmentor.android.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.TextButton
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.agrarmentor.android.BuildConfig
import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.data.AdminWorkspace
import hu.agrarmentor.android.data.AdvisorClientDossier
import hu.agrarmentor.android.data.AdvisorContact
import hu.agrarmentor.android.data.AdvisorContactDirectory
import hu.agrarmentor.android.data.AdvisorTask
import hu.agrarmentor.android.data.AdvisorTaskReview
import hu.agrarmentor.android.data.AdvisorTeamMember
import hu.agrarmentor.android.data.AdvisorWorkspace
import hu.agrarmentor.android.data.RoleWorkspaceRepository
import hu.agrarmentor.android.data.priorityAdvisorTasks
import hu.agrarmentor.android.data.teamRoleLabel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

private val Ink=Color(0xFF24372E)
private val SoftInk=Color(0xFF718078)
private val Critical=Color(0xFFC9424E)
private val Attention=Color(0xFFE3AD37)

/**
 * Read-only role dashboards. The access token and database RLS govern every row;
 * no service-role token is stored in the APK and no admin mutations are offered.
 */
@Composable
internal fun AdvisorWorkspaceScreen(route:String,session:AuthorizedSession,colors:PortalPalette,onNavigate:(String)->Unit){
 val repo=remember{RoleWorkspaceRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 var snapshot by remember(session.accessToken){mutableStateOf<AdvisorWorkspace?>(null)}
 var busy by remember(session.accessToken){mutableStateOf(true)}
 var failed by remember(session.accessToken){mutableStateOf(false)}
 var revision by remember{mutableIntStateOf(0)}
 LaunchedEffect(session.accessToken,revision){
  busy=true;failed=false
  try{snapshot=repo.advisor(session)}
  catch(e:CancellationException){throw e}
  catch(_:Exception){failed=true}
  finally{busy=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  if(busy)CircularProgressIndicator(color=colors.accent)
  else if(failed)LoadError(colors,onRetry={revision++})
  else snapshot?.let{data->
   when(route){
    "/admin"->AdvisorDashboard(data,colors,onNavigate)
    "/admin/clients","/admin/portfolio"->AdvisorClients(data,colors,onNavigate)
    "/admin/priorities"->AdvisorPriorities(data,colors,onNavigate)
    "/admin/tasks","/admin/daily-work"->AdvisorTasks(data,colors,session,onlyOpen=route=="/admin/daily-work",onNavigate=onNavigate,onReviewed={revision++})
    "/admin/tasks/review"->AdvisorTasks(data,colors,session,onlyOpen=false,onNavigate=onNavigate,onReviewed={revision++},statusFilter="submitted")
    else->if(route.startsWith("/admin/tasks/")&&route.removePrefix("/admin/tasks/").isNotBlank()){
     AdvisorTasks(data,colors,session,onlyOpen=false,onNavigate=onNavigate,onReviewed={revision++},selectedTaskId=route.removePrefix("/admin/tasks/"))
    }
   }
  }
 }
}
@Composable
private fun AdvisorDashboard(data:AdvisorWorkspace,colors:PortalPalette,onNavigate:(String)->Unit){
 val pending=data.tasks.count{it.status=="submitted"}
 val open=data.tasks.count{it.status!="done"&&it.status!="cancelled"}
 PortalHero("Mai szakmai áttekintés","Ügyfelek, feladatok és nyitott jelzések",colors,onClick={onNavigate("/admin/daily-work")})
 Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
  Box(Modifier.weight(1f)){PortalMetric("Ügyfelek",data.clients.size.toString(),colors){onNavigate("/admin/clients")}}
  Box(Modifier.weight(1f)){PortalMetric("Táblák",data.totalFields.toString(),colors){onNavigate("/admin/map")}}
 }
 Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
  Box(Modifier.weight(1f)){PortalMetric("Nyitott teendők",open.toString(),colors){onNavigate("/admin/tasks")}}
  Box(Modifier.weight(1f)){PortalMetric("Ellenőrzésre vár",pending.toString(),colors){onNavigate("/admin/tasks/review")}}
 }
 PortalMetric("Nyitott gazdálkodói jelzések",data.openReports.toString(),colors){onNavigate("/admin/reports")}
 listOf(
  Triple("Mai prioritások","Határidők és figyelmet igénylő ügyek","/admin/daily-work"),
  Triple("Szemlék","Helyszíni állapot és visszaellenőrzés","/admin/inspections"),
  Triple("Látogatások","Terepi ügyféllátogatások","/admin/visits"),
  Triple("Műveletek","Ügyfelek műveleti naplója","/admin/operations")
 ).forEach{(title,description,path)->PortalRouteTile(title,description,colors){onNavigate(path)}}
 Text("Az összesítők a jelenleg elérhető adatokból készülnek.",fontSize=12.sp,color=SoftInk)
}

@Composable
private fun AdvisorPriorities(data:AdvisorWorkspace,colors:PortalPalette,onNavigate:(String)->Unit){
 Text("Ügyfelek és ellenőrzést igénylő munkák, valódi prioritási sorrendben",fontSize=14.sp,color=SoftInk)
 val needAttention=data.clients.filter{it.critical>0||it.attention>0}
 Card(colors){
  Text("Figyelmet igénylő ügyfelek",color=Ink,fontSize=17.sp,fontWeight=FontWeight.Bold)
  Text("${needAttention.size} ügyfél",color=colors.accent,fontSize=14.sp)
 }
 if(needAttention.isEmpty())Text("Nincs rögzített kritikus vagy figyelmet igénylő szemleállapot.",color=SoftInk,fontSize=13.sp)
 needAttention.take(20).forEach{client->
  Card(colors,border=if(client.critical>0)Critical else Attention,onClick={onNavigate("/admin/clients/${client.id}")}){
   Row(verticalAlignment=Alignment.CenterVertically){
    Text(client.name,color=Ink,fontWeight=FontWeight.Bold,modifier=Modifier.weight(1f))
    Icon(Icons.Default.ChevronRight,"Ügyféldosszié",tint=colors.accent)
   }
   Text("${client.critical} kritikus · ${client.attention} figyelmeztetés · ${client.fields} tábla",color=SoftInk,fontSize=12.sp)
  }
 }
 val tasks=priorityAdvisorTasks(data.tasks)
 Card(colors){
  Text("Következő szakmai teendők",color=Ink,fontSize=17.sp,fontWeight=FontWeight.Bold)
  Text("${tasks.size} nyitott vagy ellenőrzésre váró tétel",color=colors.accent,fontSize=14.sp)
 }
 if(tasks.isEmpty())Text("Jelenleg nincs soron következő feladat.",color=SoftInk,fontSize=13.sp)
 tasks.take(20).forEach{task->
  Card(colors,onClick={onNavigate("/admin/tasks/${task.id}")}){
   Row(verticalAlignment=Alignment.CenterVertically){
    Column(Modifier.weight(1f)){
     Text(task.title,color=Ink,fontSize=15.sp,fontWeight=FontWeight.Bold)
     Text(task.fieldName,color=SoftInk,fontSize=12.sp)
    }
    Text(if(task.status=="submitted")"Ellenőrzés" else if(task.priority=="urgent")"Sürgős" else if(task.priority=="high")"Fontos" else "Teendő",color=if(task.status=="submitted"||task.priority=="urgent")Critical else colors.accent,fontSize=11.sp,fontWeight=FontWeight.Bold)
   }
   task.dueDate?.let{Text("Határidő: ${huDate(it)}",color=SoftInk,fontSize=12.sp)}
  }
 }
 if(needAttention.size>20)TextButton(onClick={onNavigate("/admin/clients")}){Text("Minden érintett ügyfél megnyitása ›",color=colors.accent)}
 if(tasks.size>20)TextButton(onClick={onNavigate("/admin/tasks")}){Text("Teljes szakmai feladatlista ›",color=colors.accent)}
}

@Composable
private fun AdvisorClients(data:AdvisorWorkspace,colors:PortalPalette,onNavigate:(String)->Unit){
 var query by remember{mutableStateOf("")}
 var shown by remember{mutableIntStateOf(40)}
 val filtered=data.clients.filter{it.name.contains(query,true)||it.phone?.contains(query,true)==true}
 Text("Gazdálkodók – figyelmeztetési sorrendben",fontSize=14.sp,color=SoftInk)
 OutlinedTextField(value=query,onValueChange={query=it;shown=40},label={Text("Ügyfél keresése")},singleLine=true,modifier=Modifier.fillMaxWidth())
 Text("${filtered.size} találat",fontSize=12.sp,color=SoftInk)
 if(filtered.isEmpty())Text(if(data.clients.isEmpty())"Nincs elérhető gazdálkodói ügyfél." else "Nincs a keresésnek megfelelő ügyfél.",color=SoftInk)
 filtered.take(shown).forEach{client->
  val severity=when{client.critical>0->Critical;client.attention>0->Attention;else->colors.border}
  Card(colors,border=severity,onClick={onNavigate("/admin/clients/${client.id}")}){
   Row(verticalAlignment=Alignment.CenterVertically){
    Icon(Icons.Default.Person,null,tint=colors.accent)
    Spacer(Modifier.width(10.dp))
    Column(Modifier.weight(1f)){
     Text(client.name,color=Ink,fontSize=17.sp,fontWeight=FontWeight.Bold)
     if(client.phone!=null)Text(client.phone,color=SoftInk,fontSize=12.sp)
    }
    Text(if(client.critical>0)"Kritikus" else if(client.attention>0)"Figyelmet igényel" else "Rendben",fontSize=11.sp,color=if(client.critical>0)Critical else if(client.attention>0)Color(0xFF936611)else colors.accent,fontWeight=FontWeight.Bold)
   }
   Text("${client.farms} gazdaság · ${client.fields} tábla",color=SoftInk,fontSize=13.sp)
   if(client.critical+client.attention>0)Text("${client.critical} kritikus · ${client.attention} figyelmeztetés",color=Ink,fontSize=12.sp)
   Text("Ügyféldosszié megnyitása ›",color=colors.accent,fontSize=12.sp,fontWeight=FontWeight.SemiBold)
  }
 }
 if(filtered.size>shown)TextButton(onClick={shown+=40}){Text("További ügyfelek ›",color=colors.accent)}
}

@Composable
internal fun AdvisorContactsScreen(session:AuthorizedSession,colors:PortalPalette){
 val repo=remember{RoleWorkspaceRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 var contacts by remember(session.accessToken){mutableStateOf<AdvisorContactDirectory?>(null)}
 var busy by remember(session.accessToken){mutableStateOf(true)}
 var error by remember(session.accessToken){mutableStateOf<String?>(null)}
 var revision by remember{mutableIntStateOf(0)}
 LaunchedEffect(session.accessToken,revision){
  busy=true;error=null
  try{contacts=repo.advisorContacts(session)}
  catch(e:CancellationException){throw e}
  catch(e:Exception){error=e.message?:"Az elérhetőségek nem tölthetők be."}
  finally{busy=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  Text("Gazdasági kapcsolattartók és saját megosztott elérhetőségek",color=SoftInk,fontSize=14.sp)
  if(busy)CircularProgressIndicator(color=colors.accent)
  else if(error!=null){
   Text(error!!,color=Critical,fontSize=13.sp)
   TextButton(onClick={revision++}){Text("Újrapróbálás")}
  }else contacts?.let{directory->
   Card(colors,background=colors.tint){
    Text("Saját szaktanácsadói elérhetőségek",fontSize=17.sp,fontWeight=FontWeight.Bold,color=Ink)
    if(directory.own.isEmpty())Text("Még nincs megadott elérhetőség.",color=SoftInk,fontSize=13.sp)
    directory.own.forEach{AdvisorContactLine(it,colors)}
   }
   Text("Gazdasági kapcsolattartók (${directory.farms.size} gazdaság)",fontSize=17.sp,fontWeight=FontWeight.Bold,color=Ink)
   if(directory.farms.isEmpty())Text("Nincs elérhető gazdaság.",color=SoftInk,fontSize=13.sp)
   directory.farms.forEach{farm->
    Card(colors){
     Text(farm.name,color=Ink,fontSize=16.sp,fontWeight=FontWeight.Bold)
     farm.settlement?.let{Text(it,color=SoftInk,fontSize=12.sp)}
     if(farm.contacts.isEmpty())Text("Nincs rögzített kapcsolattartó.",color=SoftInk,fontSize=12.sp)
     farm.contacts.forEach{AdvisorContactLine(it,colors)}
    }
   }
   Text("A kapcsolattartók szerkesztése a webes Agrár Mentor felületen érhető el. A változások itt is megjelennek újratöltés után.",fontSize=12.sp,color=SoftInk)
  }
 }
}

@Composable
private fun AdvisorContactLine(contact:AdvisorContact,colors:PortalPalette){
 val context=LocalContext.current
 Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(8.dp)){
  Column(Modifier.weight(1f)){
   Text(contact.label.ifBlank{if(contact.type=="email")"E-mail" else "Telefon"},color=Ink,fontSize=13.sp,fontWeight=FontWeight.SemiBold)
   Text(contact.value,color=SoftInk,fontSize=13.sp)
   if(contact.primary)Text("Elsődleges",color=colors.accent,fontSize=11.sp)
  }
  if(contact.value.isNotBlank()&&contact.type in listOf("phone","email")){
   TextButton(onClick={
    val email=contact.type=="email"
    val intent=Intent(if(email)Intent.ACTION_SENDTO else Intent.ACTION_DIAL,Uri.fromParts(if(email)"mailto" else "tel",contact.value,null))
    runCatching{context.startActivity(intent)}
   }){Text(if(contact.type=="email")"E-mail" else "Hívás",color=colors.accent)}
  }
 }
}

@Composable
internal fun AdvisorTeamScreen(session:AuthorizedSession,colors:PortalPalette){
 val repo=remember{RoleWorkspaceRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 var team by remember(session.accessToken){mutableStateOf<List<AdvisorTeamMember>?>(null)}
 var busy by remember(session.accessToken){mutableStateOf(true)}
 var error by remember(session.accessToken){mutableStateOf<String?>(null)}
 var revision by remember{mutableIntStateOf(0)}
 var teamFilter by remember{mutableStateOf("all")}
 var openedMember by remember{mutableStateOf<AdvisorTeamMember?>(null)}
 LaunchedEffect(session.accessToken,revision){
  busy=true;error=null
  try{team=repo.advisorTeam(session)}
  catch(e:CancellationException){throw e}
  catch(e:Exception){error=e.message?:"A csapatlista nem tölthető be."}
  finally{busy=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  Text("Ügyfélgazdaságok munkatársai és munkakiosztási szerepkörei",color=SoftInk,fontSize=14.sp)
  if(busy)CircularProgressIndicator(color=colors.accent)
  else if(error!=null){
   Text(error!!,color=Critical,fontSize=13.sp)
   TextButton(onClick={revision++}){Text("Újrapróbálás")}
  }else team?.let{members->
   val active=members.filter{it.active}
   Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
    Box(Modifier.weight(1f)){PortalMetric("Aktív munkatárs",active.size.toString(),colors){teamFilter="active"}}
    Box(Modifier.weight(1f)){PortalMetric("Vezető / agronómus",active.count{it.memberRole in listOf("manager","agronomist")}.toString(),colors){teamFilter="leaders"}}
   }
   Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
    Box(Modifier.weight(1f)){PortalMetric("Gépkezelő",active.count{it.memberRole=="operator"}.toString(),colors){teamFilter="operator"}}
    Box(Modifier.weight(1f)){PortalMetric("Kombájnos",active.count{it.memberRole=="harvester"}.toString(),colors){teamFilter="harvester"}}
   }
   if(teamFilter!="all")TextButton(onClick={teamFilter="all"}){Text("Minden munkatárs megjelenítése",color=colors.accent)}
   if(members.isEmpty())Text("Még nincs ügyfélgazdasághoz rendelt munkatárs.",color=SoftInk,fontSize=13.sp)
   members.filter{when(teamFilter){"active"->it.active;"leaders"->it.active&&it.memberRole in listOf("manager","agronomist");"operator","harvester"->it.active&&it.memberRole==teamFilter;else->true}}.forEach{member->
    Card(colors,border=if(member.active)colors.border else Attention,onClick={openedMember=member}){
     Row(verticalAlignment=Alignment.CenterVertically){
      Text(member.name,color=Ink,fontSize=16.sp,fontWeight=FontWeight.Bold,modifier=Modifier.weight(1f))
      Text(if(member.active)"Aktív" else "Felfüggesztve",color=if(member.active)colors.accent else Critical,fontSize=12.sp)
     }
     Text("${member.farmName} · ${teamRoleLabel(member.memberRole)}",color=SoftInk,fontSize=13.sp)
     member.phone?.let{Text(it,color=SoftInk,fontSize=12.sp)}
    }
   }
   Text("A munkatársi szerepkör nem helyettesíti a növényvédelmi jogosultság igazolását. A csapattagság szerkesztése a webes felületen történik.",fontSize=12.sp,color=SoftInk)
   openedMember?.let{member->AlertDialog(onDismissRequest={openedMember=null},title={Text(member.name)},text={Column(verticalArrangement=Arrangement.spacedBy(7.dp)){
    Text("Gazdaság: ${member.farmName}")
    Text("Szerepkör: ${teamRoleLabel(member.memberRole)}")
    Text("Állapot: ${if(member.active)"Aktív" else "Felfüggesztve"}")
    member.phone?.let{Text("Telefon: $it")}
   }},confirmButton={TextButton(onClick={openedMember=null}){Text("Bezárás")}})}
  }
 }
}

@Composable
internal fun AdvisorClientDossierScreen(clientId:String,session:AuthorizedSession,colors:PortalPalette,onNavigate:(String)->Unit){
 val repository=remember{RoleWorkspaceRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 var dossier by remember(clientId,session.accessToken){mutableStateOf<AdvisorClientDossier?>(null)}
 var busy by remember(clientId,session.accessToken){mutableStateOf(true)}
 var error by remember(clientId,session.accessToken){mutableStateOf<String?>(null)}
 var revision by remember(clientId){mutableIntStateOf(0)}
 LaunchedEffect(clientId,session.accessToken,revision){
  busy=true;error=null
  try{dossier=repository.clientDossier(session,clientId)}
  catch(e:CancellationException){throw e}
  catch(e:Exception){error=e.message?:"Az ügyféldosszié nem érhető el."}
  finally{busy=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  TextButton(onClick={onNavigate("/admin/clients")}){Text("‹ Vissza az ügyfelekhez",color=colors.accent)}
  if(busy)CircularProgressIndicator(color=colors.accent)
  else if(error!=null){
   Text(error!!,color=Critical,fontSize=13.sp)
   TextButton(onClick={revision++}){Text("Újrapróbálás")}
  }else dossier?.let{client->
   Card(colors,background=colors.tint){
    Text(client.name,color=Ink,fontSize=21.sp,fontWeight=FontWeight.Bold)
    client.phone?.let{Text("Telefon: $it",color=SoftInk,fontSize=13.sp)}
    Text("${client.farms.size} gazdaság · ${client.farms.sumOf{it.fields.size}} földtábla",color=colors.accent,fontSize=14.sp)
   }
   Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
    Box(Modifier.weight(1f)){PortalMetric("Nyitott teendők",client.openTasks.toString(),colors){onNavigate("/admin/tasks")}}
    Box(Modifier.weight(1f)){PortalMetric("Ellenőrzésre vár",client.awaitingReview.toString(),colors){onNavigate("/admin/tasks")}}
   }
   if(client.farms.isEmpty())Card(colors){Text("Ehhez az ügyfélhez nincs hozzáférhető gazdaság.",color=SoftInk)}
   client.farms.forEach{farm->
    Card(colors){
     Text(farm.name,color=Ink,fontSize=18.sp,fontWeight=FontWeight.Bold)
     Text("${farm.countryCode} · ${farm.fields.size} földtábla · ${farm.openTasks} nyitott teendő",color=SoftInk,fontSize=13.sp)
    }
    if(farm.fields.isEmpty())Text("Nincs elérhető földtábla.",color=SoftInk,fontSize=12.sp)
    farm.fields.forEach{field->
     val outline=when(field.condition){"critical"->Critical;"attention"->Attention;else->colors.border}
     Card(colors,border=outline,onClick={onNavigate("/fields/${field.id}")}){
      Row(verticalAlignment=Alignment.CenterVertically){
       Column(Modifier.weight(1f)){
        Text(field.name,color=Ink,fontSize=16.sp,fontWeight=FontWeight.Bold)
        Text("${field.areaHa?.let{"$it ha"}?:"Terület nincs megadva"} · ${field.crop?:"Kultúra nincs megadva"}",color=SoftInk,fontSize=12.sp)
       }
       Icon(Icons.Default.ChevronRight,"Földtábla megnyitása",tint=colors.accent)
      }
      val condition=when(field.condition){"critical"->"Kritikus szemle";"attention"->"Figyelmet igényel";"good"->"Rendben";else->"Nincs friss szemleállapot"}
      Text(condition,color=if(field.condition=="critical")Critical else if(field.condition=="attention")Color(0xFF936611)else SoftInk,fontSize=12.sp)
      Text("${field.openTasks} nyitott · ${field.overdueTasks} lejárt teendő",color=SoftInk,fontSize=12.sp)
      field.lastInspection?.let{Text("Utolsó szemle: ${huDate(it)}",color=SoftInk,fontSize=12.sp)}
     }
    }
   }
   Text("Az adatok a bejelentkezett szaktanácsadó jogosultságával, közvetlenül a közös Agrár Mentor rendszerből érkeznek.",color=SoftInk,fontSize=12.sp)
  }
 }
}

@Composable
private fun AdvisorTasks(data:AdvisorWorkspace,colors:PortalPalette,session:AuthorizedSession,onlyOpen:Boolean,onNavigate:(String)->Unit,onReviewed:()->Unit,selectedTaskId:String?=null,statusFilter:String?=null){
 val reviewGateway=remember{AdvisorTaskReview(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 val context=LocalContext.current
 val scope=rememberCoroutineScope()
 var reviewing by remember{mutableStateOf<Pair<AdvisorTask,Boolean>?>(null)}
 var openedTask by remember{mutableStateOf<AdvisorTask?>(null)}
 var note by remember{mutableStateOf("")}
 var evidenceConfirmed by remember{mutableStateOf(false)}
 val openedProofs=remember{mutableStateListOf<String>()}
 var openingPhoto by remember{mutableStateOf<String?>(null)}
 var sending by remember{mutableStateOf(false)}
 var error by remember{mutableStateOf<String?>(null)}
 var search by remember(onlyOpen){mutableStateOf("")}
 var shown by remember(onlyOpen){mutableIntStateOf(40)}
 val tasks=data.tasks.filter{(!onlyOpen||(it.status!="done"&&it.status!="cancelled"))&&
  (statusFilter==null||it.status==statusFilter)&&
  (it.title.contains(search,true)||it.fieldName.contains(search,true))}
 LaunchedEffect(selectedTaskId){
  if(selectedTaskId!=null)openedTask=data.tasks.firstOrNull{it.id==selectedTaskId}
 }
 Text(if(statusFilter=="submitted")"Ellenőrzésre váró feladatok" else if(onlyOpen)"Napi munkalista" else "Szaktanácsadói munkalista",fontSize=15.sp,fontWeight=FontWeight.Bold,color=Ink)
 OutlinedTextField(value=search,onValueChange={search=it;shown=40},label={Text("Feladat vagy földtábla keresése")},singleLine=true,modifier=Modifier.fillMaxWidth())
 Text("${tasks.size} találat",fontSize=12.sp,color=SoftInk)
 if(error!=null)Text(error!!,color=Critical,fontSize=12.sp)
 if(selectedTaskId!=null&&data.tasks.none{it.id==selectedTaskId})Text("A kiválasztott feladat már nem érhető el. A teljes listában kereshetsz.",color=Critical,fontSize=12.sp)
 if(tasks.isEmpty())Text("Ebben a nézetben nincs feladat.",color=SoftInk)
 tasks.take(shown).forEach{task->
  val attention=task.priority in listOf("high","urgent")&&task.status!="done"
  Card(colors,border=if(attention)Attention else colors.border){
   Text(task.title,color=Ink,fontSize=16.sp,fontWeight=FontWeight.Bold)
   Text(task.fieldName,color=SoftInk,fontSize=12.sp)
   Row(verticalAlignment=Alignment.CenterVertically){
    TextButton(onClick={openedTask=task}){Text("Feladat részletei ›",color=colors.accent)}
    if(task.fieldId!=null)TextButton(onClick={onNavigate("/fields/${task.fieldId}")}){Text("Földtábla ›",color=colors.accent)}
   }
   Row(horizontalArrangement=Arrangement.SpaceBetween,modifier=Modifier.fillMaxWidth()){
    Text(taskStatus(task.status),color=colors.accent,fontSize=12.sp,fontWeight=FontWeight.Bold)
    Text(huDate(task.dueDate),color=if(attention)Critical else SoftInk,fontSize=12.sp)
   }
   if(task.status=="submitted"){
    if(task.reportDate!=null&&task.reportReviewStatus=="pending"){
     Text("Teljesítés: ${huDate(task.reportDate)}",color=SoftInk,fontSize=12.sp)
     task.plan?.let{plan->
      if(plan.productName!=null)Text("Tervezett szer: ${plan.productName}",color=Ink,fontSize=12.sp)
      if(plan.crop!=null)Text("Kultúra: ${plan.crop}",color=SoftInk,fontSize=12.sp)
      if(plan.plannedDose!=null)Text("Tervezett dózis: ${plan.plannedDose} ${plan.doseUnit?:""}",color=SoftInk,fontSize=12.sp)
      if(plan.doseMin!=null||plan.doseMax!=null)Text("Tervezett hivatalos határ: ${plan.doseMin?:"—"}–${plan.doseMax?:"—"} ${plan.doseUnit?:""}",color=SoftInk,fontSize=12.sp)
     }
     if(!task.reportNotes.isNullOrBlank())Text("Végrehajtó megjegyzése: ${task.reportNotes}",color=Ink,fontSize=13.sp)
     if(task.fieldId!=null){
      task.evidence?.let{proof->
       Text("GPS: ${when(proof.validation){"inside_boundary"->"a táblahatáron belül";"near_boundary"->"a tábla közelében";else->"a táblaközpont közelében"}} · ±${proof.accuracyMeters.toInt()} m",color=colors.accent,fontSize=13.sp,fontWeight=FontWeight.Bold)
       Text("Pozíció: ${proof.latitude}, ${proof.longitude} · mérés: ${proof.capturedAt}",color=SoftInk,fontSize=11.sp)
       if(proof.distanceMeters!=null)Text("Határtól/középponttól: kb. ${proof.distanceMeters.toInt()} m",color=SoftInk,fontSize=11.sp)
       if(proof.actualDose!=null)Text("Tényleges dózis: ${proof.actualDose} ${proof.doseUnit?:""}",color=Ink,fontSize=12.sp)
       if(proof.actualArea!=null)Text("Tényleges terület: ${proof.actualArea} ha",color=Ink,fontSize=12.sp)
       if(proof.actualQuantity!=null)Text("Tényleges mennyiség: ${proof.actualQuantity} ${proof.quantityUnit?:""}",color=Ink,fontSize=12.sp)
       if(proof.weather!=null)Text("Időjárás: ${proof.weather}",color=Ink,fontSize=12.sp)
       if(proof.finishedHours!=null)Text("Záró üzemóra: ${proof.finishedHours}",color=Ink,fontSize=12.sp)
       if(proof.workedHectares!=null)Text("Megművelt hektár: ${proof.workedHectares}",color=Ink,fontSize=12.sp)
       TextButton(onClick={
        openingPhoto=task.id
        scope.launch{
         try{
          val url=reviewGateway.photoUrl(session,task)
          context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE))
          if(proof.photoPath !in openedProofs)openedProofs.add(proof.photoPath)
         }catch(e:Exception){error="A bizonyító fotó nem nyitható meg: ${e.message?:"ismeretlen hiba"}"}
         finally{openingPhoto=null}
        }
       },enabled=openingPhoto==null){Text(if(openingPhoto==task.id)"Fotó megnyitása…" else "Helyszíni fénykép ellenőrzése",color=colors.accent)}
      }?:Text("A GPS- és fotóigazolás hiányzik vagy hibás; jóváhagyás nem engedélyezett.",color=Critical,fontSize=12.sp)
     }
     Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
      if(task.fieldId==null||task.evidence!=null)TextButton(onClick={reviewing=task to true;note="";evidenceConfirmed=false}){Text("Jóváhagyom",color=colors.accent)}
      TextButton(onClick={reviewing=task to false;note="";evidenceConfirmed=false}){Text("Visszaküldöm",color=Critical)}
     }
    }else Text("A feladathoz tartozó ellenőrizhető teljesítési riport nem érhető el.",color=Critical,fontSize=12.sp)
   }
  }
 }
 if(tasks.size>shown)TextButton(onClick={shown+=40}){Text("További feladatok ›",color=colors.accent)}
 openedTask?.let{task->
  AlertDialog(onDismissRequest={openedTask=null},title={Text(task.title)},text={Column(verticalArrangement=Arrangement.spacedBy(8.dp)){
   Text("Földtábla: ${task.fieldName}")
   Text("Állapot: ${taskStatus(task.status)}")
   Text("Határidő: ${huDate(task.dueDate)}")
   Text("Prioritás: ${task.priority}")
   if(!task.reportNotes.isNullOrBlank())Text("Végrehajtási megjegyzés: ${task.reportNotes}")
   Text("Az ellenőrzési döntés a feladatkártyán, a bizonyítékok megtekintése után érhető el.",color=SoftInk,fontSize=12.sp)
  }},confirmButton={TextButton(onClick={openedTask=null}){Text("Bezárás")}})
 }
 reviewing?.let{(task,approve)->
  AlertDialog(
   onDismissRequest={if(!sending)reviewing=null},
   title={Text(if(approve)"Teljesítés jóváhagyása" else "Visszaküldés javításra")},
   text={
    Column(Modifier.heightIn(max=460.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(8.dp)){
     Text(task.title,color=Ink,fontWeight=FontWeight.Bold)
     Text("${task.fieldName} · ${huDate(task.reportDate)}",fontSize=12.sp,color=SoftInk)
     if(task.reportNotes!=null)Text(task.reportNotes,fontSize=13.sp,color=Ink)
     if(approve&&task.fieldId!=null){
      val proof=task.evidence
      if(proof==null)Text("Hiányzó GPS-bizonyíték.",color=Critical)
      else{
       Text("GPS: ±${proof.accuracyMeters.toInt()} m · ${proof.validation}",fontSize=12.sp,color=Ink)
       if(proof.photoPath !in openedProofs)Text("A döntés előtt nyisd meg a helyszíni fotót a feladatkártyán.",color=Critical,fontSize=12.sp)
       Row(verticalAlignment=Alignment.CenterVertically){
        Checkbox(checked=evidenceConfirmed,onCheckedChange={evidenceConfirmed=it},enabled=proof.photoPath in openedProofs)
        Text("Ellenőriztem a GPS-adatot, a helyszíni fotót és a tényleges munkavégzést.",fontSize=12.sp)
       }
      }
     }
     OutlinedTextField(note,{note=it.take(1500)},label={Text(if(approve)"Ellenőrzési megjegyzés (opcionális)" else "Mit kell javítani? (kötelező)")},modifier=Modifier.fillMaxWidth(),minLines=2)
    }
   },
   confirmButton={TextButton(onClick={
    sending=true;error=null
    scope.launch{
     try{reviewGateway.review(session,task,approve,note);reviewing=null;onReviewed()}
     catch(e:Exception){error="Az ellenőrzési döntés nem menthető: ${e.message?:"Frissítsd a listát."}"}
     finally{sending=false}
    }
   },enabled=!sending&&(approve||note.isNotBlank())&&(!approve||task.fieldId==null||(task.evidence!=null&&evidenceConfirmed&&task.evidence.photoPath in openedProofs))){Text(if(sending)"Mentés…" else "Döntés mentése")}},
   dismissButton={TextButton(onClick={reviewing=null},enabled=!sending){Text("Mégsem")}}
  )
 }
}

@Composable
internal fun AdminWorkspaceScreen(route:String,session:AuthorizedSession,colors:PortalPalette,onNavigate:(String)->Unit){
 val repo=remember{RoleWorkspaceRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 var snapshot by remember(session.accessToken){mutableStateOf<AdminWorkspace?>(null)}
 var busy by remember(session.accessToken){mutableStateOf(true)}
 var failed by remember(session.accessToken){mutableStateOf(false)}
 var revision by remember{mutableIntStateOf(0)}
 LaunchedEffect(session.accessToken,revision){
  busy=true;failed=false
  try{snapshot=repo.admin(session)}
  catch(e:CancellationException){throw e}
  catch(_:Exception){failed=true}
  finally{busy=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  if(busy)CircularProgressIndicator(color=colors.accent)
  else if(failed){
   LoadError(colors,onRetry={revision++})
   Text("A webes rendszeradmin egyes adatai csak szerveroldali jogosultsággal érhetők el. Ezt mobilon nem kerüljük meg.",fontSize=12.sp,color=SoftInk)
  }
  else snapshot?.let{data->
   when(route){
    "/system-admin"->AdminDashboard(data,colors,onNavigate)
    "/system-admin/users"->AdminUsers(data,colors)
    "/system-admin/support"->AdminSupport(data,colors)
    "/system-admin/security"->AdminSecurity(data,colors)
    "/system-admin/farms"->AdminInventory(data,colors,showFarms=true,onNavigate=onNavigate)
    "/system-admin/fields"->AdminInventory(data,colors,showFarms=false,onNavigate=onNavigate)
    else->if(route.startsWith("/system-admin/fields/")&&route.removePrefix("/system-admin/fields/").isNotBlank()){
     AdminInventory(data,colors,showFarms=false,onNavigate=onNavigate,farmIdFilter=route.removePrefix("/system-admin/fields/"))
    }
   }
  }
 }
}

@Composable
private fun AdminDashboard(data:AdminWorkspace,colors:PortalPalette,onNavigate:(String)->Unit){
 val open=data.tasks.count{it.status!="done"&&it.status!="cancelled"}
 val high=data.securityEvents.count{it.riskScore>=70}
 PortalHero("Rendszerfelügyelet","Admin támogatási mód · minden beavatkozás naplózandó",colors,onClick={onNavigate("/system-admin/support")})
 Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
  Box(Modifier.weight(1f)){PortalMetric("Felhasználók",data.users.size.toString(),colors){onNavigate("/system-admin/users")}}
  Box(Modifier.weight(1f)){PortalMetric("Gazdaságok",data.farms.toString(),colors){onNavigate("/system-admin/farms")}}
 }
 Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
  Box(Modifier.weight(1f)){PortalMetric("Táblák",data.fields.toString(),colors){onNavigate("/system-admin/fields")}}
  Box(Modifier.weight(1f)){PortalMetric("Nyitott feladatok",open.toString(),colors){onNavigate("/system-admin/support")}}
 }
 Card(colors){
  Text("Nyitott jelzések: ${data.openReports}",fontSize=14.sp,color=Ink)
  Text(if(data.securityAvailable)"Magas kockázatú események a betöltött listában: $high" else "Biztonsági események: külön hozzáférés szükséges",color=colors.accent,fontSize=13.sp,fontWeight=FontWeight.Bold)
 }
 listOf(
  Triple("Támogatási központ","Feladatok és műszaki elakadások","/system-admin/support"),
  Triple("Felhasználók","Fiók- és szerepköradatok","/system-admin/users"),
  Triple("Biztonsági események","Kockázati napló áttekintése","/system-admin/security"),
  Triple("HungaroMet kapcsolat","Szinkronállapot és webes felügyelet","/system-admin/weather"),
  Triple("Biztonsági mentés","Védett webes rendszerművelet","/system-admin/backup")
 ).forEach{(title,description,path)->PortalRouteTile(title,description,colors){onNavigate(path)}}
 Text("A számok csak a bejelentkezett admin számára hozzáférhető és betöltött sorokat jelzik.",fontSize=12.sp,color=SoftInk)
}

@Composable
private fun AdminInventory(data:AdminWorkspace,colors:PortalPalette,showFarms:Boolean,onNavigate:(String)->Unit,farmIdFilter:String?=null){
 var search by remember(showFarms,farmIdFilter){mutableStateOf("")}
 var shown by remember(showFarms,farmIdFilter){mutableIntStateOf(50)}
 var opened by remember(showFarms,farmIdFilter){mutableStateOf<String?>(null)}
 val currentFarm=data.farmList.firstOrNull{it.id==farmIdFilter}
 if(farmIdFilter!=null){
  Text("Gazdaság szerinti szűrés: ${currentFarm?.name?:"Nem elérhető gazdaság"}",color=colors.accent,fontWeight=FontWeight.SemiBold)
  TextButton(onClick={onNavigate("/system-admin/fields")}){Text("Minden földtábla ›",color=colors.accent)}
 }
 val farms=data.farmList.filter{it.name.contains(search,true)}
 val fields=data.fieldList.filter{(farmIdFilter==null||it.farmId==farmIdFilter)&&
  (it.name.contains(search,true)||it.farmName.contains(search,true)||it.crop?.contains(search,true)==true)}
 val count=if(showFarms)farms.size else fields.size
 Text("${if(showFarms)"Hozzáférhető gazdaságok" else "Hozzáférhető földtáblák"}: $count",color=SoftInk,fontSize=13.sp)
 OutlinedTextField(value=search,onValueChange={search=it;shown=50},label={Text("Keresés a nyilvántartásban")},singleLine=true,modifier=Modifier.fillMaxWidth())
 if(count==0)Text("Nincs a keresésnek megfelelő rekord.",color=SoftInk,fontSize=13.sp)
 if(showFarms)farms.take(shown).forEach{farm->
  val fieldCount=data.fieldList.count{it.farmId==farm.id}
  PortalRouteTile(farm.name,"$fieldCount nyilvántartott földtábla",colors){opened=farm.id}
 }else fields.take(shown).forEach{field->
  PortalRouteTile(field.name,listOfNotNull(field.farmName,field.areaHa?.let{"$it ha"},field.crop).joinToString(" · "),colors){opened=field.id}
 }
 if(count>shown)TextButton(onClick={shown+=50}){Text("További ${if(showFarms)"gazdaságok" else "táblák"} ›",color=colors.accent)}
 opened?.let{id->
  if(showFarms){
   val farm=data.farmList.firstOrNull{it.id==id}
   if(farm!=null){
    val linked=data.fieldList.filter{it.farmId==id}
    AlertDialog(onDismissRequest={opened=null},title={Text(farm.name)},text={
     Column(Modifier.heightIn(max=420.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(8.dp)){
      Text("Nyilvántartott földtáblák: ${linked.size}",fontWeight=FontWeight.Bold)
      if(linked.isEmpty())Text("Ehhez a gazdasághoz nincs látható földtábla.",color=SoftInk,fontSize=12.sp)
      linked.take(15).forEach{field->Text("• ${field.name}${field.areaHa?.let{" · $it ha"}?:""}",fontSize=13.sp)}
      if(linked.size>15)Text("További ${linked.size-15} tábla a földtábla-listában található.",color=SoftInk,fontSize=12.sp)
      Text("Gazdaság azonosító: ${farm.id}",color=SoftInk,fontSize=12.sp)
     }
    },confirmButton={TextButton(onClick={opened=null;onNavigate("/system-admin/fields/${farm.id}")}){Text("Földtáblák megnyitása",color=colors.accent)}},
     dismissButton={TextButton(onClick={opened=null}){Text("Bezárás")}})
   }
  }else{
   val field=data.fieldList.firstOrNull{it.id==id}
   if(field!=null)AlertDialog(onDismissRequest={opened=null},title={Text(field.name)},text={
    Column(verticalArrangement=Arrangement.spacedBy(8.dp)){
     Text("Gazdaság: ${field.farmName}")
     field.areaHa?.let{Text("Terület: $it ha")}
     field.crop?.let{Text("Kultúra: $it")}
     field.settlement?.let{Text("Település: $it")}
     field.status?.let{Text("Állapot: $it")}
     Text("Földtábla-azonosító: ${field.id}",fontSize=12.sp,color=SoftInk)
     Text("Csak az admin számára olvasható adatok láthatók; módosítás itt nem végezhető.",color=SoftInk,fontSize=12.sp)
    }
   },confirmButton={TextButton(onClick={opened=null}){Text("Bezárás")}})
  }
 }
}

@Composable
private fun AdminUsers(data:AdminWorkspace,colors:PortalPalette){
 var roleFilter by remember{mutableStateOf<String?>(null)}
 var opened by remember{mutableStateOf<String?>(null)}
 var search by remember{mutableStateOf("")}
 var shown by remember{mutableIntStateOf(40)}
 Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
  Box(Modifier.weight(1f)){PortalMetric("Gazdálkodók",data.users.count{it.role=="farmer"&&it.systemRole!="admin"}.toString(),colors){roleFilter="farmer";shown=40}}
  Box(Modifier.weight(1f)){PortalMetric("Szaktanácsadók",data.users.count{it.role=="advisor"&&it.systemRole!="admin"}.toString(),colors){roleFilter="advisor";shown=40}}
 }
 PortalMetric("Rendszeradminisztrátorok",data.users.count{it.systemRole=="admin"}.toString(),colors){roleFilter="admin";shown=40}
 if(roleFilter!=null)TextButton(onClick={roleFilter=null;shown=40}){
  Text("Szűrés törlése · ${when(roleFilter){"farmer"->"Gazdálkodók";"advisor"->"Szaktanácsadók";else->"Adminisztrátorok"}}",color=colors.accent)
 }
 OutlinedTextField(value=search,onValueChange={search=it;shown=40},label={Text("Felhasználó keresése")},singleLine=true,modifier=Modifier.fillMaxWidth())
 val users=data.users.filter{(roleFilter==null||if(roleFilter=="admin")it.systemRole=="admin" else it.systemRole!="admin"&&it.role==roleFilter)&&
  (it.name.contains(search,true)||it.phone?.contains(search,true)==true)}
 Text("${users.size} találat",color=SoftInk,fontSize=12.sp)
 if(users.isEmpty())Text("Nincs a szűrésnek megfelelő felhasználó.",color=SoftInk,fontSize=12.sp)
 users.take(shown).forEach{user->
  Card(colors,onClick={opened=user.id}){
   Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically){
    Text(user.name,color=Ink,fontSize=16.sp,fontWeight=FontWeight.Bold,modifier=Modifier.weight(1f))
    Icon(Icons.Default.ChevronRight,contentDescription="Fiókrészletek",tint=colors.accent)
   }
   Text(when(user.role){"advisor"->"Szaktanácsadó";"farmer"->"Gazdálkodó";else->"Ismeretlen szerepkör"},color=SoftInk,fontSize=13.sp)
   if(user.systemRole=="admin")Text("Rendszeradmin jogosultság",fontSize=12.sp,fontWeight=FontWeight.Bold,color=colors.accent)
   if(user.phone!=null)Text(user.phone,color=SoftInk,fontSize=12.sp)
  }
 }
 if(users.size>shown)TextButton(onClick={shown+=40}){Text("További felhasználók ›",color=colors.accent)}
 Text("Új fiók meghívása és jogmódosítás nem érhető el mobilon, amíg nincs hozzá hitelesített szervervégpont.",fontSize=12.sp,color=SoftInk)
 opened?.let{id->data.users.firstOrNull{it.id==id}?.let{user->
  AlertDialog(onDismissRequest={opened=null},title={Text(user.name)},text={Column(verticalArrangement=Arrangement.spacedBy(8.dp)){
   Text("Szerepkör: ${if(user.role=="advisor")"Szaktanácsadó" else if(user.role=="farmer")"Gazdálkodó" else "Ismeretlen"}")
   Text("Rendszerjog: ${if(user.systemRole=="admin")"Rendszeradminisztrátor" else "Normál felhasználó"}")
   user.phone?.let{Text("Telefon: $it")}
   Text("Fiókazonosító: ${user.id}",fontSize=12.sp,color=SoftInk)
  }},confirmButton={TextButton(onClick={opened=null}){Text("Bezárás")}})
 }}
}

@Composable
private fun AdminSupport(data:AdminWorkspace,colors:PortalPalette){
 var opened by remember{mutableStateOf<Int?>(null)}
 var onlyOpen by remember{mutableStateOf(false)}
 var search by remember{mutableStateOf("")}
 var shown by remember{mutableIntStateOf(40)}
 val open=data.tasks.count{it.status!="done"&&it.status!="cancelled"}
 Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
  Box(Modifier.weight(1f)){PortalMetric("Betöltött feladat",data.tasks.size.toString(),colors){onlyOpen=false}}
  Box(Modifier.weight(1f)){PortalMetric("Nem lezárt",open.toString(),colors){onlyOpen=true}}
 }
 Card(colors,background=colors.tint){
  Text("Admin támogatási mód",color=colors.accent,fontWeight=FontWeight.Bold)
  Text("Feladatállapot javítása indoklással és auditnaplózással történhet. Ebben az első mobilváltozatban nincs állapotmódosítás.",fontSize=13.sp,color=Ink)
 }
 if(onlyOpen)TextButton(onClick={onlyOpen=false;shown=40}){Text("Összes feladat megjelenítése",color=colors.accent)}
 OutlinedTextField(value=search,onValueChange={search=it;shown=40},label={Text("Támogatási feladat keresése")},singleLine=true,modifier=Modifier.fillMaxWidth())
 val indexes=data.tasks.indices.filter{index->val task=data.tasks[index]
  (!onlyOpen||task.status !in listOf("done","cancelled"))&&
  (task.title.contains(search,true)||task.farmName.contains(search,true)||task.fieldName.contains(search,true))}
 Text("${indexes.size} találat",color=SoftInk,fontSize=12.sp)
 if(indexes.isEmpty())Text("Nincs a szűrésnek megfelelő támogatási feladat.",color=SoftInk,fontSize=12.sp)
 indexes.take(shown).forEach{index->
  val task=data.tasks[index]
  Card(colors,onClick={opened=index}){
   Text(task.title,color=Ink,fontSize=16.sp,fontWeight=FontWeight.Bold)
   Text("${task.farmName} · ${task.fieldName}",color=SoftInk,fontSize=12.sp)
   Text("Végrehajtó: ${task.assignee}",color=SoftInk,fontSize=12.sp)
   Text(taskStatus(task.status),color=colors.accent,fontSize=12.sp,fontWeight=FontWeight.Bold)
  }
 }
 if(indexes.size>shown)TextButton(onClick={shown+=40}){Text("További támogatási feladatok ›",color=colors.accent)}
 opened?.let{index->data.tasks.getOrNull(index)?.let{task->
  AlertDialog(onDismissRequest={opened=null},title={Text(task.title)},text={Column(verticalArrangement=Arrangement.spacedBy(7.dp)){
   Text("Gazdaság: ${task.farmName}")
   Text("Földtábla: ${task.fieldName}")
   Text("Végrehajtó: ${task.assignee}")
   Text("Állapot: ${taskStatus(task.status)}")
   Text("Prioritás: ${task.priority}")
   Text("Állapotmódosítás a hitelesített webes támogatási felületen végezhető.",fontSize=12.sp,color=SoftInk)
  }},confirmButton={TextButton(onClick={opened=null}){Text("Bezárás")}})
 }}
}

@Composable
private fun AdminSecurity(data:AdminWorkspace,colors:PortalPalette){
 var opened by remember{mutableStateOf<Int?>(null)}
 if(!data.securityAvailable){
  Card(colors){
   Icon(Icons.Default.Warning,null,tint=colors.accent)
   Text("A biztonsági események lekérése külön jogosultságot igényel.",color=Ink,fontSize=14.sp)
   Text("A mobilalkalmazás nem kér és nem tárol rendszerszintű titkos kulcsot.",color=SoftInk,fontSize=12.sp)
  }
 }else if(data.securityEvents.isEmpty())Text("Nincs betöltött biztonsági esemény.",color=SoftInk)
 else data.securityEvents.forEachIndexed{index,event->
  Card(colors,border=if(event.riskScore>=70)Critical else colors.border,onClick={opened=index}){
   Text(event.title,color=Ink,fontSize=16.sp,fontWeight=FontWeight.Bold)
   Text("Kockázati pont: ${event.riskScore} · ${event.severity}",fontSize=13.sp,color=if(event.riskScore>=70)Critical else SoftInk)
   Text(huDate(event.occurredAt),color=SoftInk,fontSize=12.sp)
  }
 }
 Text("Ez csak megtekintő nézet; incidensbeavatkozás a webes adminfelületen történik.",color=SoftInk,fontSize=12.sp)
 opened?.let{index->data.securityEvents.getOrNull(index)?.let{event->
  AlertDialog(onDismissRequest={opened=null},title={Text(event.title)},text={Column(verticalArrangement=Arrangement.spacedBy(7.dp)){
   Text("Súlyosság: ${event.severity}")
   Text("Kockázati pont: ${event.riskScore}")
   Text("Időpont: ${event.occurredAt}")
   Text("A beavatkozás a webes rendszeradmin felületen végezhető, auditálással.",fontSize=12.sp,color=SoftInk)
  }},confirmButton={TextButton(onClick={opened=null}){Text("Bezárás")}})
 }}
}
