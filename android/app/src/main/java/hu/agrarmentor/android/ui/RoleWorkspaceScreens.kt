package hu.agrarmentor.android.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.TextButton
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.agrarmentor.android.BuildConfig
import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.data.AdminWorkspace
import hu.agrarmentor.android.data.AdvisorTask
import hu.agrarmentor.android.data.AdvisorTaskReview
import hu.agrarmentor.android.data.AdvisorWorkspace
import hu.agrarmentor.android.data.RoleWorkspaceRepository
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
  try{snapshot=repo.advisor(session)}catch(_:Exception){failed=true}
  finally{busy=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  if(busy)CircularProgressIndicator(color=colors.accent)
  else if(failed)LoadError(colors,onRetry={revision++})
  else snapshot?.let{data->
   when(route){
    "/admin"->AdvisorDashboard(data,colors,onNavigate)
    "/admin/clients"->AdvisorClients(data,colors)
    "/admin/tasks","/admin/daily-work"->AdvisorTasks(data,colors,session,onlyOpen=route=="/admin/daily-work",onReviewed={revision++})
   }
  }
 }
}

@Composable
private fun AdvisorDashboard(data:AdvisorWorkspace,colors:PortalPalette,onNavigate:(String)->Unit){
 val pending=data.tasks.count{it.status=="submitted"}
 val open=data.tasks.count{it.status!="done"&&it.status!="cancelled"}
 Card(colors,background=colors.accent){
  Text("Mai szakmai áttekintés",color=Color.White,fontSize=22.sp,fontWeight=FontWeight.Bold)
  Text("Ügyfelek, feladatok és nyitott jelzések",color=Color.White.copy(alpha=.88f),fontSize=13.sp)
 }
 Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
  Box(Modifier.weight(1f)){Metric("Ügyfelek",data.clients.size,colors)}
  Box(Modifier.weight(1f)){Metric("Táblák",data.totalFields,colors)}
 }
 Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
  Box(Modifier.weight(1f)){Metric("Nyitott teendők",open,colors)}
  Box(Modifier.weight(1f)){Metric("Ellenőrzésre vár",pending,colors)}
 }
 Card(colors){
  Text("Nyitott gazdálkodói jelzések",color=SoftInk,fontSize=14.sp)
  Text(data.openReports.toString(),color=colors.accent,fontSize=28.sp,fontWeight=FontWeight.Bold)
 }
 listOf("Ügyfelek" to "/admin/clients","Napi teendők" to "/admin/daily-work","Feladatok" to "/admin/tasks").forEach{(title,path)->
  Card(colors,onClick={onNavigate(path)}){
   Row(verticalAlignment=Alignment.CenterVertically){
    Text(title,color=Ink,fontSize=16.sp,fontWeight=FontWeight.Bold,modifier=Modifier.weight(1f))
    Icon(Icons.Default.ChevronRight,null,tint=colors.accent)
   }
  }
 }
 Text("Az összesítők a jelenleg elérhető adatokból készülnek.",fontSize=12.sp,color=SoftInk)
}

@Composable
private fun AdvisorClients(data:AdvisorWorkspace,colors:PortalPalette){
 Text("Gazdálkodók – figyelmeztetési sorrendben",fontSize=14.sp,color=SoftInk)
 if(data.clients.isEmpty())Text("Nincs elérhető gazdálkodói ügyfél.",color=SoftInk)
 data.clients.forEach{client->
  val severity=when{client.critical>0->Critical;client.attention>0->Attention;else->colors.border}
  Card(colors,border=severity){
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
  }
 }
 Text("A részletes ügyféldossziék bekötése még folyamatban van.",fontSize=12.sp,color=SoftInk)
}

