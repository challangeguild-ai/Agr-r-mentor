package hu.agrarmentor.android.ui

import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.agrarmentor.android.BuildConfig
import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.data.CommunicationRepository
import hu.agrarmentor.android.data.MobileDocument
import hu.agrarmentor.android.data.MobileMessage
import hu.agrarmentor.android.data.MobileNotification
import hu.agrarmentor.android.data.MobileProfile
import hu.agrarmentor.android.data.ReportField
import hu.agrarmentor.android.data.ReportMediaInput
import hu.agrarmentor.android.data.ReportMediaRules
import hu.agrarmentor.android.model.NavigationCatalog
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.launch
import java.io.File
import java.util.UUID

private val GrayText=Color(0xFF6C7D72)
private val MainInk=Color(0xFF1D3026)
private val Danger=Color(0xFFB1303E)

@Composable
internal fun LiveNotificationsScreen(session:AuthorizedSession,colors:PortalPalette,onNavigate:(String)->Unit){
 val repo=remember{CommunicationRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 var entries by remember(session.userId){mutableStateOf<List<MobileNotification>>(emptyList())}
 var loading by remember{mutableStateOf(true)}
 var error by remember{mutableStateOf<String?>(null)}
 var savingId by remember{mutableStateOf<String?>(null)}
 var revision by remember{mutableIntStateOf(0)}
 val scope=rememberCoroutineScope()
 LaunchedEffect(session.accessToken,revision){
  loading=true;error=null
  try{entries=repo.notifications(session)}catch(_:Exception){error="Az értesítések betöltése sikertelen."}
  finally{loading=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(11.dp)){
  Text("Szemlék, feladatok, válaszok és fontos események",color=GrayText,fontSize=13.sp)
  if(loading)CircularProgressIndicator(color=colors.accent)
  else if(error!=null)LoadError(colors,onRetry={revision++})
  else if(entries.isEmpty())Text("Még nincs értesítésed.",color=GrayText)
  else entries.forEach{notification->
   Card(colors,background=if(notification.readAt==null)colors.tint else Color.White){
    Row(verticalAlignment=Alignment.CenterVertically){
     Icon(Icons.Default.Notifications,null,tint=colors.accent)
     Spacer(Modifier.width(10.dp))
     Column(Modifier.weight(1f)){
      Text(notification.title,color=MainInk,fontWeight=FontWeight.Bold,fontSize=15.sp)
      Text(huDate(notification.createdAt),color=GrayText,fontSize=12.sp)
     }
     if(notification.readAt==null)Text("Új",color=colors.accent,fontSize=12.sp,fontWeight=FontWeight.Bold)
    }
    if(notification.message.isNotBlank())Text(notification.message,color=MainInk,fontSize=13.sp)
    val destination=notification.href?.substringBefore('?')?.let{path->
     path.takeIf{it in NavigationCatalog.farmer.map{entry->entry.route}}
      ?:path.takeIf{it.startsWith("/fields/")&&it.removePrefix("/fields/").matches(Regex("[a-fA-F0-9-]{36}"))}
    }
    Row(horizontalArrangement=Arrangement.spacedBy(7.dp)){
     if(notification.readAt==null)TextButton(
      onClick={
       savingId=notification.id;error=null
       scope.launch{
        try{
         repo.markNotificationRead(session,notification.id)
         entries=entries.map{if(it.id==notification.id)it.copy(readAt="olvasott")else it}
        }catch(_:Exception){error="Az értesítést nem sikerült olvasottnak jelölni."}
        finally{savingId=null}
       }
      },enabled=savingId==null
     ){Text(if(savingId==notification.id)"Mentés…" else "Olvasottnak jelölöm")}
     if(destination!=null)TextButton(onClick={onNavigate(destination)}){
      Text("Részletek");Icon(Icons.Default.ChevronRight,null)
     }
    }
   }
  }
 }
}

@Composable
internal fun LiveMessagesScreen(session:AuthorizedSession,colors:PortalPalette){
 val repo=remember{CommunicationRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 val context=LocalContext.current
 var entries by remember(session.userId){mutableStateOf<List<MobileMessage>>(emptyList())}
 var ownFields by remember(session.userId){mutableStateOf<List<ReportField>>(emptyList())}
 var expanded by remember{mutableStateOf<String?>(null)}
 var loading by remember{mutableStateOf(true)}
 var error by remember{mutableStateOf(false)}
 var notice by remember{mutableStateOf<String?>(null)}
 var composeReport by remember{mutableStateOf(false)}
 var selectedField by remember{mutableStateOf<String?>(null)}
 var choosingField by remember{mutableStateOf(false)}
 var title by remember{mutableStateOf("")}
 var message by remember{mutableStateOf("")}
 var category by remember{mutableStateOf("crop_health")}
 var severity by remember{mutableStateOf("normal")}
 var sending by remember{mutableStateOf(false)}
 var sendError by remember{mutableStateOf<String?>(null)}
 var chosenMedia by remember{mutableStateOf<List<ReportMediaInput>>(emptyList())}
 var pendingCamera by remember{mutableStateOf<Pair<Uri,File>?>(null)}
 val cameraFiles=remember{mutableStateListOf<File>()}
 var openingMedia by remember{mutableStateOf<String?>(null)}
 var revision by remember{mutableIntStateOf(0)}
 val scope=rememberCoroutineScope()
 val picker=rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(ReportMediaRules.MAX_ITEMS)){uris->
  try{
   val added=uris.map{uri->
    val resolver=context.contentResolver
    val mime=resolver.getType(uri)?:error("A fájl típusa nem olvasható.")
    val cursor=resolver.query(uri,arrayOf(OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE),null,null,null)
    val data=cursor?.use{c->if(c.moveToFirst()){
     val nameIndex=c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
     val sizeIndex=c.getColumnIndex(OpenableColumns.SIZE)
     (if(nameIndex>=0)c.getString(nameIndex)else"csatolmany") to
      (if(sizeIndex>=0&&!c.isNull(sizeIndex))c.getLong(sizeIndex)else null)
    }else null}
    val name=data?.first?.take(255)?:"csatolmany"
    val size=data?.second
    check(ReportMediaRules.valid(mime,size)){"Nem támogatott fájl vagy túl nagy csatolmány: $name"}
    ReportMediaInput(uri,name,mime,size)
   }
   val combined=(chosenMedia+added).distinctBy{it.key}
   check(combined.size<=ReportMediaRules.MAX_ITEMS){"Legfeljebb 10 csatolmány csatolható."}
   chosenMedia=combined;sendError=null
  }catch(e:Exception){sendError=e.message?:"A csatolmányok kiválasztása nem sikerült."}
 }
 val camera=rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()){ok->
  val capture=pendingCamera
  pendingCamera=null
  if(capture!=null){
   if(ok&&capture.second.length() in 1..ReportMediaRules.MAX_BYTES&&chosenMedia.size<ReportMediaRules.MAX_ITEMS){
    cameraFiles.add(capture.second)
    chosenMedia=chosenMedia+ReportMediaInput(capture.first,"helyszini-foto-${System.currentTimeMillis()}.jpg","image/jpeg",capture.second.length())
    sendError=null
   }else{
    capture.second.delete()
    if(ok)sendError="A fénykép túl nagy, vagy már 10 csatolmányt választottál."
   }
  }
 }
 LaunchedEffect(session.accessToken,revision){
  loading=true;error=false
  try{
   entries=repo.messages(session)
   ownFields=repo.reportFields(session)
  }catch(_:Exception){error=true}
  finally{loading=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(10.dp)){
  Text("A szaktanácsadónak küldött bejelentések és válaszok",color=GrayText,fontSize=13.sp)
  if(notice!=null)Text(notice!!,color=colors.accent,fontSize=13.sp)
  Button(onClick={
   if(!repo.hasPendingReport()){
    selectedField=null;title="";message="";category="crop_health";severity="normal";sendError=null;chosenMedia=emptyList()
    cameraFiles.forEach{it.delete()};cameraFiles.clear()
   }else sendError="A korábban megkezdett beküldést az eredeti adatokkal folytathatod."
   composeReport=true
  },enabled=!loading&&ownFields.isNotEmpty(),colors=ButtonDefaults.buttonColors(containerColor=colors.accent)){
   Text("Új szakmai bejelentés")
  }
  if(!loading&&ownFields.isEmpty())Text("Új bejelentést a saját gazdaságodhoz tartozó földtábláról küldhetsz.",color=GrayText,fontSize=12.sp)
  if(loading)CircularProgressIndicator(color=colors.accent)
  else if(error)LoadError(colors,onRetry={revision++})
  else if(entries.isEmpty())Text("Még nincs szakmai bejelentésed.",color=GrayText)
  else entries.forEach{entry->
   Card(colors,onClick={expanded=if(expanded==entry.id)null else entry.id}){
    Row(verticalAlignment=Alignment.CenterVertically){
     Column(Modifier.weight(1f)){
      Text(entry.title,color=MainInk,fontSize=16.sp,fontWeight=FontWeight.Bold)
      Text(huDate(entry.createdAt),color=GrayText,fontSize=12.sp)
     }
     Text(when(entry.status){"reviewed"->"Megválaszolva";"closed"->"Lezárva";else->"Válaszra vár"},color=colors.accent,fontSize=11.sp)
    }
    if(expanded==entry.id){
     HorizontalDivider(color=colors.border)
     Text("Bejelentés",fontWeight=FontWeight.Bold,color=MainInk,fontSize=13.sp)
     Text(entry.text.ifBlank{"Nincs szöveges leírás."},color=MainInk)
     if(entry.response!=null){
      Text("Szaktanácsadói válasz",fontWeight=FontWeight.Bold,color=colors.accent,fontSize=13.sp)
      Text(entry.response,color=MainInk)
     }
     entry.attachments.forEach{attachment->
      TextButton(onClick={
       openingMedia=attachment.path
       scope.launch{
        try{
         val signed=repo.signedReportAttachmentUrl(session,attachment)
         context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(signed)).addCategory(Intent.CATEGORY_BROWSABLE))
        }catch(e:Exception){notice="A csatolmány megnyitása sikertelen: ${e.message?:"Nincs hozzáférés."}"}
        finally{openingMedia=null}
       }
      },enabled=openingMedia==null){Text(if(openingMedia==attachment.path)"Megnyitás…" else "${if(attachment.mediaType=="video")"Videó"else"Fénykép"}: ${attachment.fileName}")}
     }
    }else Text("Koppints a beszélgetés megnyitásához",color=GrayText,fontSize=12.sp)
   }
  }
 }
 if(composeReport){
  val categories=listOf("crop_health" to "Növényállapot","pest" to "Kártevő","disease" to "Betegség","weed" to "Gyomosodás","water" to "Víz / aszály","weather" to "Időjárási kár","soil" to "Talajprobléma","machine" to "Gép","work" to "Munkafolyamat","other" to "Egyéb")
  AlertDialog(onDismissRequest={if(!sending)composeReport=false},title={Text("Új szakmai bejelentés")},
   text={Column(Modifier.fillMaxWidth().heightIn(max=500.dp).verticalScroll(androidx.compose.foundation.rememberScrollState()),verticalArrangement=Arrangement.spacedBy(8.dp)){
    Text("A bejelentés csak a saját földtábládhoz köthető; a szaktanácsadó értesítést kap, ha a szerver engedi.",fontSize=12.sp)
    Box{
     OutlinedButton(onClick={choosingField=true}){Text("Földtábla: ${ownFields.find{it.id==selectedField}?.name?:"Válassz táblát"}")}
     DropdownMenu(expanded=choosingField,onDismissRequest={choosingField=false}){
      ownFields.forEach{field->DropdownMenuItem(text={Text(field.name)},onClick={selectedField=field.id;choosingField=false})}
     }
    }
    ReportChoice("Kategória",categories,category,{category=it})
    ReportChoice("Súlyosság",listOf("normal" to "Normál","high" to "Fontos","urgent" to "Sürgős"),severity,{severity=it})
    OutlinedTextField(title,{title=it.take(200)},label={Text("Tárgy")},modifier=Modifier.fillMaxWidth(),singleLine=true)
    OutlinedTextField(message,{message=it.take(5000)},label={Text("Részletes leírás")},modifier=Modifier.fillMaxWidth(),minLines=3)
    Row(horizontalArrangement=Arrangement.spacedBy(6.dp)){
     OutlinedButton(onClick={picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageAndVideo))},enabled=!sending&&chosenMedia.size<ReportMediaRules.MAX_ITEMS){Text("Kép / videó")}
     OutlinedButton(onClick={
      try{
       val folder=File(context.cacheDir,"task-photos").apply{mkdirs()}
       val file=File(folder,"${UUID.randomUUID()}.jpg")
       val uri=FileProvider.getUriForFile(context,"${context.packageName}.files",file)
       pendingCamera=uri to file
       camera.launch(uri)
      }catch(e:Exception){sendError="A kamera nem indítható: ${e.message?:"ismeretlen hiba"}"}
     },enabled=!sending&&chosenMedia.size<ReportMediaRules.MAX_ITEMS){Text("Fotózás")}
    }
    Text("${chosenMedia.size}/10 csatolmány · JPG, PNG, WebP, MP4, WebM vagy MOV · legfeljebb 50 MB/fájl",fontSize=11.sp,color=GrayText)
    chosenMedia.forEach{item->
     Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){
      Text(item.fileName,Modifier.weight(1f),fontSize=11.sp,maxLines=1)
      TextButton(onClick={
       chosenMedia=chosenMedia.filterNot{it.key==item.key}
       cameraFiles.find{it.name==item.uri.lastPathSegment}?.let{file->file.delete();cameraFiles.remove(file)}
      },enabled=!sending){Text("Eltávolít")}
     }
    }
    if(sending)LinearProgressIndicator(Modifier.fillMaxWidth())
    if(sendError!=null)Text(sendError!!,color=Danger,fontSize=12.sp)
   }},
   confirmButton={TextButton(onClick={
    val fieldId=selectedField?:return@TextButton
    sending=true;sendError=null
    scope.launch{
     try{
      val result=repo.createReport(session,fieldId,title,message,category,severity,chosenMedia,context.contentResolver)
      notice=result.warning?:"A bejelentést elmentettük és továbbítottuk a szaktanácsadóknak."
      cameraFiles.forEach{it.delete()};cameraFiles.clear()
      composeReport=false;revision++
     }catch(e:Exception){sendError="A beküldés nem fejeződött be: ${e.message?:"Ismeretlen hiba"}. Ha már elment a bejelentés, ugyanazzal a tartalommal folytathatod a csatolmányok feltöltését."}
     finally{sending=false}
    }
   },enabled=!sending&&selectedField!=null&&title.trim().isNotEmpty()){
    Text(if(sending)"Küldés…"else"Bejelentés elküldése")
   }},
   dismissButton={TextButton(onClick={composeReport=false},enabled=!sending){Text("Mégsem")}}
  )
 }
}

