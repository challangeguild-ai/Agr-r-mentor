package hu.agrarmentor.android.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.agrarmentor.android.BuildConfig
import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.data.AdvisorSupervisionRepository
import hu.agrarmentor.android.data.MobileSupervisionConfig
import hu.agrarmentor.android.data.MobileSupervisionFarm
import hu.agrarmentor.android.data.mobileSupervisionActive
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID

private val SeasonInk=Color(0xFF223C30)
private val SeasonMuted=Color(0xFF677C70)
private val SeasonError=Color(0xFFC9424E)

@Composable
internal fun AdvisorSupervisionScreen(session:AuthorizedSession,colors:PortalPalette){
 val repo=remember{AdvisorSupervisionRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 var farms by remember(session.accessToken){mutableStateOf<List<MobileSupervisionFarm>?>(null)}
 var error by remember(session.accessToken){mutableStateOf<String?>(null)}
 var busy by remember(session.accessToken){mutableStateOf(true)}
 var revision by remember{mutableIntStateOf(0)}
 LaunchedEffect(session.accessToken,revision){
  busy=true;error=null
  try{farms=repo.load(session)}
  catch(e:CancellationException){throw e}
  catch(e:Exception){error=e.message?:"A szemlézési szezonok nem tölthetők be."}
  finally{busy=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  Text("Szemlézési időszakok és elvárt ellenőrzési ciklusok gazdaságonként",color=SeasonMuted,fontSize=14.sp)
  if(busy)CircularProgressIndicator(color=colors.accent)
  else if(error!=null){
   Text(error!!,color=SeasonError,fontSize=13.sp)
   TextButton(onClick={revision++}){Text("Újrapróbálás")}
  }else farms?.let{items->
   if(items.isEmpty())Text("Még nincs hozzáférhető gazdaság.",color=SeasonMuted)
   items.forEach{farm->SeasonEditor(farm,repo,session,colors,onSaved={revision++})}
   Text("A szezonbeállítás csak az automatikus szemleelvárást változtatja. A gazdálkodói napló és a műveletrögzítés egész évben működik.",color=SeasonMuted,fontSize=12.sp)
  }
 }
}

@Composable
private fun SeasonEditor(farm:MobileSupervisionFarm,repo:AdvisorSupervisionRepository,session:AuthorizedSession,colors:PortalPalette,onSaved:()->Unit){
 var start by remember(farm.id,farm.version){mutableStateOf(farm.config.activeFrom)}
 var end by remember(farm.id,farm.version){mutableStateOf(farm.config.activeTo)}
 var interval by remember(farm.id,farm.version){mutableStateOf(farm.config.inspectionIntervalDays.toString())}
 var enabled by remember(farm.id,farm.version){mutableStateOf(farm.config.enabled)}
 var note by remember(farm.id,farm.version){mutableStateOf(farm.config.note)}
 var requestId by remember(farm.id,farm.version){mutableStateOf(UUID.randomUUID().toString())}
 var saving by remember(farm.id,farm.version){mutableStateOf(false)}
 var error by remember(farm.id,farm.version){mutableStateOf<String?>(null)}
 val scope=rememberCoroutineScope()
 val current=remember(farm.config){mobileSupervisionActive(farm.config,LocalDate.now(ZoneId.of("Europe/Budapest")))}
 Card(colors){
  Text(farm.name,color=SeasonInk,fontSize=17.sp,fontWeight=FontWeight.Bold)
  Text(if(!farm.config.enabled)"Automatikus szemlézés kikapcsolva" else if(current)"Szemlézési szezon aktív" else "Szezonon kívüli időszak",color=colors.accent,fontSize=12.sp)
  Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
   OutlinedTextField(value=start,onValueChange={start=it.take(5)},label={Text("Kezdete HH-NN")},singleLine=true,modifier=Modifier.weight(1f))
   OutlinedTextField(value=end,onValueChange={end=it.take(5)},label={Text("Vége HH-NN")},singleLine=true,modifier=Modifier.weight(1f))
  }
  OutlinedTextField(value=interval,onValueChange={interval=it.filter(Char::isDigit).take(3)},label={Text("Szemleciklus napban (1–365)")},singleLine=true,modifier=Modifier.fillMaxWidth())
  Row(verticalAlignment=Alignment.CenterVertically){
   Checkbox(checked=enabled,onCheckedChange={enabled=it})
   Text("Automatikus szemlefigyelés",color=SeasonInk,fontSize=13.sp)
  }
  OutlinedTextField(value=note,onValueChange={note=it.take(500)},label={Text("Megjegyzés")},minLines=2,modifier=Modifier.fillMaxWidth())
  error?.let{Text(it,color=SeasonError,fontSize=12.sp)}
  Button(enabled=!saving,onClick={
   scope.launch{
    saving=true;error=null
    try{
     val config=MobileSupervisionConfig(start,end,interval.toIntOrNull()?:0,enabled,note.trim())
     repo.save(session,farm.id,config,requestId)
     onSaved()
    }catch(e:CancellationException){throw e}
    catch(e:Exception){error=e.message?:"A szezon mentése sikertelen."}
    finally{saving=false}
   }
  }){Text(if(saving)"Mentés..." else "Szezonbeállítás mentése")}
 }
}
