package hu.agrarmentor.android.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.agrarmentor.android.BuildConfig
import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.data.FarmExtrasRepository
import hu.agrarmentor.android.data.MobileFarm
import hu.agrarmentor.android.data.MobileMachine
import hu.agrarmentor.android.data.MobileTeamMember
import hu.agrarmentor.android.data.MobileTimelineEvent
import hu.agrarmentor.android.data.validMapFieldId

private val TextInk=Color(0xFF1D3026)
private val Subtle=Color(0xFF6C7D72)

@Composable
internal fun LiveFarmExtrasScreen(route:String,session:AuthorizedSession,colors:PortalPalette,onNavigate:(String)->Unit){
 val repo=remember{FarmExtrasRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 var farms by remember{mutableStateOf<List<MobileFarm>>(emptyList())}
 var machines by remember{mutableStateOf<List<MobileMachine>>(emptyList())}
 var team by remember{mutableStateOf<List<MobileTeamMember>>(emptyList())}
 var timeline by remember{mutableStateOf<List<MobileTimelineEvent>>(emptyList())}
 var loading by remember{mutableStateOf(true)}
 var failed by remember{mutableStateOf(false)}
 var revision by remember{mutableIntStateOf(0)}
 var shownCount by remember(route){mutableIntStateOf(100)}
 LaunchedEffect(route,session.accessToken,revision){
  loading=true;failed=false
  try{
   when(route){
    "/farms"->farms=repo.farms(session)
    "/machines"->machines=repo.machines(session)
    "/team"->team=repo.team(session)
    "/timeline"->timeline=repo.timeline(session)
   }
  }catch(_:Exception){failed=true}
  finally{loading=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(11.dp)){
  if(loading)CircularProgressIndicator(color=colors.accent)
  else if(failed)LoadError(colors,onRetry={revision++})
  else when(route){
   "/farms"->{
    Text("A hozzáférhető gazdaságaid adatai",color=Subtle,fontSize=13.sp)
    if(farms.isEmpty())Text("Még nincs elérhető gazdaság.",color=Subtle)
    farms.take(shownCount).forEach{farm->
     Card(colors){
      Text(farm.name,color=TextInk,fontWeight=FontWeight.Bold,fontSize=17.sp)
      if(farm.settlement!=null)Text(farm.settlement,color=Subtle)
      if(farm.address!=null)Text(farm.address,color=Subtle,fontSize=13.sp)
      TextButton(onClick={onNavigate("/fields")}){Text("Földtáblák");Icon(Icons.Default.ChevronRight,null)}
     }
    }
    if(farms.size>shownCount)TextButton(onClick={shownCount+=100}){Text("További gazdaságok")}
   }
   "/machines"->{
    val due=machines.count{it.active&&it.hours!=null&&it.nextService!=null&&it.nextService-it.hours<=50.0}
    Text("${machines.count{it.active}} aktív gép · $due gép szervizhatárhoz közel",color=Subtle,fontSize=13.sp)
    if(machines.isEmpty())Text("Még nincs nyilvántartott gép.",color=Subtle)
    machines.take(shownCount).forEach{machine->
     val service=machine.hours!=null&&machine.nextService!=null&&machine.nextService-machine.hours<=50.0
     Card(colors,border=if(service)Color(0xFFE5AC21)else colors.border){
      Row(verticalAlignment=Alignment.CenterVertically){
       Text(machine.name,Modifier.weight(1f),fontSize=16.sp,color=TextInk,fontWeight=FontWeight.Bold)
       Text(if(machine.active)"Aktív" else "Inaktív",color=colors.accent,fontSize=12.sp)
      }
      Text("${machine.farmName} · ${machine.type}",color=Subtle,fontSize=12.sp)
      val brand=listOfNotNull(machine.brand,machine.model).joinToString(" · ")
      if(brand.isNotBlank())Text(brand,color=TextInk,fontSize=13.sp)
      Text("Üzemóra: ${machine.hours?.toString()?:"—"} · Következő szerviz: ${machine.nextService?.toString()?:"—"}",color=if(service)Color(0xFF985414)else Subtle,fontSize=13.sp)
     }
    }
    if(machines.size>shownCount)TextButton(onClick={shownCount+=100}){Text("További gépek")}
   }
   "/team"->{
    Text("${team.count{it.active}} aktív munkatárs",color=Subtle,fontSize=13.sp)
    if(team.isEmpty())Text("Még nincs látható munkatárs.",color=Subtle)
    team.take(shownCount).forEach{member->
     Card(colors){
      Row(verticalAlignment=Alignment.CenterVertically){
       Column(Modifier.weight(1f)){
        Text(member.name,color=TextInk,fontSize=16.sp,fontWeight=FontWeight.Bold)
        Text("${member.farmName} · ${member.memberRole}",color=Subtle,fontSize=12.sp)
       }
       Text(if(member.active)"Aktív" else "Felfüggesztve",color=if(member.active)colors.accent else Subtle,fontSize=11.sp)
      }
     }
    }
    if(team.size>shownCount)TextButton(onClick={shownCount+=100}){Text("További munkatársak")}
   }
   "/timeline"->{
    Text("Összesen ${timeline.size} gazdasági esemény",color=Subtle,fontSize=13.sp)
    if(timeline.isEmpty())Text("Még nincs megjeleníthető esemény.",color=Subtle)
    timeline.take(shownCount).forEach{event->
     Card(colors){
      Text(event.title,color=TextInk,fontSize=16.sp,fontWeight=FontWeight.Bold)
      Text("${eventTypeLabel(event.eventType)} · ${huDate(event.date)}",color=colors.accent,fontSize=12.sp)
      if(event.description!=null)Text(event.description,color=Subtle,fontSize=13.sp)
      if(event.fieldId?.let{validMapFieldId(it)}==true){
       TextButton(onClick={onNavigate("/fields/${event.fieldId}")}){Text("Tábla megnyitása");Icon(Icons.Default.ChevronRight,null)}
      }
     }
    }
    if(timeline.size>shownCount)TextButton(onClick={shownCount+=100}){Text("További események")}
   }
  }
 }
}

private fun eventTypeLabel(type:String):String=when(type){
 "inspection"->"Szemle"
 "task"->"Teendő"
 "task_completed"->"Elvégzett feladat"
 "farmer_report"->"Bejelentés"
 "advisor_reply"->"Tanácsadói válasz"
 "field_operation"->"Művelet"
 "weather_observation"->"Időjárás"
 else->"Gazdasági esemény"
}
