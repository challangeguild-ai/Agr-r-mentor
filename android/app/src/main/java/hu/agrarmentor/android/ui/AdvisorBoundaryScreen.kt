package hu.agrarmentor.android.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import hu.agrarmentor.android.data.AdvisorBoundaryRepository
import hu.agrarmentor.android.data.MobileBoundaryProposal
import hu.agrarmentor.android.data.MobileBoundaryReview
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

private val BoundaryInk=Color(0xFF263C31)
private val BoundaryMuted=Color(0xFF728176)
private val BoundaryWarn=Color(0xFFC1453B)

@Composable
internal fun AdvisorBoundaryScreen(route:String,session:AuthorizedSession,colors:PortalPalette,onNavigate:(String)->Unit){
 val repo=remember{AdvisorBoundaryRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 var queue by remember(route,session.accessToken){mutableStateOf<List<MobileBoundaryProposal>?>(null)}
 var detail by remember(route,session.accessToken){mutableStateOf<MobileBoundaryReview?>(null)}
 var busy by remember(route,session.accessToken){mutableStateOf(true)}
 var error by remember(route,session.accessToken){mutableStateOf<String?>(null)}
 var revision by remember(route){mutableIntStateOf(0)}
 val id=route.removePrefix("/admin/map/proposals/").takeIf{route.startsWith("/admin/map/proposals/")}
 LaunchedEffect(route,session.accessToken,revision){
  busy=true;error=null
  try{if(id==null)queue=repo.queue(session) else detail=repo.detail(session,id)}
  catch(e:CancellationException){throw e}
  catch(e:Exception){error=e.message?:"A táblahatár-javaslatok nem érhetők el."}
  finally{busy=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  if(id!=null)TextButton(onClick={onNavigate("/admin/map/proposals")}){Text("‹ Vissza a javaslatokhoz",color=colors.accent)}
  else Text("A gazdálkodói poligonok csak szaktanácsadói ellenőrzés után módosíthatják a térképet.",color=BoundaryMuted,fontSize=13.sp)
  if(busy)CircularProgressIndicator(color=colors.accent)
  else if(error!=null){
   Text(error!!,color=BoundaryWarn,fontSize=13.sp)
   TextButton(onClick={revision++}){Text("Újrapróbálás")}
  }else if(id==null){
   val proposals=queue.orEmpty()
   Text("Elbírálásra vár: ${proposals.size} javaslat",color=BoundaryInk,fontSize=18.sp,fontWeight=FontWeight.Bold)
   if(proposals.isEmpty())Text("Nincs ellenőrzésre váró táblahatár-javaslat.",color=BoundaryMuted,fontSize=13.sp)
   proposals.forEach{p->
    Card(colors,onClick={onNavigate("/admin/map/proposals/${p.id}")}){
     Text(p.fieldName,color=BoundaryInk,fontSize=16.sp,fontWeight=FontWeight.Bold)
     Text(p.farmName,color=BoundaryMuted,fontSize=12.sp)
     Text("${if(p.hasBoundary)"Poligon" else "Helypont"} · ${if(p.source=="external")"Külső forrás" else "Kézi jelölés"} · ${huDate(p.createdAt)}",fontSize=12.sp,color=colors.accent)
     if(p.note.isNotBlank())Text(p.note,color=BoundaryMuted,fontSize=12.sp)
     Text("Térképi ellenőrzés ›",color=colors.accent,fontWeight=FontWeight.Bold,fontSize=12.sp)
    }
   }
  }else detail?.let{review->BoundaryReviewCard(review,repo,session,colors,onNavigate)}
 }
}

@Composable
private fun BoundaryReviewCard(detail:MobileBoundaryReview,repo:AdvisorBoundaryRepository,session:AuthorizedSession,colors:PortalPalette,onNavigate:(String)->Unit){
 val p=detail.proposal
 var mapMode by remember(p.id){mutableStateOf("previous")}
 var seenPrevious by remember(p.id){mutableStateOf(false)}
 var seenProposed by remember(p.id){mutableStateOf(false)}
 var confirmed by remember(p.id){mutableStateOf(false)}
 var note by remember(p.id){mutableStateOf("")}
 var decision by remember(p.id){mutableStateOf<Boolean?>(null)}
 var saving by remember(p.id){mutableStateOf(false)}
 var error by remember(p.id){mutableStateOf<String?>(null)}
 val scope=rememberCoroutineScope()
 Text(p.fieldName,color=BoundaryInk,fontSize=20.sp,fontWeight=FontWeight.Bold)
 Text("${p.farmName} · ${if(p.hasBoundary)"Teljes poligon" else "Csak helypont"}",color=BoundaryMuted,fontSize=13.sp)
 detail.declaredAreaHa?.let{Text("Nyilvántartott terület: $it ha",color=BoundaryMuted,fontSize=12.sp)}
 if(detail.stale)Card(colors,border=BoundaryWarn){
  Text("A földtábla határa a beküldés óta megváltozott.",color=BoundaryWarn,fontSize=14.sp,fontWeight=FontWeight.Bold)
  Text("Ez a javaslat nem hagyható jóvá; utasítsd el, és kérj új beküldést.",color=BoundaryInk,fontSize=12.sp)
 }
 if(p.note.isNotBlank())Card(colors){Text("Gazda megjegyzése: ${p.note}",fontSize=13.sp,color=BoundaryInk)}
 Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
  TextButton(onClick={mapMode="previous";seenPrevious=true}){Text("Jelenlegi határ",color=if(mapMode=="previous")colors.accent else BoundaryMuted)}
  TextButton(onClick={mapMode="proposed";seenProposed=true}){Text("Javasolt határ",color=if(mapMode=="proposed")colors.accent else BoundaryMuted)}
 }
 val mapField=if(mapMode=="previous")detail.previous else detail.proposed
 if(mapField.latitude==null&&mapField.longitude==null&&mapField.boundary==null){
  Text("A jelenlegi táblához még nincs elhelyezett térképi pont vagy poligon.",color=BoundaryMuted,fontSize=12.sp)
 }else NativeFieldMap(listOf(mapField))
 Text("Térképi forrás: OpenFreeMap / OpenStreetMap. A megjelenítés nem földhivatali hitelesítés.",color=BoundaryMuted,fontSize=11.sp)
 if(!p.hasBoundary&&detail.previous.boundary!=null)Text("Figyelem: helypont jóváhagyásakor a korábbi poligon törlődik!",color=BoundaryWarn,fontSize=13.sp,fontWeight=FontWeight.Bold)
 OutlinedTextField(value=note,onValueChange={note=it.take(1000)},label={Text("Elbírálási megjegyzés")},minLines=2,modifier=Modifier.fillMaxWidth())
 Row(verticalAlignment=Alignment.CenterVertically){
  Checkbox(checked=confirmed,onCheckedChange={confirmed=it})
  Text("Összehasonlítottam a jelenlegi és a javasolt térképet.",color=BoundaryInk,fontSize=12.sp)
 }
 Text("Jelenlegi nézet: ${if(seenPrevious)"megnyitva" else "még nem nyitottad meg"} · Javasolt nézet: ${if(seenProposed)"megnyitva" else "még nem nyitottad meg"}",color=BoundaryMuted,fontSize=12.sp)
 error?.let{Text(it,color=BoundaryWarn,fontSize=12.sp)}
 Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
  Button(onClick={decision=true},enabled=!saving&&!detail.stale&&seenPrevious&&seenProposed&&confirmed,modifier=Modifier.weight(1f),colors=ButtonDefaults.buttonColors(containerColor=colors.accent)){
   Text("Jóváhagyás",fontSize=12.sp)
  }
  Button(onClick={decision=false},enabled=!saving,modifier=Modifier.weight(1f),colors=ButtonDefaults.buttonColors(containerColor=BoundaryWarn)){
   Text("Elutasítás",fontSize=12.sp)
  }
 }
 TextButton(onClick={onNavigate("/fields/${p.fieldId}")}){Text("Földtábla adatlapja",color=colors.accent)}
 decision?.let{approve->
  AlertDialog(onDismissRequest={if(!saving)decision=null},
   title={Text(if(approve)"Táblahatár lecserélése" else "Javaslat elutasítása")},
   text={Text(if(approve)"A javasolt poligon vagy helypont kerül a földtábla nyilvántartásába. Ellenőrizted az alakzatot és a szomszédos táblákat?" else "A földtábla határa változatlan marad. A gazdálkodó értesítést kap a döntésről.")},
   confirmButton={TextButton(enabled=!saving,onClick={
    scope.launch{
     saving=true;error=null
     try{
      repo.review(session,p.id,approve,seenPrevious&&seenProposed&&confirmed,note)
      decision=null
      onNavigate("/admin/map/proposals")
     }catch(e:CancellationException){throw e}
     catch(e:Exception){error=e.message?:"Az elbírálás nem sikerült.";decision=null}
     finally{saving=false}
    }
   }){Text(if(saving)"Mentés..." else "Döntés megerősítése")}},
   dismissButton={TextButton(enabled=!saving,onClick={decision=null}){Text("Mégsem")}}
  )
 }
}
