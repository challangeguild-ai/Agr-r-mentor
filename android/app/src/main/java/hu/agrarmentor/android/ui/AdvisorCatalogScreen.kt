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
import hu.agrarmentor.android.data.AdvisorCatalogRepository
import hu.agrarmentor.android.data.MobileCatalogSnapshot
import kotlinx.coroutines.CancellationException

private val CatalogInk=Color(0xFF253A2E)
private val CatalogMuted=Color(0xFF6C7D72)
private val CatalogWarning=Color(0xFFC44339)

@Composable
internal fun AdvisorCatalogScreen(session:AuthorizedSession,colors:PortalPalette,onNavigate:(String)->Unit){
 val repo=remember{AdvisorCatalogRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 var snapshot by remember(session.accessToken){mutableStateOf<MobileCatalogSnapshot?>(null)}
 var busy by remember(session.accessToken){mutableStateOf(true)}
 var error by remember(session.accessToken){mutableStateOf<String?>(null)}
 var revision by remember{mutableIntStateOf(0)}
 LaunchedEffect(session.accessToken,revision){
  busy=true;error=null
  try{snapshot=repo.load(session)}
  catch(e:CancellationException){throw e}
  catch(e:Exception){error=e.message?:"A növényvédelmi katalógus nem érhető el."}
  finally{busy=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  Text("Hivatalos HU/SK katalógusadatok és a tényleges engedélyezett felhasználási lefedettség",color=CatalogMuted,fontSize=14.sp)
  if(busy)CircularProgressIndicator(color=colors.accent)
  else if(error!=null){
   Text(error!!,color=CatalogWarning,fontSize=13.sp)
   TextButton(onClick={revision++}){Text("Újrapróbálás")}
  }else snapshot?.let{data->
   data.countries.forEach{country->
    Card(colors){
     Text(if(country.code=="HU")"Magyarország · NÉBIH" else "Szlovákia · ÚKSÚP",color=CatalogInk,fontSize=18.sp,fontWeight=FontWeight.Bold)
     Text(country.sourceName?:"Hivatalos adatforrás",color=CatalogMuted,fontSize=12.sp)
     Text("Aktív készítmények: ${country.activeProducts?:"—"}",color=colors.accent,fontSize=16.sp,fontWeight=FontWeight.Bold)
     Text("Felhasználási rekordok: ${country.uses?:"nem ellenőrizhető"}",color=if(country.uses==0)CatalogWarning else CatalogInk,fontSize=14.sp,fontWeight=FontWeight.Bold)
     country.lastImported?.let{Text("Utolsó import: ${huDate(it)}",color=CatalogMuted,fontSize=12.sp)}
     Text("Forrásállapot: ${country.status?:"nem ismert"}",color=CatalogMuted,fontSize=12.sp)
     if(country.code=="SK"){
      Text("Dózist tartalmaz: ${country.dose?:"—"} · BBCH: ${country.bbch?:"—"} · Korlátozás: ${country.restrictions?:"—"}",color=CatalogMuted,fontSize=12.sp)
     }
     if(country.code=="HU"&&country.activeProducts!=null&&country.uses==0){
      Text("A készítménytörzs nem bizonyít engedélyezett kultúra–cél–dózis felhasználást. Magyar kijuttatási engedélyt és dózist ebből nem állítunk elő.",color=CatalogWarning,fontSize=13.sp)
     }
    }
   }
   Text("Legutóbbi importok",color=CatalogInk,fontSize=17.sp,fontWeight=FontWeight.Bold)
   if(data.recentImports.isEmpty())Text("Nincs elérhető importnapló.",color=CatalogMuted,fontSize=13.sp)
   data.recentImports.forEach{item->
    Card(colors){
     Text("${item.country} · ${item.source}",color=CatalogInk,fontWeight=FontWeight.Bold,fontSize=13.sp)
     Text("${item.rows} sor · ${item.uses} felhasználás · ${huDate(item.date)}",color=CatalogMuted,fontSize=12.sp)
    }
   }
   Card(colors,background=colors.tint){
    Text("Az importálás szerveroldali ellenőrzést igényel",color=CatalogInk,fontWeight=FontWeight.Bold,fontSize=14.sp)
    Text("A hivatalos CSV/XLSX szinkron és fájlfeldolgozás a webes Agrár Mentor kezelőfelületén fut. Ez a natív nézet a valóban betöltött adatokat ellenőrzi.",color=CatalogMuted,fontSize=12.sp)
   }
   TextButton(onClick={onNavigate("/admin/operations")}){Text("Műveletek megnyitása ›",color=colors.accent)}
  }
 }
}
