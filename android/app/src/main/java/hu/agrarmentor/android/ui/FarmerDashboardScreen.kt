package hu.agrarmentor.android.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
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
import hu.agrarmentor.android.data.FarmerOverview
import hu.agrarmentor.android.data.FarmerOverviewRepository
import java.util.Locale

private val MainText=Color(0xFF1D3026)
private val SupportingText=Color(0xFF6C7D72)
private val ErrorRed=Color(0xFFBE3744)

/** Real farmer dashboard; values are read from RLS-protected Supabase records. */
@Composable
internal fun FarmerDashboardScreen(session:AuthorizedSession,colors:PortalPalette,onNavigate:(String)->Unit){
 val repository=remember{FarmerOverviewRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 var overview by remember(session.userId){mutableStateOf<FarmerOverview?>(null)}
 var busy by remember(session.userId){mutableStateOf(true)}
 var error by remember(session.userId){mutableStateOf(false)}
 var revision by remember{mutableIntStateOf(0)}

 LaunchedEffect(session.accessToken,revision){
  busy=true;error=false
  try{overview=repository.load(session)}catch(_:Exception){error=true}
  finally{busy=false}
 }

 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  PortalHero("Gazdaságod egy pillantásra","Aktuális földtáblák, figyelmeztetések és teendők",colors,onClick={onNavigate("/fields")})
  if(busy)CircularProgressIndicator(color=colors.accent)
  else if(error)LoadError(colors,onRetry={revision++})
  else overview?.let{data->
   Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
    Box(Modifier.weight(1f)){PortalMetric("Összterület",String.format(Locale.forLanguageTag("hu-HU"),"%.1f ha",data.totalAreaHa),colors){onNavigate("/fields")}}
    Box(Modifier.weight(1f)){PortalMetric("Aktív tábla",data.activeFieldsCount.toString(),colors){onNavigate("/fields")}}
   }
   Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
    Box(Modifier.weight(1f)){PortalMetric("Nyitott teendő",data.openTasksCount.toString(),colors){onNavigate("/tasks")}}
    Box(Modifier.weight(1f)){PortalMetric("Figyelmet igényel",data.attentionFieldsCount.toString(),colors){onNavigate("/fields")}}
   }
   if(data.criticalFieldsCount>0||data.overdueTasksCount>0){
    Card(colors,border=ErrorRed){
     Row(verticalAlignment=Alignment.CenterVertically){
      Icon(Icons.Default.Warning,null,tint=ErrorRed)
      Spacer(Modifier.width(8.dp))
      Text("Fontos figyelmeztetések",color=MainText,fontWeight=FontWeight.Bold,modifier=Modifier.weight(1f))
     }
     if(data.criticalFieldsCount>0)DashboardLink("${data.criticalFieldsCount} kritikus állapotú tábla",colors){onNavigate("/fields")}
     if(data.overdueTasksCount>0)DashboardLink("${data.overdueTasksCount} lejárt teendő",colors){onNavigate("/daily-work")}
    }
   }
   Card(colors){
    Row(verticalAlignment=Alignment.CenterVertically){
     Text("Figyelmet igénylő táblák",color=MainText,fontWeight=FontWeight.Bold,modifier=Modifier.weight(1f))
     Text("${data.attentionFieldsCount}",color=colors.accent,fontWeight=FontWeight.Bold)
    }
    if(data.attentionFields.isEmpty())Text("Jelenleg nincs kiemelt figyelmeztetés.",fontSize=13.sp,color=SupportingText)
    data.attentionFields.forEach{field->
     Card(colors,border=if(field.condition=="critical")ErrorRed else Color(0xFFE2AD32),onClick={onNavigate("/fields/${field.id}")}){
      Text(field.name,color=MainText,fontWeight=FontWeight.SemiBold)
      Text("${field.farmName} · ${field.areaHa} ha · ${if(field.condition=="critical")"Kritikus" else "Figyelmet igényel"}",color=SupportingText,fontSize=12.sp)
     }
    }
    DashboardLink("Minden földtábla",colors){onNavigate("/fields")}
   }
   Card(colors){
    Text("Következő teendők",color=MainText,fontWeight=FontWeight.Bold,fontSize=17.sp)
    if(data.priorityTasks.isEmpty())Text("Nincs nyitott elvégzendő feladat.",fontSize=13.sp,color=SupportingText)
    data.priorityTasks.forEach{task->
     Card(colors,onClick={onNavigate("/tasks")}){
      Row(verticalAlignment=Alignment.CenterVertically){
       Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(2.dp)){
        Text(task.title,color=MainText,fontWeight=FontWeight.SemiBold,fontSize=14.sp)
        Text("${task.fieldName} · ${huDate(task.dueDate)} · ${taskStatus(task.status)}",color=SupportingText,fontSize=12.sp)
       }
       Icon(Icons.Default.ChevronRight,contentDescription="Teendők megnyitása",tint=colors.accent)
      }
     }
    }
    if(data.waitingReviewCount>0)Text("Ellenőrzésre beküldve: ${data.waitingReviewCount}",color=colors.accent,fontSize=12.sp)
    DashboardLink("Minden teendő",colors){onNavigate("/tasks")}
   }
   DashboardLink("Műveleti napló megnyitása",colors){onNavigate("/operations")}
   Text("Az adatok a belépett felhasználó jogosultsága szerint töltődnek be.",fontSize=12.sp,color=SupportingText)
   OutlinedButton(onClick={revision++}){Text("Adatok frissítése",color=colors.accent)}
  }
 }
}

@Composable
private fun DashboardLink(label:String,colors:PortalPalette,onClick:()->Unit){
 Card(colors,onClick=onClick){
  Row(verticalAlignment=Alignment.CenterVertically){
   Text(label,color=colors.accent,fontWeight=FontWeight.Bold,modifier=Modifier.weight(1f))
   Icon(Icons.Default.ChevronRight,null,tint=colors.accent)
  }
 }
}
