package hu.agrarmentor.android.ui

import android.graphics.Color as AndroidColor
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import hu.agrarmentor.android.BuildConfig
import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.data.MapFieldsRepository
import hu.agrarmentor.android.data.NativeMapField
import hu.agrarmentor.android.data.NativeMapGeoJson
import org.maplibre.android.MapLibre
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import org.maplibre.android.style.layers.CircleLayer
import org.maplibre.android.style.layers.FillLayer
import org.maplibre.android.style.layers.LineLayer
import org.maplibre.android.style.layers.PropertyFactory.*
import org.maplibre.android.style.sources.GeoJsonSource
import org.maplibre.geojson.FeatureCollection

private const val OPEN_FREE_MAP_STYLE="https://tiles.openfreemap.org/styles/liberty"

/** One native MapLibre map shared by the farmer and advisor navigation. */
@Composable
internal fun NativeMapScreen(session:AuthorizedSession,colors:PortalPalette,onNavigate:(String)->Unit){
 val repo=remember{MapFieldsRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 var fields by remember(session.userId){mutableStateOf<List<NativeMapField>>(emptyList())}
 var loading by remember{mutableStateOf(true)}
 var failed by remember{mutableStateOf(false)}
 var revision by remember{mutableIntStateOf(0)}
 var shownCount by remember(session.userId){mutableIntStateOf(100)}
 LaunchedEffect(session.accessToken,revision){
  loading=true;failed=false
  try{fields=repo.load(session)}catch(_:Exception){failed=true}
  finally{loading=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(10.dp)){
  Text("Élő földtáblahatárok, a jogosultságod szerint. Térképadatok: OpenFreeMap / OpenStreetMap.",color=Color(0xFF6C7D72),fontSize=12.sp)
  if(loading)CircularProgressIndicator(color=colors.accent)
  else if(failed)LoadError(colors,onRetry={revision++})
  else if(fields.isEmpty())Text("Nincs megjeleníthető földtábla.",color=Color(0xFF6C7D72))
  else{
   NativeFieldMap(fields)
   Text("${fields.size} földtábla · ${fields.count{it.boundary!=null}} poligonnal · ${fields.count{NativeMapGeoJson.center(it)!=null}} elhelyezve",color=colors.accent,fontSize=13.sp)
   fields.take(shownCount).forEach{field->
    Card(colors,onClick={onNavigate("/fields/${field.id}")}){
     Text(field.name,color=Color(0xFF1D3026))
     Text(field.farmName,color=Color(0xFF6C7D72),fontSize=12.sp)
     TextButton(onClick={onNavigate("/fields/${field.id}")}){Text("Adatlap");androidx.compose.material3.Icon(Icons.Default.ChevronRight,null)}
    }
   }
   if(fields.size>shownCount)TextButton(onClick={shownCount+=100}){
    Text("További földtáblák (${fields.size-shownCount} hátra)")
   }
  }
 }
}

@Composable
internal fun NativeFieldMap(fields:List<NativeMapField>){
 val context=LocalContext.current
 val owner=LocalLifecycleOwner.current
 val mapView=remember(context){
  MapLibre.getInstance(context)
  MapView(context).apply{onCreate(null)}
 }
 DisposableEffect(mapView,owner){
  var started=false
  var resumed=false
  var destroyed=false
  val observer=LifecycleEventObserver{_,event->
   when(event){
    Lifecycle.Event.ON_START->if(!started){mapView.onStart();started=true}
    Lifecycle.Event.ON_RESUME->if(!resumed){mapView.onResume();resumed=true}
    Lifecycle.Event.ON_PAUSE->if(resumed){mapView.onPause();resumed=false}
    Lifecycle.Event.ON_STOP->if(started){mapView.onStop();started=false}
    Lifecycle.Event.ON_DESTROY->if(!destroyed){mapView.onDestroy();destroyed=true}
    else->Unit
   }
  }
  owner.lifecycle.addObserver(observer)
  onDispose{
   owner.lifecycle.removeObserver(observer)
   if(resumed)mapView.onPause()
   if(started)mapView.onStop()
   if(!destroyed)mapView.onDestroy()
  }
 }
 AndroidView(factory={mapView},modifier=Modifier.fillMaxWidth().height(400.dp))
 LaunchedEffect(fields,mapView){
  val polygons=NativeMapGeoJson.polygons(fields)
  val points=NativeMapGeoJson.points(fields)
  val first=fields.firstNotNullOfOrNull{NativeMapGeoJson.center(it)}
  mapView.getMapAsync{map->
   map.setStyle(Style.Builder().fromUri(OPEN_FREE_MAP_STYLE)){style->
    style.addSource(GeoJsonSource("agrar-polygons",FeatureCollection.fromJson(polygons)))
    style.addLayer(FillLayer("agrar-fills","agrar-polygons").withProperties(
     fillColor(AndroidColor.rgb(57,131,77)),fillOpacity(0.29f)))
    style.addLayer(LineLayer("agrar-borders","agrar-polygons").withProperties(
     lineColor(AndroidColor.rgb(246,189,39)),lineWidth(3.0f)))
    style.addSource(GeoJsonSource("agrar-centers",FeatureCollection.fromJson(points)))
    style.addLayer(CircleLayer("agrar-points","agrar-centers").withProperties(
     circleColor(AndroidColor.rgb(11,98,60)),circleRadius(5.5f),circleStrokeColor(AndroidColor.WHITE),circleStrokeWidth(1.5f)))
    if(first!=null)map.moveCamera(CameraUpdateFactory.newLatLngZoom(LatLng(first.first,first.second),12.0))
   }
  }
 }
}
