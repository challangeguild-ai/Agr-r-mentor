package hu.agrarmentor.android.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.agrarmentor.android.BuildConfig
import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.data.AdvisorWorkdayItem
import hu.agrarmentor.android.data.AdvisorWorkdayRepository
import hu.agrarmentor.android.data.AdvisorWorkdaySnapshot
import hu.agrarmentor.android.data.WorkdayKind
import hu.agrarmentor.android.data.workdayItemsForDay
import hu.agrarmentor.android.data.workdayOverdueItems
import hu.agrarmentor.android.data.workdayUnscheduledTasks
import kotlinx.coroutines.CancellationException
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val WorkdayInk=Color(0xFF263B30)
private val WorkdayMuted=Color(0xFF697D72)
private val WorkdayUrgent=Color(0xFFC9424E)
private val dayLabelFormat=DateTimeFormatter.ofPattern("MM. dd. EEE",Locale.forLanguageTag("hu-HU"))

@Composable
internal fun AdvisorWorkdayScreen(session:AuthorizedSession,colors:PortalPalette,onNavigate:(String)->Unit){
 val repo=remember{AdvisorWorkdayRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 var data by remember(session.accessToken){mutableStateOf<AdvisorWorkdaySnapshot?>(null)}
 var busy by remember(session.accessToken){mutableStateOf(true)}
 var error by remember(session.accessToken){mutableStateOf<String?>(null)}
 var revision by remember{mutableIntStateOf(0)}
 val today=remember{LocalDate.now(ZoneId.of("Europe/Budapest"))}
 var selected by remember{mutableStateOf(today.toString())}
 LaunchedEffect(session.accessToken,revision){
  busy=true;error=null
  try{data=repo.load(session)}
  catch(e:CancellationException){throw e}
  catch(e:Exception){error=e.message?:"A munkanap nem tölthető be."}
  finally{busy=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  Text("Feladatok, visszaellenőrzések és látogatások a következő hét napra",color=WorkdayMuted,fontSize=14.sp)
  if(busy)CircularProgressIndicator(color=colors.accent)
  else if(error!=null){
   Text(error!!,color=WorkdayUrgent,fontSize=13.sp)
   TextButton(onClick={revision++}){Text("Újrapróbálás")}
  }else data?.let{snapshot->
   val selectedItems=workdayItemsForDay(snapshot.items,selected)
   val overdue=workdayOverdueItems(snapshot.items,today.toString())
   val unscheduled=workdayUnscheduledTasks(snapshot.items)
   Row(horizontalArrangement=Arrangement.spacedBy(9.dp)){
    Box(Modifier.weight(1f)){Metric("A kiválasztott napon",selectedItems.size,colors)}
    Box(Modifier.weight(1f)){Metric("Lejárt / elmaradt",overdue.size,colors)}
   }
   Row(horizontalArrangement=Arrangement.spacedBy(9.dp)){
    Box(Modifier.weight(1f)){Metric("Nyitott jelzések",snapshot.openReports,colors)}
    Box(Modifier.weight(1f)){Metric("Kritikus táblák",snapshot.criticalFields,colors)}
   }
   Card(colors){
    Text("Következő 7 nap",color=WorkdayInk,fontSize=17.sp,fontWeight=FontWeight.Bold)
    Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(6.dp)){
     (0L..6L).forEach{offset->
      val day=today.plusDays(offset)
      TextButton(onClick={selected=day.toString()}){
       Text(day.format(dayLabelFormat),color=if(selected==day.toString())colors.accent else WorkdayMuted,
        fontSize=13.sp,fontWeight=if(selected==day.toString())FontWeight.Bold else FontWeight.Normal)
      }
     }
    }
   }
   Text("Napi munkaterv · ${huDate(selected)}",color=WorkdayInk,fontSize=17.sp,fontWeight=FontWeight.Bold)
   if(selectedItems.isEmpty())Text("Erre a napra nincs ütemezett szakmai esemény.",color=WorkdayMuted,fontSize=13.sp)
   selectedItems.take(30).forEach{WorkdayItemCard(it,colors,onNavigate)}
   Text("Lejárt vagy elmaradt tételek · ${overdue.size}",color=WorkdayInk,fontSize=17.sp,fontWeight=FontWeight.Bold)
   if(overdue.isEmpty())Text("Jelenleg nincs lejárt szakmai tétel.",color=WorkdayMuted,fontSize=13.sp)
   overdue.take(15).forEach{WorkdayItemCard(it,colors,onNavigate)}
   Text("Határidő nélküli feladatok · ${unscheduled.size}",color=WorkdayInk,fontSize=17.sp,fontWeight=FontWeight.Bold)
   if(unscheduled.isEmpty())Text("Minden nyitott feladat rendelkezik határidővel.",color=WorkdayMuted,fontSize=13.sp)
   unscheduled.take(10).forEach{WorkdayItemCard(it,colors,onNavigate)}
   Card(colors,onClick={onNavigate("/admin/reports")}){
    Text("Gazdálkodói jelzések: ${snapshot.openReports}",fontSize=15.sp,color=colors.accent,fontWeight=FontWeight.Bold)
    Text("Beérkező ügyek megnyitása ›",fontSize=12.sp,color=WorkdayMuted)
   }
   Text("Az adatok az aktuális jogosultság és kapcsolat alapján frissülnek. Ez a nézet munkaszervezési segítség; a szakmai döntést az adott tétel részletei alapján hozd meg.",fontSize=12.sp,color=WorkdayMuted)
  }
 }
}

@Composable
private fun WorkdayItemCard(item:AdvisorWorkdayItem,colors:PortalPalette,onNavigate:(String)->Unit){
 val path=when(item.kind){
  WorkdayKind.TASK->"/admin/tasks"
  WorkdayKind.CHECK->item.fieldId?.let{"/fields/$it"}?:"/admin/inspections"
  WorkdayKind.VISIT->"/admin/visits"
 }
 val kind=when(item.kind){WorkdayKind.TASK->"FELADAT";WorkdayKind.CHECK->"VISSZAELLENŐRZÉS";WorkdayKind.VISIT->"LÁTOGATÁS"}
 Card(colors,border=if(item.priority=="urgent")WorkdayUrgent else colors.border,onClick={onNavigate(path)}){
  Text(kind,color=if(item.priority=="urgent")WorkdayUrgent else colors.accent,fontSize=11.sp,fontWeight=FontWeight.Bold)
  Text(item.title,color=WorkdayInk,fontSize=16.sp,fontWeight=FontWeight.Bold)
  Text(item.subtitle,color=WorkdayMuted,fontSize=12.sp)
  item.scheduledTime?.let{Text("Tervezett időpont: $it",color=colors.accent,fontSize=12.sp,fontWeight=FontWeight.Bold)}
  item.dueDay?.let{Text("Határidő: ${huDate(it)}",color=WorkdayMuted,fontSize=12.sp)}
 }
}
