package hu.agrarmentor.android.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.agrarmentor.android.BuildConfig
import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.data.AdvisorReport
import hu.agrarmentor.android.data.AdvisorReportTaskInput
import hu.agrarmentor.android.data.AdvisorReportTaskRules
import hu.agrarmentor.android.data.CommunicationRepository
import kotlinx.coroutines.launch

private val TextInk=Color(0xFF1D3026)
private val TextSoft=Color(0xFF6C7D72)
private val ReportRed=Color(0xFFB1303E)

@Composable
internal fun LiveAdvisorReportsScreen(session:AuthorizedSession,colors:PortalPalette){
 val repo=remember{CommunicationRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 val context=LocalContext.current
 val scope=rememberCoroutineScope()
 var records by remember(session.userId){mutableStateOf<List<AdvisorReport>>(emptyList())}
 var loading by remember{mutableStateOf(true)}
 var error by remember{mutableStateOf<String?>(null)}
 var message by remember{mutableStateOf<String?>(null)}
 var revision by remember{mutableIntStateOf(0)}
 var filter by remember{mutableStateOf("Nyitott")}
 var handling by remember{mutableStateOf<Pair<AdvisorReport,Boolean>?>(null)}
 var reply by remember{mutableStateOf("")}
 var attachTask by remember{mutableStateOf(false)}
 var taskTitle by remember{mutableStateOf("")}
 var taskDueDate by remember{mutableStateOf("")}
 var taskPriority by remember{mutableStateOf("normal")}
 var shownCount by remember(session.userId){mutableIntStateOf(100)}
 var saving by remember{mutableStateOf(false)}
 var openingMedia by remember{mutableStateOf<String?>(null)}
 LaunchedEffect(session.accessToken,revision){
  loading=true;error=null
  try{records=repo.advisorReports(session)}catch(e:Exception){error=e.message?:"A bejelentések betöltése sikertelen."}
  finally{loading=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(11.dp)){
  Text("Gazdálkodói bejelentések és szakmai válaszok",color=TextSoft,fontSize=13.sp)
  if(message!=null)Text(message!!,color=colors.accent,fontSize=12.sp)
  Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(6.dp)){
   listOf("Nyitott","Válaszra vár","Megválaszolt","Lezárt","Mind").forEach{option->
    FilterChip(selected=filter==option,onClick={filter=option;shownCount=100},label={Text(option,fontSize=11.sp)})
   }
  }
  val shown=records.filter{entry->when(filter){
   "Nyitott"->entry.status!="closed"
   "Válaszra vár"->entry.status!="closed"&&entry.status!="reviewed"
   "Megválaszolt"->entry.status=="reviewed"
   "Lezárt"->entry.status=="closed"
   else->true
  }}
  if(loading)CircularProgressIndicator(color=colors.accent)
  else if(error!=null){
   Text(error!!,color=ReportRed,fontSize=13.sp)
   OutlinedButton(onClick={revision++}){Text("Újrapróbálás")}
  }else if(shown.isEmpty())Text("Ebben a szűrésben nincs bejelentés.",color=TextSoft)
  else shown.take(shownCount).forEach{report->
   Card(colors,border=if(report.severity=="urgent")ReportRed else colors.border){
    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){
     Text(report.title,Modifier.weight(1f),color=TextInk,fontSize=16.sp,fontWeight=FontWeight.Bold)
     Text(when(report.status){"closed"->"Lezárt";"reviewed"->"Megválaszolt";else->"Új"},color=colors.accent,fontSize=11.sp)
    }
    Text("${report.fieldName} · ${huDate(report.createdAt)}",color=TextSoft,fontSize=12.sp)
    Text("${when(report.severity){"urgent"->"SÜRGŐS";"high"->"Fontos";else->"Normál"}} · ${report.category}",color=if(report.severity=="urgent")ReportRed else TextSoft,fontSize=12.sp)
    if(report.message.isNotBlank())Text(report.message,color=TextInk,fontSize=13.sp)
    report.attachments.forEach{attachment->
     TextButton(onClick={
      openingMedia=attachment.path
      scope.launch{
       try{
        val signed=repo.signedReportAttachmentUrl(session,attachment)
        context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(signed)).addCategory(Intent.CATEGORY_BROWSABLE))
       }catch(e:Exception){message="A csatolmány nem nyitható meg: ${e.message?:"Nincs hozzáférés."}"}
       finally{openingMedia=null}
      }
     },enabled=openingMedia==null){Text(if(openingMedia==attachment.path)"Megnyitás…" else "${if(attachment.mediaType=="video")"Videó"else"Fénykép"}: ${attachment.fileName}",color=colors.accent)}
    }
    if(!report.reply.isNullOrBlank()){
     HorizontalDivider(color=colors.border)
     Text("Korábbi szaktanácsadói válasz:",color=colors.accent,fontSize=12.sp,fontWeight=FontWeight.Bold)
     Text(report.reply,color=TextInk,fontSize=13.sp)
    }
    if(report.status!="closed"){
     Row(horizontalArrangement=Arrangement.spacedBy(9.dp)){
      TextButton(onClick={handling=report to false;reply=report.reply.orEmpty();attachTask=false;taskTitle="Teendő: ${report.title}".take(180);taskDueDate="";taskPriority="normal"}){Text("Válaszolok",color=colors.accent)}
      TextButton(onClick={handling=report to true;reply="";attachTask=false}){Text("Lezárom",color=ReportRed)}
     }
    }
   }
  }
  if(shown.size>shownCount)TextButton(onClick={shownCount+=100}){Text("További bejelentések (${shown.size-shownCount} hátra)")}
 }
 handling?.let{(report,close)->
  AlertDialog(
   onDismissRequest={if(!saving)handling=null},
   title={Text(if(close)"Bejelentés lezárása"else"Szaktanácsadói válasz")},
   text={Column(Modifier.heightIn(max=480.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(9.dp)){
    Text(report.title,color=TextInk,fontWeight=FontWeight.Bold)
    Text(report.fieldName,color=TextSoft,fontSize=12.sp)
    if(close)Text("A lezárás a gazdálkodónál is megjelenik. A korábbi válasz megmarad.",fontSize=12.sp)
    else{
     Text("A válasz naplóbejegyzést, belső értesítést és ellenőrzött e-mailt indíthat. Kérésre új teendő is rögzíthető.",fontSize=12.sp)
     OutlinedTextField(reply,{reply=it.take(5000)},label={Text("Válasz a gazdálkodónak")},minLines=4,modifier=Modifier.fillMaxWidth())
     Row(verticalAlignment=androidx.compose.ui.Alignment.CenterVertically){
      Checkbox(checked=attachTask,onCheckedChange={attachTask=it})
      Text("Új teendő kiosztása a gazdálkodónak",fontSize=13.sp)
     }
     if(attachTask){
      OutlinedTextField(taskTitle,{taskTitle=it.take(180)},label={Text("Teendő neve")},singleLine=true,modifier=Modifier.fillMaxWidth())
      OutlinedTextField(taskDueDate,{taskDueDate=it.take(10)},label={Text("Határidő (ÉÉÉÉ-HH-NN, opcionális)")},singleLine=true,modifier=Modifier.fillMaxWidth())
      Text("Prioritás",fontSize=12.sp,color=TextSoft)
      Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(5.dp)){
       listOf("normal" to "Normál","high" to "Fontos","urgent" to "Sürgős").forEach{(key,label)->
        FilterChip(selected=taskPriority==key,onClick={taskPriority=key},label={Text(label,fontSize=11.sp)})
       }
      }
     }
    }
   }},
   confirmButton={TextButton(onClick={
    saving=true;error=null
    scope.launch{
     try{
      val task=if(!close&&attachTask)AdvisorReportTaskInput(taskTitle,taskDueDate.ifBlank{null},taskPriority)else null
      val result=repo.decideReport(session,report,reply,close,task)
      val headline=if(result.alreadySaved)"A döntés korábban már mentve volt."
       else if(close)"A bejelentést lezártuk."else"A választ elmentettük."
      message=headline+(if(result.taskId!=null)" A teendő is létrejött."else"")+
       (if(result.warnings.isNotEmpty())" Figyelem: ${result.warnings.joinToString(" ")}"else"")
      handling=null;revision++
     }catch(e:Exception){message="A döntés nem menthető: ${e.message?:"Frissítsd a listát."}"}
     finally{saving=false}
    }
   },enabled=!saving&&(close||reply.trim().isNotEmpty())&&
    (!attachTask||close||AdvisorReportTaskRules.validate(AdvisorReportTaskInput(taskTitle,taskDueDate.ifBlank{null},taskPriority)))){Text(if(saving)"Mentés…"else"Megerősítem")}},
   dismissButton={TextButton(onClick={handling=null},enabled=!saving){Text("Mégsem")}}
  )
 }
}
