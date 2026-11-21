package hu.agrarmentor.android.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedButton
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
import hu.agrarmentor.android.data.AdvisorExtrasRepository
import hu.agrarmentor.android.data.AdvisorFieldWorkRepository
import hu.agrarmentor.android.data.AdvisorFieldWorkScopes
import hu.agrarmentor.android.data.MobileAdvisorRecord
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@Composable
internal fun AdvisorExtrasScreen(route:String,session:AuthorizedSession,colors:PortalPalette){
 val repo=remember{AdvisorExtrasRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 val writeRepo=remember{AdvisorFieldWorkRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 val scope=rememberCoroutineScope()
 var entries by remember{mutableStateOf<List<MobileAdvisorRecord>>(emptyList())}
 var busy by remember{mutableStateOf(true)}
 var failed by remember{mutableStateOf(false)}
 var revision by remember{mutableIntStateOf(0)}
 var fieldScopes by remember(session.userId){mutableStateOf<AdvisorFieldWorkScopes?>(null)}
 var scopeError by remember(session.userId){mutableStateOf<String?>(null)}
 var createDialog by remember{mutableStateOf<String?>(null)}
 var deciding by remember{mutableStateOf<Pair<MobileAdvisorRecord,String>?>(null)}
 var saving by remember{mutableStateOf(false)}
 var notice by remember{mutableStateOf<String?>(null)}
 LaunchedEffect(route,session.accessToken,revision){
  if(route=="/admin/inspections"||route=="/admin/visits"){
   scopeError=null
   try{fieldScopes=writeRepo.scopes(session)}
   catch(e:CancellationException){throw e}
   catch(e:Exception){fieldScopes=null;scopeError=e.message?:"Nem tölthetők be a gazdaságok és földtáblák."}
  }
 }
 LaunchedEffect(route,session.accessToken,revision){
  busy=true;failed=false
  try{entries=repo.load(route,session)}
  catch(e:CancellationException){throw e}
  catch(_:Exception){failed=true}
  finally{busy=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  notice?.let{Text(it,color=colors.accent,fontSize=13.sp)}
  if(route=="/admin/inspections"||route=="/admin/visits"){
   OutlinedButton(onClick={createDialog=if(route=="/admin/inspections")"inspection" else "visit"},enabled=fieldScopes!=null){
    Text(if(route=="/admin/inspections")"Új szemle rögzítése" else "Új látogatás tervezése",color=colors.accent)
   }
   scopeError?.let{Text("A rögzítéshez szükséges adatok nem tölthetők be: $it",color=Color(0xFFC23F3F),fontSize=12.sp)}
   Text("A fényképek, GPS-problémapontok, gazdálkodói értesítések és kapcsolódó feladatok részletes kezelése a webes Agrár Mentorban érhető el.",color=Color(0xFF6C7D72),fontSize=12.sp)
   WebModuleOpenButton(route,colors)
  }
  if(busy)CircularProgressIndicator(color=colors.accent)
  else if(failed)LoadError(colors,onRetry={revision++})
  else if(entries.isEmpty())Text("Még nincs elérhető bejegyzés.",color=Color(0xFF6C7D72))
  else entries.forEach{entry->
   Card(colors){
    Text(entry.title,fontSize=16.sp,fontWeight=FontWeight.Bold,color=Color(0xFF1D3026))
    Text(entry.subtitle,fontSize=13.sp,color=colors.accent)
    if(entry.date!=null)Text(huDate(entry.date),fontSize=12.sp,color=Color(0xFF6C7D72))
    if(entry.detail!=null)Text(entry.detail,fontSize=13.sp,color=Color(0xFF1D3026))
    if(route=="/admin/visits"&&entry.owned&&entry.visitStatus=="planned"){
     Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
      TextButton(onClick={deciding=entry to "completed"}){Text("Elvégezve",color=colors.accent)}
      TextButton(onClick={deciding=entry to "cancelled"}){Text("Lemondás",color=Color(0xFFC1453B))}
     }
    }
   }
  }
 }
 if(createDialog=="inspection")fieldScopes?.let{scopes->
  AdvisorInspectionDialog(session,scopes,writeRepo,onDone={message->
   notice=message;createDialog=null;revision++
  },onDismiss={createDialog=null})
 }
 if(createDialog=="visit")fieldScopes?.let{scopes->
  AdvisorVisitDialog(session,scopes,writeRepo,onDone={message->
   notice=message;createDialog=null;revision++
  },onDismiss={createDialog=null})
 }
 deciding?.let{(record,target)->
  AlertDialog(onDismissRequest={if(!saving)deciding=null},title={Text(if(target=="completed")"Látogatás befejezése" else "Látogatás lemondása")},
   text={Text("${record.title}\nA változás a közös munkanapban is megjelenik. Biztosan folytatod?")},
   confirmButton={TextButton(onClick={
    val id=record.id?:return@TextButton
    val description=record.visitDescription?:return@TextButton
    saving=true;notice=null
    scope.launch{
     try{writeRepo.updateVisit(session,id,description,target)
      notice=if(target=="completed")"A látogatás elvégzettként elmentve." else "A látogatás lemondva."
      deciding=null;revision++
     }catch(e:CancellationException){throw e}
     catch(e:Exception){notice="Az állapot nem módosítható: ${e.message?:"Frissítsd a listát."}";deciding=null;revision++}
     finally{saving=false}
    }
   },enabled=!saving){Text(if(saving)"Mentés…" else "Megerősítem")}},
   dismissButton={TextButton(onClick={deciding=null},enabled=!saving){Text("Mégsem")}}
  )
 }
}
