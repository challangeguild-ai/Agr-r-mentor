package hu.agrarmentor.android.ui

import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.data.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.util.UUID

private val advisorTimeZone=ZoneId.of("Europe/Budapest")
private val advisorHint=Color(0xFF697B70)

@Composable
internal fun AdvisorInspectionDialog(
 session:AuthorizedSession,scopes:AdvisorFieldWorkScopes,repo:AdvisorFieldWorkRepository,
 onDone:(String)->Unit,onDismiss:()->Unit
){
 val coroutine=rememberCoroutineScope()
 val inspectionId=remember{UUID.randomUUID().toString()}
 val eventId=remember{UUID.randomUUID().toString()}
 var fieldId by remember{mutableStateOf("")}
 var date by remember{mutableStateOf(LocalDate.now(advisorTimeZone).toString())}
 var condition by remember{mutableStateOf("good")}
 var followUp by remember{mutableStateOf("")}
 var issueStatus by remember{mutableStateOf("open")}
 var nextCheck by remember{mutableStateOf("")}
 var notes by remember{mutableStateOf("")}
 var recommendation by remember{mutableStateOf("")}
 var attempted by remember{mutableStateOf(false)}
 var saving by remember{mutableStateOf(false)}
 var error by remember{mutableStateOf<String?>(null)}
 val choices=scopes.fields.map{field->field.id to "${scopes.farms.find{it.id==field.farmId}?.name?:"Gazdaság"} · ${field.name}"}
 AlertDialog(
  onDismissRequest={if(!saving)onDismiss()},title={Text("Új táblaszemle")},
  text={Column(Modifier.fillMaxWidth().heightIn(max=490.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(8.dp)){
   Text("A szemle a közös szakmai nyilvántartásba kerül. Ez az egyszerű mobilrögzítés nem küld automatikus e-mailt, gazdálkodói üzenetet, fényképet vagy teendőt.",fontSize=12.sp,color=advisorHint)
   AdvisorFieldWorkChoice("Földtábla",choices,fieldId,{fieldId=it},!attempted)
   OutlinedTextField(date,{date=it.take(10)},label={Text("Szemle napja (ÉÉÉÉ-HH-NN)")},modifier=Modifier.fillMaxWidth(),singleLine=true,enabled=!attempted)
   AdvisorFieldWorkChoice("Állapot",listOf("good" to "Jó","attention" to "Figyelmet igényel","critical" to "Kritikus"),condition,{condition=it},!attempted)
   AdvisorFieldWorkChoice("Előző szemléhez képest",listOf("" to "Nincs megadva","improved" to "Javult","unchanged" to "Változatlan","worsened" to "Romlott"),followUp,{followUp=it},!attempted)
   AdvisorFieldWorkChoice("Probléma állapota",listOf("open" to "Nyitott","monitoring" to "Megfigyelés","resolved" to "Lezárva"),issueStatus,{issueStatus=it},!attempted)
   OutlinedTextField(nextCheck,{nextCheck=it.take(10)},label={Text("Következő ellenőrzés (opcionális dátum)")},modifier=Modifier.fillMaxWidth(),singleLine=true,enabled=!attempted)
   OutlinedTextField(notes,{notes=it.take(5000)},label={Text("Megfigyelések")},modifier=Modifier.fillMaxWidth(),minLines=2,enabled=!attempted)
   OutlinedTextField(recommendation,{recommendation=it.take(5000)},label={Text("Szakmai javaslat")},modifier=Modifier.fillMaxWidth(),minLines=2,enabled=!attempted)
   if(attempted)Text("A mentés megkezdődött. Hálózati hiba után azonos azonosítóval próbáljuk újra; a mezők addig zároltak.",fontSize=12.sp,color=advisorHint)
   if(error!=null)Text(error!!,color=Color(0xFFC23F3F),fontSize=12.sp)
  }},
  confirmButton={TextButton(onClick={
   val input=AdvisorInspectionInput(fieldId,date,condition,notes,recommendation,followUp,issueStatus,nextCheck)
   try{validAdvisorInspectionUi(input)}catch(e:Exception){error=e.message?:"Érvénytelen adatok.";return@TextButton}
   attempted=true;saving=true;error=null
   coroutine.launch{
    try{
     val result=repo.createInspection(session,input,inspectionId,eventId)
     onDone(if(result.warnings.isEmpty())"A táblaszemle elmentve." else "A táblaszemle elmentve. ${result.warnings.joinToString(" ")}")
    }catch(e:CancellationException){throw e}
    catch(e:Exception){error="A mentés nem igazolható: ${e.message?:"Ellenőrizd a listát, majd próbáld újra."}"}
    finally{saving=false}
   }
  },enabled=!saving&&fieldId.isNotBlank()){
   Text(if(saving)"Mentés…" else if(attempted)"Mentés ellenőrzése újra" else "Szemle mentése")
  }},
  dismissButton={TextButton(onClick=onDismiss,enabled=!saving){Text("Bezárás")}}
 )
}

/** UI checks run before freezing an idempotent request; server and repository repeat validation. */
private fun validAdvisorInspectionUi(input:AdvisorInspectionInput){
 require(input.fieldId.isNotBlank()){"Válassz földtáblát."}
 LocalDate.parse(input.date)
 if(input.nextCheck.isNotBlank())LocalDate.parse(input.nextCheck)
 require(!LocalDate.parse(input.date).isAfter(LocalDate.now(advisorTimeZone))){"Jövőbeli szemle nem menthető."}
}

@Composable
internal fun AdvisorVisitDialog(
 session:AuthorizedSession,scopes:AdvisorFieldWorkScopes,repo:AdvisorFieldWorkRepository,
 onDone:(String)->Unit,onDismiss:()->Unit
){
 val coroutine=rememberCoroutineScope()
 val eventId=remember{UUID.randomUUID().toString()}
 var farmId by remember{mutableStateOf("")}
 var fieldId by remember{mutableStateOf("")}
 var date by remember{mutableStateOf(LocalDate.now(advisorTimeZone).toString())}
 var time by remember{mutableStateOf(LocalTime.now(advisorTimeZone).plusHours(1).withSecond(0).withNano(0).toString())}
 var purpose by remember{mutableStateOf("")}
 var note by remember{mutableStateOf("")}
 var attempted by remember{mutableStateOf(false)}
 var saving by remember{mutableStateOf(false)}
 var error by remember{mutableStateOf<String?>(null)}
 AlertDialog(
  onDismissRequest={if(!saving)onDismiss()},title={Text("Látogatás tervezése")},
  text={Column(Modifier.fillMaxWidth().heightIn(max=490.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(8.dp)){
   Text("A látogatás a közös munkanapban is megjelenik. A natív mentés nem küld automatikus üzenetet vagy e-mailt a gazdálkodónak.",fontSize=12.sp,color=advisorHint)
   AdvisorFieldWorkChoice("Gazdaság",scopes.farms.map{it.id to it.name},farmId,{farmId=it;fieldId=""},!attempted)
   AdvisorFieldWorkChoice("Földtábla (opcionális)",listOf("" to "Gazdaságszintű látogatás")+scopes.fields.filter{it.farmId==farmId}.map{it.id to it.name},fieldId,{fieldId=it},!attempted)
   OutlinedTextField(date,{date=it.take(10)},label={Text("Nap (ÉÉÉÉ-HH-NN)")},modifier=Modifier.fillMaxWidth(),singleLine=true,enabled=!attempted)
   OutlinedTextField(time,{time=it.take(5)},label={Text("Időpont (ÓÓ:PP, magyar idő)")},modifier=Modifier.fillMaxWidth(),singleLine=true,enabled=!attempted)
   OutlinedTextField(purpose,{purpose=it.take(180)},label={Text("Látogatás célja")},modifier=Modifier.fillMaxWidth(),singleLine=true,enabled=!attempted)
   OutlinedTextField(note,{note=it.take(3000)},label={Text("Megjegyzés")},modifier=Modifier.fillMaxWidth(),minLines=2,enabled=!attempted)
   if(attempted)Text("Hálózati hiba esetén ugyanazt a látogatást ellenőrizzük újra; a mezők addig zároltak.",fontSize=12.sp,color=advisorHint)
   if(error!=null)Text(error!!,color=Color(0xFFC23F3F),fontSize=12.sp)
  }},
  confirmButton={TextButton(onClick={
   val input=AdvisorVisitInput(farmId,fieldId.takeIf{it.isNotBlank()},date,time,purpose,note)
   try{validAdvisorVisitUi(input)}catch(e:Exception){error=e.message?:"Érvénytelen időpont.";return@TextButton}
   attempted=true;saving=true;error=null
   coroutine.launch{
    try{
     val result=repo.createVisit(session,input,eventId)
     onDone(if(result.warnings.isEmpty())"A látogatás elmentve." else "A látogatás elmentve. ${result.warnings.joinToString(" ")}")
    }catch(e:CancellationException){throw e}
    catch(e:Exception){error="A mentés nem igazolható: ${e.message?:"Ellenőrizd a listát, majd próbáld újra."}"}
    finally{saving=false}
   }
  },enabled=!saving&&farmId.isNotBlank()&&purpose.isNotBlank()){
   Text(if(saving)"Mentés…" else if(attempted)"Mentés ellenőrzése újra" else "Látogatás mentése")
  }},
  dismissButton={TextButton(onClick=onDismiss,enabled=!saving){Text("Bezárás")}}
 )
}

private fun validAdvisorVisitUi(input:AdvisorVisitInput){
 require(input.farmId.isNotBlank()&&input.purpose.isNotBlank()){"Gazdaság és látogatási cél szükséges."}
 // The repository additionally rejects the missing/ambiguous DST hour in Hungary.
 LocalDate.parse(input.localDate)
 java.time.LocalTime.parse(input.localTime)
}

@Composable
private fun AdvisorFieldWorkChoice(label:String,choices:List<Pair<String,String>>,value:String,onChange:(String)->Unit,enabled:Boolean){
 var open by remember{mutableStateOf(false)}
 Box{
  OutlinedButton(onClick={open=true},enabled=enabled){
   Text("$label: ${choices.find{it.first==value}?.second?:"Válassz"}",fontSize=12.sp)
  }
  DropdownMenu(expanded=open&&enabled,onDismissRequest={open=false}){
   choices.forEach{(key,display)->DropdownMenuItem(text={Text(display,fontSize=13.sp)},onClick={onChange(key);open=false})}
  }
 }
}
