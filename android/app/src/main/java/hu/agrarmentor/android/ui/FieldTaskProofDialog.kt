package hu.agrarmentor.android.ui

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.CancellationSignal
import android.os.Looper
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import hu.agrarmentor.android.BuildConfig
import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.data.FieldProofInput
import hu.agrarmentor.android.data.FieldTaskCompletion
import hu.agrarmentor.android.data.GpsTaskPosition
import hu.agrarmentor.android.data.MobileTask
import hu.agrarmentor.android.data.TaskExecutionPlan
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.io.File
import java.util.UUID
import kotlin.coroutines.resume

@Composable
internal fun FieldTaskProofDialog(
 session:AuthorizedSession,task:MobileTask,repository:FieldTaskCompletion,
 onDismiss:()->Unit,onSubmitted:()->Unit
){
 val context=LocalContext.current
 val scope=rememberCoroutineScope()
 var plan by remember(task.id){mutableStateOf<TaskExecutionPlan?>(null)}
 var position by remember(task.id){mutableStateOf<GpsTaskPosition?>(null)}
 var photo by remember(task.id){mutableStateOf<Bitmap?>(null)}
 var imageBytes by remember(task.id){mutableStateOf<ByteArray?>(null)}
 var imageName by remember(task.id){mutableStateOf("")}
 var pendingCapture by remember{mutableStateOf<Pair<Uri,File>?>(null)}
 var actualDose by remember(task.id){mutableStateOf("")}
 var actualArea by remember(task.id){mutableStateOf("")}
 var actualQuantity by remember(task.id){mutableStateOf("")}
 var notes by remember(task.id){mutableStateOf("")}
 var weather by remember(task.id){mutableStateOf("")}
 var hours by remember(task.id){mutableStateOf("")}
 var hectares by remember(task.id){mutableStateOf("")}
 var busy by remember(task.id){mutableStateOf(false)}
 var error by remember(task.id){mutableStateOf<String?>(null)}
 LaunchedEffect(session.accessToken,task.id){
  try{
   plan=repository.plan(session,task).also{
    actualDose=it.plannedDose?:"";actualArea=it.plannedArea?:"";actualQuantity=it.plannedQuantity?:""
   }
  }catch(e:CancellationException){throw e}
  catch(e:Exception){error="A műveleti terv nem tölthető be. ${e.message?:"Próbáld később."}"}
 }
 val camera=rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()){success->
  val capture=pendingCapture
  pendingCapture=null
  if(capture!=null){
   try{
    if(success){
     val bytes=capture.second.readBytes()
     check(bytes.size in 1..15*1024*1024){"A fénykép üres vagy 15 MB-nál nagyobb."}
     check(bytes.size>=3&&bytes[0]==0xFF.toByte()&&bytes[1]==0xD8.toByte()){"Csak JPEG fénykép fogadható el."}
     val preview=BitmapFactory.decodeByteArray(bytes,0,bytes.size,BitmapFactory.Options().apply{inSampleSize=4})
     check(preview!=null){"A készített fénykép nem nyitható meg."}
     imageBytes=bytes;photo=preview;imageName="helyszini-foto-${System.currentTimeMillis()}.jpg"
     error=null
    }
   }catch(e:Exception){error=e.message?:"A fotó feldolgozása sikertelen."}
   finally{capture.second.delete()}
  }
 }
 fun locate(){
  busy=true;position=null;error=null
  scope.launch{
   try{position=currentGpsPosition(context)}
   catch(e:CancellationException){throw e}
   catch(e:Exception){error=e.message?:"A GPS-helyzet nem érhető el."}
   finally{busy=false}
  }
 }
 val permission=rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()){grants->
  if(grants[Manifest.permission.ACCESS_FINE_LOCATION]==true)locate()
  else error="A pontos GPS-helymeghatározást engedélyezni kell a feladat igazolásához."
 }
 AlertDialog(
  onDismissRequest={if(!busy)onDismiss()},
  title={Text("${task.title} – GPS-es teljesítés")},
  text={
   Column(Modifier.fillMaxWidth().heightIn(max=540.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(9.dp)){
    Text("A munkát a helyszíni GPS-mérés és fotó alapján a szaktanácsadó ellenőrizheti.")
    OutlinedButton(onClick={
     if(ContextCompat.checkSelfPermission(context,Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED)
      locate()else permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION))
    },enabled=!busy){Text(if(position==null)"1. Friss GPS-pozíció kérése"else "GPS ±${position!!.accuracyMeters.toInt()} m – újramérés")}
    if(position!=null){
     Text(if(position!!.isFresh())"Helyzet rögzítve; legfeljebb 15 percig használható."else"A helyzet pontatlan vagy lejárt. Kérj újat.")
    }
    OutlinedButton(onClick={
     try{
      val dir=File(context.cacheDir,"task-photos").apply{mkdirs()}
      val file=File(dir,"${UUID.randomUUID()}.jpg")
      val uri=FileProvider.getUriForFile(context,"${context.packageName}.files",file)
      pendingCapture=uri to file
      camera.launch(uri)
     }catch(e:Exception){error="A kamera nem indítható: ${e.message?:"ismeretlen hiba"}"}
    },enabled=!busy){Text("2. Helyszíni fénykép készítése")}
    if(photo!=null){
     Image(bitmap=photo!!.asImageBitmap(),contentDescription="Helyszíni fotó",modifier=Modifier.fillMaxWidth().height(130.dp))
     Text("Fotó kész · ${imageBytes!!.size/1024} KB")
    }
    if(plan?.productName!=null)Text("Tervezett készítmény: ${plan!!.productName}")
    if(plan?.isSpraying==true)Text("Növényvédelmi munka: a tényleges dózis kötelező; a szerver a hivatalos adatokat ellenőrzi.")
    if(plan?.operationType!=null){
     OutlinedTextField(actualDose,{actualDose=it.take(40)},label={Text("Tényleges dózis ${plan?.doseUnit?:""}")},modifier=Modifier.fillMaxWidth())
     OutlinedTextField(actualArea,{actualArea=it.take(40)},label={Text("Tényleges terület (ha)")},modifier=Modifier.fillMaxWidth())
     OutlinedTextField(actualQuantity,{actualQuantity=it.take(40)},label={Text("Tényleges mennyiség ${plan?.quantityUnit?:""}")},modifier=Modifier.fillMaxWidth())
     OutlinedTextField(weather,{weather=it.take(1000)},label={Text("Időjárás, körülmények")},modifier=Modifier.fillMaxWidth())
    }
    OutlinedTextField(notes,{notes=it.take(3000)},label={Text("Végrehajtási megjegyzés")},modifier=Modifier.fillMaxWidth(),minLines=2)
    OutlinedTextField(hours,{hours=it.take(40)},label={Text("Záró gépüzemóra (ha van)")},modifier=Modifier.fillMaxWidth())
    OutlinedTextField(hectares,{hectares=it.take(40)},label={Text("Megművelt hektár (ha van)")},modifier=Modifier.fillMaxWidth())
    if(busy)LinearProgressIndicator(Modifier.fillMaxWidth())
    if(error!=null)Text(error!!,color=MaterialTheme.colorScheme.error)
   }
  },
  confirmButton={
   TextButton(onClick={
    val fix=position?:return@TextButton
    val bytes=imageBytes?:return@TextButton
    val loadedPlan=plan?:return@TextButton
    busy=true;error=null
    scope.launch{
     try{
      val ok=repository.submit(session,FieldProofInput(task,fix,bytes,imageName,actualDose,actualArea,actualQuantity,weather,notes,hours,hectares),loadedPlan)
      if(ok)onSubmitted()
     }catch(e:CancellationException){throw e}
     catch(e:Exception){error="A beküldés nem sikerült: ${e.message?:"Ismeretlen hiba"}. A már feltöltött fotót megőriztük, újrapróbáláskor felhasználjuk."}
     finally{busy=false}
    }
   },enabled=!busy&&plan!=null&&position?.isFresh()==true&&imageBytes!=null){Text(if(busy)"Beküldés…"else"Ellenőrzésre küldöm")}
  },
  dismissButton={TextButton(onClick=onDismiss,enabled=!busy){Text("Mégsem")}}
 )
}

