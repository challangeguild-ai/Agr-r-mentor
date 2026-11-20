package hu.agrarmentor.android.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.agrarmentor.android.BuildConfig
import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.data.DispatchChoices
import hu.agrarmentor.android.data.DispatchDraft
import hu.agrarmentor.android.data.TaskDispatchRepository
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.util.UUID

/** Manager/owner task dispatch; the server rechecks access before INSERT. */
@Composable
internal fun TaskDispatchScreen(session:AuthorizedSession,colors:PortalPalette,onNavigate:(String)->Unit){
 val repo=remember{TaskDispatchRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 val scope=rememberCoroutineScope()
 var choices by remember{mutableStateOf<DispatchChoices?>(null)}
 var loading by remember{mutableStateOf(true)}
 var error by remember{mutableStateOf<String?>(null)}
 var success by remember{mutableStateOf<String?>(null)}
 var revision by remember{mutableIntStateOf(0)}
 var farmId by remember{mutableStateOf("")}
 var fieldId by remember{mutableStateOf("")}
 var personId by remember{mutableStateOf("")}
 var title by remember{mutableStateOf("")}
 var description by remember{mutableStateOf("")}
 var due by remember{mutableStateOf("")}
 var priority by remember{mutableStateOf("normal")}
 var requestId by remember{mutableStateOf(UUID.randomUUID().toString())}
 var saving by remember{mutableStateOf(false)}
 LaunchedEffect(session.accessToken,revision){
  loading=true;error=null
  try{choices=repo.choices(session)}catch(_:Exception){error="A munkakiosztási jogosultságok nem tölthetők be."}
  finally{loading=false}
 }
 val selected=choices?.farms?.firstOrNull{it.id==farmId}
 val fields=choices?.fields?.filter{it.farmId==farmId}.orEmpty()
 val people=choices?.people?.filter{it.farmId==farmId}.orEmpty()
 val validDue=due.isBlank()||runCatching{LocalDate.parse(due).toString()==due}.getOrDefault(false)
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  Text("Új munka kiosztása a gazdaság aktív munkatársának. A jogosultságot mentéskor a szerver is ellenőrzi.",color=Color(0xFF6C7D72),fontSize=13.sp)
  if(loading)CircularProgressIndicator(color=colors.accent)
  else if(choices?.farms.isNullOrEmpty()){
   Text("Nincs olyan gazdaság, amelyben munkakiosztási jogosultságod lenne.",color=Color(0xFF6C7D72))
  }else{
   Card(colors){
    Text("Gazdaság",fontWeight=FontWeight.Bold,color=colors.accent)
    Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(8.dp)){
     choices!!.farms.forEach{farm->FilterChip(selected=farmId==farm.id,onClick={
      farmId=farm.id;fieldId="";personId="";success=null
     },label={Text(farm.name)})}
    }
    if(selected!=null){
     Text("Földtábla",fontWeight=FontWeight.Bold,color=colors.accent)
     Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(8.dp)){
      fields.forEach{field->FilterChip(selected=fieldId==field.id,onClick={fieldId=field.id;success=null},label={Text(field.name)})}
     }
     if(fields.isEmpty())Text("Ebben a gazdaságban nincs elérhető földtábla.",color=Color(0xFF6C7D72),fontSize=12.sp)
     Text("Végrehajtó",fontWeight=FontWeight.Bold,color=colors.accent)
     Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(8.dp)){
      people.forEach{person->FilterChip(selected=personId==person.id,onClick={personId=person.id;success=null},label={Text(person.name)})}
     }
     OutlinedTextField(title,{title=it.take(180);success=null},label={Text("Feladat megnevezése")},singleLine=true,modifier=Modifier.fillMaxWidth())
     OutlinedTextField(description,{description=it.take(3000);success=null},label={Text("Leírás (nem kötelező)")},minLines=2,modifier=Modifier.fillMaxWidth())
     OutlinedTextField(due,{due=it.take(10);success=null},label={Text("Határidő (ÉÉÉÉ-HH-NN)")},singleLine=true,keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Ascii),isError=!validDue,modifier=Modifier.fillMaxWidth())
     Text("Prioritás",fontWeight=FontWeight.Bold,color=colors.accent)
     Row(horizontalArrangement=Arrangement.spacedBy(7.dp)){
      listOf("normal" to "Normál","high" to "Fontos","urgent" to "Sürgős").forEach{(value,label)->
       FilterChip(selected=priority==value,onClick={priority=value;success=null},label={Text(label)})
      }
     }
     if(error!=null)Text(error!!,color=Color(0xFFB1303E),fontSize=13.sp)
     if(success!=null)Text(success!!,color=colors.accent,fontSize=13.sp)
     Button(onClick={
      saving=true;error=null;success=null
      scope.launch{
       try{
        val draft=DispatchDraft(farmId,fieldId,personId,title,description,due.takeIf{it.isNotBlank()},priority)
        val result=repo.dispatch(session,draft,requestId)
        success=when{
         result.alreadyExisted->"Ez a teendő korábban már létrejött; nem dupláztuk meg."
         result.timelineWarning->"A feladat létrejött, de a naplóbejegyzés nem sikerült. A munkatársat külön értesítsd."
         else->"A feladat sikeresen kiosztva. A munkatársat külön értesítsd."
        }
        requestId=UUID.randomUUID().toString()
        title="";description="";due=""
       }catch(_:Exception){error="A mentést nem sikerült igazolni. Nézd át a teendőlistát, mielőtt újrapróbálod."}
       finally{saving=false}
      }
     },enabled=!saving&&fieldId.isNotBlank()&&personId.isNotBlank()&&title.isNotBlank()&&validDue,
      colors=ButtonDefaults.buttonColors(containerColor=colors.accent),shape=RoundedCornerShape(12.dp)){
      Text(if(saving)"Mentés…" else "Munka kiosztása")
     }
     TextButton(onClick={onNavigate("/tasks")}){Text("Teendők megtekintése")}
    }
   }
  }
  if(error!=null&&choices==null)OutlinedButton(onClick={revision++}){Text("Újrapróbálás")}
 }
}
