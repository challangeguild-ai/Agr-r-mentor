package hu.agrarmentor.android.ui

import androidx.compose.foundation.layout.*
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
import hu.agrarmentor.android.data.AdvisorMapQualityRepository
import hu.agrarmentor.android.data.MobileBoundaryQuality
import hu.agrarmentor.android.data.MobileFieldQuality
import kotlinx.coroutines.CancellationException

private val QualityInk=Color(0xFF233B30)
private val QualityMuted=Color(0xFF6D7B70)
private val QualityWarn=Color(0xFFC1453B)

@Composable
internal fun AdvisorMapQualityScreen(session:AuthorizedSession,colors:PortalPalette,onNavigate:(String)->Unit){
 val repo=remember{AdvisorMapQualityRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 var fields by remember(session.accessToken){mutableStateOf<List<MobileFieldQuality>?>(null)}
 var busy by remember(session.accessToken){mutableStateOf(true)}
 var error by remember(session.accessToken){mutableStateOf<String?>(null)}
 var revision by remember{mutableIntStateOf(0)}
 LaunchedEffect(session.accessToken,revision){
  busy=true;error=null
  try{fields=repo.load(session)}
  catch(e:CancellationException){throw e}
  catch(e:Exception){error=e.message?:"A térképi minőségellenőrzés nem érhető el."}
  finally{busy=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  Text("Hol hiányzik térképi hely, hol van csak pont, és mely tábláknál tér el a terület?",color=QualityMuted,fontSize=14.sp)
  if(busy)CircularProgressIndicator(color=colors.accent)
  else if(error!=null){
   Text(error!!,color=QualityWarn,fontSize=13.sp)
   TextButton(onClick={revision++}){Text("Újrapróbálás")}
  }else fields?.let{items->
   Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
    Box(Modifier.weight(1f)){Metric("Hiányzó hely",items.count{it.status==MobileBoundaryQuality.MISSING},colors)}
    Box(Modifier.weight(1f)){Metric("Csak helypont",items.count{it.status==MobileBoundaryQuality.POINT},colors)}
   }
   Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
    Box(Modifier.weight(1f)){Metric("Területeltérés",items.count{it.status==MobileBoundaryQuality.WARNING},colors)}
    Box(Modifier.weight(1f)){Metric("Hibás poligon",items.count{it.status==MobileBoundaryQuality.INVALID},colors)}
   }
   Card(colors){
    Text("Poligonnal rögzítve: ${items.count{it.status==MobileBoundaryQuality.BOUNDED}}",color=colors.accent,fontWeight=FontWeight.Bold)
    Text("Összesen ${items.size} betöltött földtábla (egyszerre legfeljebb 1000).",color=QualityMuted,fontSize=12.sp)
   }
   TextButton(onClick={onNavigate("/admin/map/proposals")}){Text("Beküldött határjavaslatok ›",color=colors.accent)}
   if(items.isEmpty())Text("Nincs ellenőrizhető földtábla.",color=QualityMuted)
   items.forEach{field->
    val warning=field.status in listOf(MobileBoundaryQuality.INVALID,MobileBoundaryQuality.MISSING,MobileBoundaryQuality.WARNING)
    Card(colors,border=if(warning)QualityWarn else colors.border,onClick={onNavigate("/fields/${field.id}")}){
     Text(field.name,color=QualityInk,fontSize=16.sp,fontWeight=FontWeight.Bold)
     Text(field.farmName,color=QualityMuted,fontSize=12.sp)
     Text(when(field.status){
      MobileBoundaryQuality.MISSING->"Nincs térképi hely"
      MobileBoundaryQuality.POINT->"Csak helypont"
      MobileBoundaryQuality.WARNING->"Ellenőrizendő területeltérés"
      MobileBoundaryQuality.BOUNDED->"Poligon rögzítve"
      MobileBoundaryQuality.INVALID->"Hibás poligon"
     },color=if(warning)QualityWarn else colors.accent,fontSize=12.sp,fontWeight=FontWeight.Bold)
     Text(field.note,color=QualityMuted,fontSize=12.sp)
     field.areaHa?.let{Text("Nyilvántartott terület: $it ha",color=QualityMuted,fontSize=12.sp)}
    }
   }
   Text("Az Android-területbecslés tájékoztató. Nem végez szomszédos poligonok átfedésvizsgálatát, és nem hivatalos földmérés.",color=QualityMuted,fontSize=12.sp)
  }
 }
}