@Composable
private fun AdvisorTasks(data:AdvisorWorkspace,colors:PortalPalette,session:AuthorizedSession,onlyOpen:Boolean,onReviewed:()->Unit){
 val reviewGateway=remember{AdvisorTaskReview(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 val scope=rememberCoroutineScope()
 var reviewing by remember{mutableStateOf<Pair<AdvisorTask,Boolean>?>(null)}
 var note by remember{mutableStateOf("")}
 var sending by remember{mutableStateOf(false)}
 var error by remember{mutableStateOf<String?>(null)}
 val tasks=data.tasks.filter{!onlyOpen||(it.status!="done"&&it.status!="cancelled")}
 Text(if(onlyOpen)"Napi munkalista" else "Szaktanácsadói munkalista",fontSize=15.sp,fontWeight=FontWeight.Bold,color=Ink)
 if(error!=null)Text(error!!,color=Critical,fontSize=12.sp)
 if(tasks.isEmpty())Text("Ebben a nézetben nincs feladat.",color=SoftInk)
 tasks.forEach{task->
  val attention=task.priority in listOf("high","urgent")&&task.status!="done"
  Card(colors,border=if(attention)Attention else colors.border){
   Text(task.title,color=Ink,fontSize=16.sp,fontWeight=FontWeight.Bold)
   Text(task.fieldName,color=SoftInk,fontSize=12.sp)
   Row(horizontalArrangement=Arrangement.SpaceBetween,modifier=Modifier.fillMaxWidth()){
    Text(taskStatus(task.status),color=colors.accent,fontSize=12.sp,fontWeight=FontWeight.Bold)
    Text(huDate(task.dueDate),color=if(attention)Critical else SoftInk,fontSize=12.sp)
   }
   if(task.status=="submitted"){
    if(task.reportDate!=null&&task.taskKind=="general"&&task.fieldId==null){
     Text("Teljesítés: ${huDate(task.reportDate)}",color=SoftInk,fontSize=12.sp)
     if(!task.reportNotes.isNullOrBlank())Text("Végrehajtó megjegyzése: ${task.reportNotes}",color=Ink,fontSize=13.sp)
     Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
      TextButton(onClick={reviewing=task to true;note=""}){Text("Jóváhagyom",color=colors.accent)}
      TextButton(onClick={reviewing=task to false;note=""}){Text("Visszaküldöm",color=Critical)}
     }
    }else Text("Az összetett vagy táblához kötött munkák jóváhagyása a teljes szakmai dossziéval, a webes felületen történik.",color=Critical,fontSize=12.sp)
   }
  }
 }
 reviewing?.let{(task,approve)->
  AlertDialog(
   onDismissRequest={if(!sending)reviewing=null},
   title={Text(if(approve)"Teljesítés jóváhagyása" else "Visszaküldés javításra")},
   text={
    Column(verticalArrangement=Arrangement.spacedBy(8.dp)){
     Text(task.title,color=Ink,fontWeight=FontWeight.Bold)
     Text("${task.fieldName} · ${huDate(task.reportDate)}",fontSize=12.sp,color=SoftInk)
     if(task.reportNotes!=null)Text(task.reportNotes,fontSize=13.sp,color=Ink)
     OutlinedTextField(note,{note=it.take(1500)},label={Text(if(approve)"Ellenőrzési megjegyzés (opcionális)" else "Mit kell javítani? (kötelező)")},modifier=Modifier.fillMaxWidth(),minLines=2)
    }
   },
   confirmButton={TextButton(onClick={
    sending=true;error=null
    scope.launch{
     try{reviewGateway.review(session,task,approve,note);reviewing=null;onReviewed()}
     catch(_:Exception){error="Az ellenőrzési döntést nem sikerült menteni. Frissítsd a listát."}
     finally{sending=false}
    }
   },enabled=!sending&&(approve||note.isNotBlank())){Text(if(sending)"Mentés…" else "Döntés mentése")}},
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
  try{snapshot=repo.admin(session)}catch(_:Exception){failed=true}
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
   }
  }
 }
}

@Composable
private fun AdminDashboard(data:AdminWorkspace,colors:PortalPalette,onNavigate:(String)->Unit){
 val open=data.tasks.count{it.status!="done"&&it.status!="cancelled"}
 val high=data.securityEvents.count{it.riskScore>=70}
 Card(colors,background=colors.accent){
  Text("Rendszerfelügyelet",color=Color.White,fontWeight=FontWeight.Bold,fontSize=22.sp)
  Text("Admin támogatási mód · minden beavatkozás naplózandó",color=Color.White.copy(alpha=.9f),fontSize=13.sp)
 }
 Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
  Box(Modifier.weight(1f)){Metric("Felhasználók",data.users.size,colors)}
  Box(Modifier.weight(1f)){Metric("Gazdaságok",data.farms,colors)}
 }
 Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
  Box(Modifier.weight(1f)){Metric("Táblák",data.fields,colors)}
  Box(Modifier.weight(1f)){Metric("Nyitott feladatok",open,colors)}
 }
 Card(colors){
  Text("Nyitott jelzések: ${data.openReports}",fontSize=14.sp,color=Ink)
  Text(if(data.securityAvailable)"Magas kockázatú események a betöltött listában: $high" else "Biztonsági események: külön hozzáférés szükséges",color=colors.accent,fontSize=13.sp,fontWeight=FontWeight.Bold)
 }
 listOf("Támogatási központ" to "/system-admin/support","Felhasználók" to "/system-admin/users","Biztonsági események" to "/system-admin/security").forEach{(title,path)->
  Card(colors,onClick={onNavigate(path)}){
   Row(verticalAlignment=Alignment.CenterVertically){
    Text(title,color=Ink,fontSize=16.sp,fontWeight=FontWeight.Bold,modifier=Modifier.weight(1f))
    Icon(Icons.Default.ChevronRight,null,tint=colors.accent)
   }
  }
 }
 Text("A számok csak a bejelentkezett admin számára hozzáférhető és betöltött sorokat jelzik.",fontSize=12.sp,color=SoftInk)
}

