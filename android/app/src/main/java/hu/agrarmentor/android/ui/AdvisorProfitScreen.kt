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
import hu.agrarmentor.android.data.AdvisorFinanceFarm
import hu.agrarmentor.android.data.AdvisorProfitRepository
import java.text.NumberFormat
import java.time.LocalDate
import java.util.Locale

private val hu=Locale.forLanguageTag("hu-HU")
private fun huf(n:Long)="${NumberFormat.getIntegerInstance(hu).format(n)} Ft"
private fun tonnes(n:Double)="${NumberFormat.getNumberInstance(hu).apply{maximumFractionDigits=3}.format(n)} t"

@Composable
internal fun AdvisorProfitScreen(session:AuthorizedSession,colors:PortalPalette,onNavigate:(String)->Unit){
 val repo=remember{AdvisorProfitRepository(BuildConfig.WEB_ORIGIN)}
 var farms by remember(session.userId){mutableStateOf<List<AdvisorFinanceFarm>>(emptyList())}
 var loading by remember(session.userId){mutableStateOf(true)}
 var error by remember(session.userId){mutableStateOf(false)}
 var revision by remember{mutableIntStateOf(0)}
 var year by remember{mutableIntStateOf(LocalDate.now().year)}
 LaunchedEffect(session.accessToken,revision){
  loading=true;error=false
  try{farms=repo.load(session);val years=farms.flatMap{it.seasons}.map{it.year};if(years.isNotEmpty()&&year !in years)year=years.max()}
  catch(_:Exception){error=true}
  finally{loading=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  Card(colors){Text("Jövedelmezőség · ügyfelek",color=colors.accent,fontSize=18.sp,fontWeight=FontWeight.ExtraBold)
   Text("Pontos összegek a dokumentáltan hozzád rendelt gazdaságokból. A megtekintés naplózott.",color=Color(0xFF617687),fontSize=12.sp)}
  if(loading)CircularProgressIndicator(color=colors.accent)
  else if(error)Card(colors){Text("A pénzügyi adatok nem tölthetők be. Ellenőrizd a kapcsolatot és a jogosultságodat.",fontSize=12.sp,color=Color(0xFF9F3942))
   TextButton(onClick={revision++}){Text("Újrapróbálás",color=colors.accent)}}
  else if(farms.isEmpty())Card(colors){Text("Nincs engedélyezett pénzügyi gazdaság.",fontWeight=FontWeight.Bold,color=colors.accent)
   Text("Hozzáférést a rendszeradminisztrátor adhat dokumentált felhatalmazással.",fontSize=12.sp)}
  else{
   val years=farms.flatMap{it.seasons}.map{it.year}.distinct().sortedDescending()
   Row(modifier=Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(8.dp)){
    years.forEach{y->TextButton(onClick={year=y}){Text(y.toString(),color=if(y==year)colors.accent else Color.Gray)}}
   }
   val current=farms.flatMap{it.seasons}.filter{it.year==year}
   Card(colors){Text("$year. évi pénzügyi összesítés",color=colors.accent,fontWeight=FontWeight.ExtraBold)
    Text("Költségek: ${huf(current.sumOf{it.figures.cost})}")
    Text("Tényleges árbevétel: ${huf(current.sumOf{it.figures.realizedRevenue})}")
    Text("Realizált eredmény: ${huf(current.sumOf{it.figures.realizedResult})}",fontWeight=FontWeight.Bold)
    Text("Becsült eredmény: ${huf(current.sumOf{it.figures.projectedResult})}",fontWeight=FontWeight.Bold,color=colors.accent)}
   farms.forEach{farm->
    val rows=farm.seasons.filter{it.year==year}
    if(rows.isNotEmpty())Card(colors){Text(farm.name,color=colors.accent,fontWeight=FontWeight.ExtraBold)
     rows.forEach{s->Text("${s.field} · ${s.crop} · ${tonnes(s.harvested)}",fontSize=12.sp,fontWeight=FontWeight.Bold)
      Text("Költség ${huf(s.figures.cost)} · Árbevétel ${huf(s.figures.realizedRevenue)}",fontSize=12.sp)
      Text("Realizált ${huf(s.figures.realizedResult)} · Becsült ${huf(s.figures.projectedResult)}",fontSize=12.sp,color=colors.accent)}}
   }
   if(current.isEmpty())Card(colors){Text("Erre az évre még nincs rögzített pénzügyi adat.",fontSize=12.sp)}
   TextButton(onClick={revision++}){Text("Adatok frissítése",color=colors.accent)}
  }
  Card(colors){Text("Részletes eladási árak és költségek",color=colors.accent,fontWeight=FontWeight.Bold)
   Text("A részletes tételek a védett webes felületen nyithatók meg; új bejelentkezés szükséges lehet.",fontSize=12.sp)
   WebModuleOpenButton("/admin/profit",colors,label="Pénzügyi részletek megnyitása ›")
   TextButton(onClick={onNavigate("/admin/clients")}){Text("Ügyfelek szakmai nézete ›",color=colors.accent)}}
 }
}