@SuppressLint("MissingPermission")
private suspend fun currentGpsPosition(context:Context):GpsTaskPosition=withContext(Dispatchers.Main){
 val manager=context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
 val provider=when{
  manager.isProviderEnabled(LocationManager.GPS_PROVIDER)->LocationManager.GPS_PROVIDER
  manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)->LocationManager.NETWORK_PROVIDER
  else->error("Kapcsold be a telefonon a helymeghatározást, és próbáld újra a szabadban.")
 }
 val fix=withTimeout(22_000L){suspendCancellableCoroutine<Location>{continuation->
  if(Build.VERSION.SDK_INT>=30){
   val cancellation=CancellationSignal()
   manager.getCurrentLocation(provider,cancellation,ContextCompat.getMainExecutor(context)){location->
    if(continuation.isActive){if(location==null)continuation.cancel(IllegalStateException("Nem érkezett GPS-mérés."))else continuation.resume(location)}
   }
   continuation.invokeOnCancellation{cancellation.cancel()}
  }else{
   val listener=object:LocationListener{
    override fun onLocationChanged(location:Location){
     manager.removeUpdates(this)
     if(continuation.isActive)continuation.resume(location)
    }
    override fun onProviderDisabled(name:String){
     manager.removeUpdates(this)
     if(continuation.isActive)continuation.cancel(IllegalStateException("A helymeghatározás kikapcsolt."))
    }
   }
   manager.requestSingleUpdate(provider,listener,Looper.getMainLooper())
   continuation.invokeOnCancellation{manager.removeUpdates(listener)}
  }
 }}
 GpsTaskPosition(fix.latitude,fix.longitude,fix.accuracy,fix.time).also{
  check(it.isFresh()){"Nem elég friss vagy pontos a GPS-mérés. Próbáld újra szabad ég alatt."}
 }
}