@Composable
private fun AdminUsers(data:AdminWorkspace,colors:PortalPalette){
 Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
  Box(Modifier.weight(1f)){Metric("Gazdálkodók",data.users.count{it.role=="farmer"},colors)}
  Box(Modifier.weight(1f)){Metric("Szaktanácsadók",data.users.count{it.role=="advisor"},colors)}
 }
 Text("Rendszeradminisztrátorok: ${data.users.count{it.systemRole=="admin"}}",fontSize=13.sp,color=SoftInk)
 data.users.forEach{user->
  Card(colors){
   Text(user.name,color=Ink,fontSize=16.sp,fontWeight=FontWeight.Bold)
   Text(when(user.role){"advisor"->"Szaktanácsadó";"farmer"->"Gazdálkodó";else->"Ismeretlen szerepkör"},color=SoftInk,fontSize=13.sp)
   if(user.systemRole=="admin")Text("Rendszeradmin jogosultság",fontSize=12.sp,fontWeight=FontWeight.Bold,color=colors.accent)
   if(user.phone!=null)Text(user.phone,color=SoftInk,fontSize=12.sp)
  }
 }
 Text("Új fiók meghívása és jogmódosítás nem érhető el mobilon, amíg nincs hozzá hitelesített szervervégpont.",fontSize=12.sp,color=SoftInk)
}

@Composable
private fun AdminSupport(data:AdminWorkspace,colors:PortalPalette){
 val open=data.tasks.count{it.status!="done"&&it.status!="cancelled"}
 Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
  Box(Modifier.weight(1f)){Metric("Betöltött feladat",data.tasks.size,colors)}
  Box(Modifier.weight(1f)){Metric("Nem lezárt",open,colors)}
 }
 Card(colors,background=colors.tint){
  Text("Admin támogatási mód",color=colors.accent,fontWeight=FontWeight.Bold)
  Text("Feladatállapot javítása indoklással és auditnaplózással történhet. Ebben az első mobilváltozatban nincs állapotmódosítás.",fontSize=13.sp,color=Ink)
 }
 data.tasks.forEach{task->
  Card(colors){
   Text(task.title,color=Ink,fontSize=16.sp,fontWeight=FontWeight.Bold)
   Text("${task.farmName} · ${task.fieldName}",color=SoftInk,fontSize=12.sp)
   Text("Végrehajtó: ${task.assignee}",color=SoftInk,fontSize=12.sp)
   Text(taskStatus(task.status),color=colors.accent,fontSize=12.sp,fontWeight=FontWeight.Bold)
  }
 }
}

@Composable
private fun AdminSecurity(data:AdminWorkspace,colors:PortalPalette){
 if(!data.securityAvailable){
  Card(colors){
   Icon(Icons.Default.Warning,null,tint=colors.accent)
   Text("A biztonsági események lekérése külön jogosultságot igényel.",color=Ink,fontSize=14.sp)
   Text("A mobilalkalmazás nem kér és nem tárol rendszerszintű titkos kulcsot.",color=SoftInk,fontSize=12.sp)
  }
 }else if(data.securityEvents.isEmpty())Text("Nincs betöltött biztonsági esemény.",color=SoftInk)
 else data.securityEvents.forEach{event->
  Card(colors,border=if(event.riskScore>=70)Critical else colors.border){
   Text(event.title,color=Ink,fontSize=16.sp,fontWeight=FontWeight.Bold)
   Text("Kockázati pont: ${event.riskScore} · ${event.severity}",fontSize=13.sp,color=if(event.riskScore>=70)Critical else SoftInk)
   Text(huDate(event.occurredAt),color=SoftInk,fontSize=12.sp)
  }
 }
 Text("Ez csak megtekintő nézet; incidensbeavatkozás a webes adminfelületen történik.",color=SoftInk,fontSize=12.sp)
}

@Composable
private fun Metric(label:String,value:Int,colors:PortalPalette){
 Card(colors){
  Text(label,color=SoftInk,fontSize=12.sp,maxLines=2)
  Text(value.toString(),color=colors.accent,fontSize=24.sp,fontWeight=FontWeight.ExtraBold)
 }
}