@Composable
private fun ReportChoice(label:String,choices:List<Pair<String,String>>,value:String,onChange:(String)->Unit){
 var open by remember{mutableStateOf(false)}
 Box{
  OutlinedButton(onClick={open=true}){Text("$label: ${choices.find{it.first==value}?.second?:"—"}")}
  DropdownMenu(expanded=open,onDismissRequest={open=false}){
   choices.forEach{(key,title)->DropdownMenuItem(text={Text(title)},onClick={onChange(key);open=false})}
  }
 }
}

@Composable
internal fun LiveDocumentsScreen(session:AuthorizedSession,colors:PortalPalette,onlyInvoices:Boolean=false){
 val repo=remember{CommunicationRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 val context=LocalContext.current
 val scope=rememberCoroutineScope()
 var entries by remember(session.userId){mutableStateOf<List<MobileDocument>>(emptyList())}
 var loading by remember{mutableStateOf(true)}
 var error by remember{mutableStateOf<String?>(null)}
 var opening by remember{mutableStateOf<String?>(null)}
 var revision by remember{mutableIntStateOf(0)}
 LaunchedEffect(session.accessToken,revision){
  loading=true;error=null
  try{entries=repo.documents(session)}catch(_:Exception){error="A dokumentumokat nem sikerült betölteni."}
  finally{loading=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(11.dp)){
  Text(if(onlyInvoices)"A dokumentumtár számla kategóriájú iratai" else "A gazdaságod dokumentumtára",color=GrayText,fontSize=13.sp)
  val visible=if(onlyInvoices)entries.filter{it.category=="szamla"}else entries
  if(loading)CircularProgressIndicator(color=colors.accent)
  else if(error!=null){
   Text(error!!,color=Danger)
   OutlinedButton(onClick={revision++}){Text("Újrapróbálás")}
  }else if(visible.isEmpty())Text(if(onlyInvoices)"Még nincs feltöltött számla." else "Még nincs dokumentum.",color=GrayText)
  else visible.forEach{doc->
   Card(colors){
    Row(verticalAlignment=Alignment.CenterVertically){
     Icon(Icons.Default.Description,null,tint=colors.accent)
     Spacer(Modifier.width(10.dp))
     Column(Modifier.weight(1f)){
      Text(doc.title,color=MainInk,fontSize=16.sp,fontWeight=FontWeight.Bold)
      Text("${doc.fileName} · ${huDate(doc.createdAt)}",color=GrayText,fontSize=12.sp)
     }
    }
    if(!doc.notes.isNullOrBlank())Text(doc.notes,color=MainInk,fontSize=13.sp)
    Button(onClick={
     opening=doc.id;error=null
     scope.launch{
      try{
       val url=repo.signedDocumentUrl(session,doc.storagePath)
       context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE))
      }catch(_:Exception){error="A dokumentum megnyitása sikertelen. Ellenőrizd a hozzáférést."}
      finally{opening=null}
     }
    },enabled=opening==null,colors=ButtonDefaults.buttonColors(containerColor=colors.accent),shape=RoundedCornerShape(10.dp)){
     Text(if(opening==doc.id)"Megnyitás…" else "Dokumentum megnyitása")
    }
   }
  }
 }
}

