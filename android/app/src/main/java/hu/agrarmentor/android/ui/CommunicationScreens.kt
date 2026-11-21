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
import hu.agrarmentor.android.data.DocumentDeletionRules
import hu.agrarmentor.android.data.DocumentScopes
import hu.agrarmentor.android.data.DocumentUploadInput
import hu.agrarmentor.android.data.DocumentUploadRules
import hu.agrarmentor.android.data.MobileDocument
import hu.agrarmentor.android.data.MobileMessage
import hu.agrarmentor.android.data.MobileNotification
import hu.agrarmentor.android.data.MobileProfile
import hu.agrarmentor.android.data.validMapFieldId
import hu.agrarmentor.android.data.ReportField
import hu.agrarmentor.android.data.ReportMediaInput
import hu.agrarmentor.android.data.ReportMediaRules
import hu.agrarmentor.android.model.NavigationCatalog
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.CancellationException
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
 var loadFailed by remember{mutableStateOf(false)}
 var error by remember{mutableStateOf<String?>(null)}
 var savingId by remember{mutableStateOf<String?>(null)}
 var revision by remember{mutableIntStateOf(0)}
 var shownCount by remember(session.userId){mutableIntStateOf(100)}
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
  else {
  entries.take(shownCount).forEach{notification->
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
      ?:path.takeIf{it.startsWith("/fields/")&&validMapFieldId(it.removePrefix("/fields/"))}
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
  if(entries.size>shownCount)TextButton(onClick={shownCount+=100}){Text("További értesítések")}
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
 var shownCount by remember(session.userId){mutableIntStateOf(100)}
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
  else {
  entries.take(shownCount).forEach{entry->
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
  if(entries.size>shownCount)TextButton(onClick={shownCount+=100}){Text("További bejelentések")}
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
 val repo=remember(session.userId){CommunicationRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 val context=LocalContext.current
 val scope=rememberCoroutineScope()
 var entries by remember(session.userId){mutableStateOf<List<MobileDocument>>(emptyList())}
 var loading by remember{mutableStateOf(true)}
 var error by remember{mutableStateOf<String?>(null)}
 var opening by remember{mutableStateOf<String?>(null)}
 var deleting by remember{mutableStateOf<String?>(null)}
 var deleteCandidate by remember{mutableStateOf<MobileDocument?>(null)}
 var actionError by remember{mutableStateOf<String?>(null)}
 var revision by remember{mutableIntStateOf(0)}
 var shownCount by remember(session.userId,onlyInvoices){mutableIntStateOf(100)}
 val canUpload=DocumentUploadRules.canUpload(session.role)
 var scopes by remember(session.userId){mutableStateOf(DocumentScopes(emptyList(),emptyList()))}
 var showUpload by remember{mutableStateOf(false)}
 var selectedFarm by remember{mutableStateOf<String?>(null)}
 var selectedField by remember{mutableStateOf<String?>(null)}
 var farmMenu by remember{mutableStateOf(false)}
 var fieldMenu by remember{mutableStateOf(false)}
 var uploadTitle by remember{mutableStateOf("")}
 var uploadNotes by remember{mutableStateOf("")}
 var uploadCategory by remember{mutableStateOf(if(onlyInvoices)"szamla"else"egyeb")}
 var uploadFile by remember{mutableStateOf<DocumentUploadInput?>(null)}
 var uploadBusy by remember{mutableStateOf(false)}
 var uploadError by remember{mutableStateOf<String?>(null)}
 var uploadNotice by remember{mutableStateOf<String?>(null)}
 val picker=rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) {uri->
  if(uri!=null)try{
   val resolver=context.contentResolver
   val mime=resolver.getType(uri)?:error("A fájltípus nem olvasható.")
   val data=resolver.query(uri,arrayOf(OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE),null,null,null)?.use{cursor->
    if(!cursor.moveToFirst())null else{
     val nameIndex=cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
     val sizeIndex=cursor.getColumnIndex(OpenableColumns.SIZE)
     (if(nameIndex>=0)cursor.getString(nameIndex)else"dokumentum") to
      (if(sizeIndex>=0&&!cursor.isNull(sizeIndex))cursor.getLong(sizeIndex)else null)
    }
   }
   val fileName=data?.first?:"dokumentum"
   check(fileName.length in 1..DocumentUploadRules.MAX_NAME&&DocumentUploadRules.validFile(mime,data?.second)){
    "PDF, JPG, PNG, WebP, DOC vagy DOCX fájl választható, legfeljebb 20 MB méretben."
   }
   uploadFile=DocumentUploadInput(uri,fileName,mime,data?.second)
   if(uploadTitle.isBlank())uploadTitle=fileName.take(DocumentUploadRules.MAX_TITLE)
   uploadError=null
  }catch(e:Exception){uploadError=e.message?:"A dokumentum kiválasztása sikertelen."}
 }
 LaunchedEffect(session.accessToken,revision){
  loading=true;error=null
  try{
   entries=repo.documents(session)
   if(canUpload)scopes=repo.documentScopes(session)
  }catch(_:Exception){error="A dokumentumokat nem sikerült betölteni."}
  finally{loading=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(11.dp)){
  Text(if(onlyInvoices)"A dokumentumtár számla kategóriájú iratai" else if(session.role==PortalRole.ADVISOR)"Az ügyfelek hozzáférhető dokumentumtára" else "A gazdaságod dokumentumtára",color=GrayText,fontSize=13.sp)
  if(uploadNotice!=null)Text(uploadNotice!!,color=colors.accent,fontSize=13.sp)
  if(actionError!=null)Text(actionError!!,color=Danger,fontSize=13.sp)
  if(canUpload){
   Button(onClick={
    if(!repo.hasPendingDocument()){
     selectedFarm=null;selectedField=null;uploadTitle="";uploadNotes="";uploadFile=null
     uploadCategory=if(onlyInvoices)"szamla"else"egyeb";uploadError=null
    }else uploadError="A megkezdett dokumentumfeltöltést ugyanazzal a fájllal és adatokkal folytathatod."
    showUpload=true
   },enabled=!loading&&scopes.farms.isNotEmpty(),colors=ButtonDefaults.buttonColors(containerColor=colors.accent)){
    Text("Dokumentum feltöltése")
   }
   if(!loading&&scopes.farms.isEmpty())Text("Feltöltéshez elérhető gazdaság szükséges.",color=GrayText,fontSize=12.sp)
  }
  val visible=if(onlyInvoices)entries.filter{it.category=="szamla"}else entries
  if(loading)CircularProgressIndicator(color=colors.accent)
  else if(error!=null){
   Text(error!!,color=Danger)
   OutlinedButton(onClick={revision++}){Text("Újrapróbálás")}
  }else if(visible.isEmpty())Text(if(onlyInvoices)"Még nincs feltöltött számla." else "Még nincs dokumentum.",color=GrayText)
  else {
  visible.take(shownCount).forEach{doc->
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
     opening=doc.id;actionError=null
     scope.launch{
      try{
       val url=repo.signedDocumentUrl(session,doc.storagePath)
       context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE))
      }catch(_:Exception){actionError="A dokumentum megnyitása sikertelen. Ellenőrizd a hozzáférést."}
      finally{opening=null}
     }
    },enabled=opening==null&&deleting==null,colors=ButtonDefaults.buttonColors(containerColor=colors.accent),shape=RoundedCornerShape(10.dp)){
     Text(if(opening==doc.id)"Megnyitás…" else "Dokumentum megnyitása")
    }
    if(DocumentDeletionRules.canDelete(session.role,session.userId,doc.uploadedBy)){
     OutlinedButton(onClick={deleteCandidate=doc;actionError=null},enabled=opening==null&&deleting==null){
      Text("Dokumentum törlése",color=Danger)
     }
    }
   }
  }
  if(visible.size>shownCount)TextButton(onClick={shownCount+=100}){Text("További dokumentumok")}
  }
 }
 if(deleteCandidate!=null){
  val target=deleteCandidate!!
  AlertDialog(
   onDismissRequest={if(deleting==null)deleteCandidate=null},
   title={Text("Dokumentum végleges törlése")},
   text={Text("Biztosan törlöd a(z) „${target.title}” dokumentumot és a tárolt fájlját? Ez a művelet nem vonható vissza.")},
   confirmButton={TextButton(onClick={
    deleting=target.id;actionError=null
    scope.launch{
     try{
      val result=repo.deleteDocument(session,target)
      uploadNotice=result.warning?:"A dokumentum és a fájl törlése visszaigazolva."
      deleteCandidate=null;revision++
     }catch(e:Exception){actionError=e.message?:"A dokumentum törlése nem sikerült."}
     finally{deleting=null}
    }
   },enabled=deleting==null){Text(if(deleting!=null)"Törlés…"else"Végleges törlés",color=Danger)}},
   dismissButton={TextButton(onClick={deleteCandidate=null},enabled=deleting==null){Text("Mégsem")}}
  )
 }
 if(showUpload&&canUpload){
  AlertDialog(onDismissRequest={if(!uploadBusy)showUpload=false},title={Text("Dokumentum feltöltése")},
   text={Column(Modifier.fillMaxWidth().heightIn(max=500.dp).verticalScroll(androidx.compose.foundation.rememberScrollState()),verticalArrangement=Arrangement.spacedBy(8.dp)){
    Text("PDF, JPG, PNG, WebP, DOC vagy DOCX · legfeljebb 20 MB. A dokumentum a kiválasztott, jogosult gazdasághoz kerül.",color=GrayText,fontSize=12.sp)
    Box{
     OutlinedButton(onClick={farmMenu=true},enabled=!uploadBusy){
      Text("Gazdaság: ${scopes.farms.find{it.id==selectedFarm}?.name?:"Válassz gazdaságot"}")
     }
     DropdownMenu(expanded=farmMenu,onDismissRequest={farmMenu=false}){
      scopes.farms.forEach{farm->DropdownMenuItem(text={Text(farm.name)},onClick={
       selectedFarm=farm.id;selectedField=null;farmMenu=false
      })}
     }
    }
    Box{
     OutlinedButton(onClick={fieldMenu=true},enabled=!uploadBusy&&selectedFarm!=null){
      Text("Földtábla: ${scopes.fields.find{it.id==selectedField}?.name?:"Nem kötelező"}")
     }
     DropdownMenu(expanded=fieldMenu,onDismissRequest={fieldMenu=false}){
      DropdownMenuItem(text={Text("Nincs megadva")},onClick={selectedField=null;fieldMenu=false})
      scopes.fields.filter{it.farmId==selectedFarm}.forEach{field->
       DropdownMenuItem(text={Text(field.name)},onClick={selectedField=field.id;fieldMenu=false})
      }
     }
    }
    ReportChoice("Kategória",DocumentUploadRules.categories,uploadCategory,{uploadCategory=it})
    OutlinedTextField(uploadTitle,{uploadTitle=it.take(DocumentUploadRules.MAX_TITLE)},label={Text("Megnevezés")},singleLine=true,modifier=Modifier.fillMaxWidth())
    OutlinedTextField(uploadNotes,{uploadNotes=it.take(DocumentUploadRules.MAX_NOTES)},label={Text("Megjegyzés (nem kötelező)")},modifier=Modifier.fillMaxWidth(),minLines=2)
    OutlinedButton(onClick={picker.launch(arrayOf("application/pdf","image/jpeg","image/png","image/webp","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"))},enabled=!uploadBusy){
     Text(if(uploadFile==null)"Fájl kiválasztása"else"Másik fájl választása")
    }
    if(uploadFile!=null)Text("Kiválasztva: ${uploadFile!!.fileName}",fontSize=12.sp,color=MainInk)
    if(uploadBusy)LinearProgressIndicator(Modifier.fillMaxWidth())
    if(uploadError!=null)Text(uploadError!!,color=Danger,fontSize=12.sp)
   }},
   confirmButton={TextButton(onClick={
    val farmId=selectedFarm?:return@TextButton
    val file=uploadFile?:return@TextButton
    uploadBusy=true;uploadError=null
    scope.launch{
     try{
      repo.uploadDocument(session,context.contentResolver,farmId,selectedField,uploadTitle,uploadCategory,uploadNotes,file)
      uploadNotice="A dokumentum sikeresen elmentve."
      showUpload=false;revision++
     }catch(e:Exception){uploadError="A mentés nem fejeződött be: ${e.message?:"Ismeretlen hiba"}. Ha a fájl már felkerült, ugyanazzal a dokumentummal próbáld újra."}
     finally{uploadBusy=false}
    }
   },enabled=!uploadBusy&&selectedFarm!=null&&uploadFile!=null&&DocumentUploadRules.validDetails(uploadTitle,uploadNotes,uploadCategory)){
    Text(if(uploadBusy)"Feltöltés…"else"Dokumentum mentése")
   }},
   dismissButton={TextButton(onClick={showUpload=false},enabled=!uploadBusy){Text("Mégsem")}}
  )
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
  loading=true;error=null;loadFailed=false
  try{
   val profile=repo.profile(session)
   name=profile.name;phone=profile.phone;city=profile.city;jobTitle=profile.jobTitle
  }catch(e:CancellationException){throw e}
  catch(_:Exception){loadFailed=true}
  finally{loading=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  Text("A saját profiladatod szerkeszthető. A szerepkör és a jogosultság itt nem változtatható.",color=GrayText,fontSize=13.sp)
  if(loading)CircularProgressIndicator(color=colors.accent)
  else if(loadFailed)LoadError(colors,onRetry={revision++})
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
