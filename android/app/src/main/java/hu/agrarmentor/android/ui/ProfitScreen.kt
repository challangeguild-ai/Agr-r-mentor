package hu.agrarmentor.android.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.agrarmentor.android.BuildConfig
import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.data.MobileProfitSeason
import hu.agrarmentor.android.data.ProfitRepository
import java.text.NumberFormat
import java.time.LocalDate
import java.util.Locale

private val hu=Locale.forLanguageTag("hu-HU")
private fun money(value:Long)="${NumberFormat.getIntegerInstance(hu).format(value)} Ft"

/** Real financial metrics in the native app; editing opens the authenticated web module. */
@Composable
internal fun ProfitScreen(session:AuthorizedSession,colors:PortalPalette){
 val repository=remember{ProfitRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 var seasons by remember(session.userId){mutableStateOf<List<MobileProfitSeason>>(emptyList())}
 var loading by remember(session.userId){mutableStateOf(true)}
 var error by remember(session.userId){mutableStateOf(false)}
 var selectedYear by remember{mutableIntStateOf(LocalDate.now().year)}
 var revision by remember{mutableIntStateOf(0)}
 LaunchedEffect(session.accessToken,revision){
  loading=true;error=false
  try{seasons=repository.load(session)}catch(_:Exception){error=true}
  finally{loading=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  Card(colors){
   Text("Gazdaságod pénzügyi eredménye",color=colors.accent,fontWeight=FontWeight.ExtraBold,fontSize=19.sp)
   Text("Valódi, táblánként rögzített költségek, terményhozamok és eladások.",fontSize=13.sp,color=Color(0xFF5A7062))
  }
  if(loading)CircularProgressIndicator(color=colors.accent)
  else if(error){
   Card(colors){
    Text("A pénzügyi adatok jelenleg nem tölthetők be. Lehet, hogy az új adatbázismodul még nincs aktiválva.",color=Color(0xFF9F3942),fontSize=13.sp)
    TextButton(onClick={revision++}){Text("Újrapróbálás",color=colors.accent)}
   }
  }else{
   val availableYears=seasons.map{it.year}.distinct().sortedDescending()
   if(availableYears.isNotEmpty()){
    Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
     availableYears.take(5).forEach{year->
      TextButton(onClick={selectedYear=year}){Text(year.toString(),color=if(selectedYear==year)colors.accent else Color.Gray,fontWeight=if(selectedYear==year)FontWeight.ExtraBold else FontWeight.Normal)}
     }
    }
   }
   val current=seasons.filter{it.year==selectedYear}
   if(current.isEmpty())Card(colors){Text("$selectedYear. évre még nincs rögzített pénzügyi adat.",color=Color(0xFF566B5E),fontSize=13.sp)}
   else{
    val cost=current.sumOf{it.figures.cost}
    val revenue=current.sumOf{it.figures.realizedRevenue}
    val expected=current.sumOf{it.figures.projectedResult}
    Card(colors){
     Text("$selectedYear. évi összesítés",color=colors.accent,fontWeight=FontWeight.ExtraBold,fontSize=17.sp)
     Text("Költségek: ${money(cost)}",fontSize=14.sp)
     Text("Tényleges árbevétel: ${money(revenue)}",fontSize=14.sp)
     Text("Realizált eredmény: ${money(revenue-cost)}",fontSize=14.sp,fontWeight=FontWeight.Bold)
     Text("Becsült teljes eredmény: ${money(expected)}",fontSize=14.sp,color=colors.accent,fontWeight=FontWeight.Bold)
    }
    current.forEach{field->
     Card(colors){
      Text(field.fieldName,color=colors.accent,fontWeight=FontWeight.Bold,fontSize=16.sp)
      Text("${field.cropName} · ${field.harvestedTonnes} tonna betakarítva",fontSize=12.sp,color=Color(0xFF617568))
      Text("Eladott: ${field.figures.soldTonnes} t · Készleten: ${field.figures.unsoldTonnes} t",fontSize=13.sp)
      Text("Költség: ${money(field.figures.cost)}",fontSize=13.sp)
      Text("Realizált: ${money(field.figures.realizedResult)}",fontSize=13.sp)
      Text("Becsült: ${money(field.figures.projectedResult)}",fontSize=13.sp,fontWeight=FontWeight.Bold)
     }
    }
   }
   TextButton(onClick={revision++}){Text("Pénzügyi adatok frissítése",color=colors.accent)}
  }
  Card(colors){
   Text("Költség, betakarítás és értékesítés rögzítése",fontSize=15.sp,fontWeight=FontWeight.Bold)
   Text("Az adatfelvitel a biztonságos webes felületen történik; a böngésző külön bejelentkezést kérhet.",fontSize=12.sp,color=Color(0xFF64776A))
   WebModuleOpenButton("/profit",colors)
  }
  Text("A kimutatás nem hivatalos könyvelés: a támogatásokat és az áfát nem osztja fel automatikusan.",fontSize=12.sp,color=Color(0xFF64776A))
 }
}