@Composable
internal fun LiveProfileScreen(session:AuthorizedSession,colors:PortalPalette){
 val repo=remember{CommunicationRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 val scope=rememberCoroutineScope()
 var name by remember(session.userId){mutableStateOf("")}
 var phone by remember(session.userId){mutableStateOf("")}
 var city by remember(session.userId){mutableStateOf("")}
 var jobTitle by remember(session.userId){mutableStateOf("")}
 var loading by remember{mutableStateOf(true)}
 var saving by remember{mutableStateOf(false)}
 var error by remember{mutableStateOf<String?>(null)}
 var success by remember{mutableStateOf(false)}
 var revision by remember{mutableIntStateOf(0)}
 LaunchedEffect(session.userId,revision){
  loading=true;error=null
  try{
   val profile=repo.profile(session)
   name=profile.name;phone=profile.phone;city=profile.city;jobTitle=profile.jobTitle
  }catch(_:Exception){error="A profil nem tölthető be."}
  finally{loading=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  Text("A saját profiladatod szerkeszthető. A szerepkör és a jogosultság itt nem változtatható.",color=GrayText,fontSize=13.sp)
  if(loading)CircularProgressIndicator(color=colors.accent)
  else{
   Card(colors){
    OutlinedTextField(name,{name=it;success=false},label={Text("Teljes név")},singleLine=true,modifier=Modifier.fillMaxWidth())
    OutlinedTextField(phone,{phone=it;success=false},label={Text("Telefonszám")},singleLine=true,modifier=Modifier.fillMaxWidth())
    OutlinedTextField(city,{city=it;success=false},label={Text("Település")},singleLine=true,modifier=Modifier.fillMaxWidth())
    OutlinedTextField(jobTitle,{jobTitle=it;success=false},label={Text("Beosztás")},singleLine=true,modifier=Modifier.fillMaxWidth())
    if(error!=null)Text(error!!,color=Danger,fontSize=13.sp)
    if(success)Text("A profil sikeresen elmentve.",color=colors.accent,fontSize=13.sp)
    Button(onClick={
     saving=true;error=null
     scope.launch{
      try{repo.updateProfile(session,MobileProfile(name,phone,city,jobTitle));success=true}
      catch(_:Exception){error="A profil mentése sikertelen. Ellenőrizd az adatokat és a kapcsolatot."}
      finally{saving=false}
     }
    },enabled=!saving&&name.trim().length in 2..120&&phone.length<=40&&city.length<=120&&jobTitle.length<=120,colors=ButtonDefaults.buttonColors(containerColor=colors.accent)){
     Text(if(saving)"Mentés…" else "Profil mentése")
    }
   }
  }
 }
}
