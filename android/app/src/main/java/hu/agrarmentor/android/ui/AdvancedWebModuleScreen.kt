package hu.agrarmentor.android.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.agrarmentor.android.BuildConfig
import hu.agrarmentor.android.data.safeWebModuleUrl

/** Deliberate security boundary: high-risk server workflows stay in the web administrator UI. */
@Composable
internal fun AdvancedWebModuleScreen(route:String,colors:PortalPalette,onNavigate:(String)->Unit){
 val (title,description,related)=when(route){
  "/admin/map/import"->Triple(
   "Tömeges táblahatár-import",
   "A GeoJSON és SHP ZIP fájlokat a webes Agrár Mentor tömeges importálója ellenőrzi, előnézetben összeveti a meglévő táblákkal, majd duplikációvédelemmel menti. Androidon a térképi minőség és a beküldött határjavaslatok már ellenőrizhetők; a nagyméretű fájlimport a webes kezelőfelületen érhető el.",
   "/admin/map/quality")
  "/system-admin/weather"->Triple(
   "HungaroMet adatkapcsolat",
   "A mért időjárási adatok szinkronnaplója szerveroldali hozzáférést igényel. A kézi szinkron élő adatokat és idővonaleseményeket módosíthat, ezért csak a webes rendszeradmin-felületen futtatható. Mobilon nem használunk service_role kulcsot és nem kerülünk meg adatbázis-jogosultságot.",
   "/system-admin")
  "/system-admin/backup"->Triple(
   "Biztonsági adatmentés",
   "A teljes szakmai adatbázis exportja érzékeny rendszerművelet: a webes felületen minden letöltéshez friss authenticator-kód és ellenőrzött szerveroldali export szükséges. Az Android-app nem készít és nem tárol védelem nélküli teljes adatbázismásolatot.",
   "/system-admin")
  else->Triple("Speciális webes művelet","Ez a művelet csak a webes kezelőfelületen érhető el.","/admin")
 }
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  Card(colors){
   Text(title,color=Color(0xFF253B30),fontSize=19.sp,fontWeight=FontWeight.Bold)
   Text(description,color=Color(0xFF64766B),fontSize=14.sp)
  }
  Text("A webes felület külön bejelentkezést és szükség esetén újabb MFA-ellenőrzést kérhet. Az Android-munkamenet hitelesítő adatait nem adjuk át a böngészőnek.",color=Color(0xFF64766B),fontSize=12.sp)
  WebModuleOpenButton(route,colors)
  TextButton(onClick={onNavigate(related)}){Text("Kapcsolódó Android-nézet megnyitása ›",color=colors.accent)}
 }
}

/** Opens the separate web session, never putting the Android access token in the URL. */
@Composable
internal fun WebModuleOpenButton(path:String,colors:PortalPalette){
 val uriHandler=LocalUriHandler.current
 var openError by remember(path){mutableStateOf(false)}
 TextButton(onClick={
  openError=false
  val url=safeWebModuleUrl(BuildConfig.WEB_ORIGIN,path)
  if(url==null)openError=true
  else runCatching{uriHandler.openUri(url)}.onFailure{openError=true}
 }){Text("Megnyitás a webes Agrár Mentorban ›",color=colors.accent)}
 if(openError)Text("A biztonságos webcím nem nyitható meg. Ellenőrizd a kapcsolatot és a kiadási konfigurációt.",color=Color(0xFFC1453B),fontSize=12.sp)
}
