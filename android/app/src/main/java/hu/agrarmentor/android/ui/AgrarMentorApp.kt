package hu.agrarmentor.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.agrarmentor.android.R
import hu.agrarmentor.android.BuildConfig
import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.auth.SecureSessionStore
import hu.agrarmentor.android.auth.SessionRenewalClock
import hu.agrarmentor.android.auth.SignInResult
import hu.agrarmentor.android.auth.SupabaseAuthGateway
import hu.agrarmentor.android.data.FieldRepository
import hu.agrarmentor.android.data.FieldSummary
import hu.agrarmentor.android.data.FarmerWorkspaceRepository
import hu.agrarmentor.android.data.GeneralTaskCompletion
import hu.agrarmentor.android.data.MobileFieldDetail
import hu.agrarmentor.android.data.MobileOperation
import hu.agrarmentor.android.data.MobileTask
import hu.agrarmentor.android.model.NavigationCatalog
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.time.format.DateTimeFormatter

private val CanvasCream=Color(0xFFF7F5EE)
private val CardWhite=Color(0xFFFFFEFC)
private val DarkText=Color(0xFF1D3026)
private val MutedText=Color(0xFF6C7D72)

internal data class PortalPalette(val accent:Color,val tint:Color,val border:Color)
private fun palette(role:PortalRole)=when(role){
 PortalRole.FARMER->PortalPalette(Color(0xFF0A613C),Color(0xFFE6F3E7),Color(0xFFD7E5D8))
 PortalRole.ADVISOR->PortalPalette(Color(0xFF2366A3),Color(0xFFE7F1FA),Color(0xFFD7E4ED))
 PortalRole.SYSTEM_ADMIN->PortalPalette(Color(0xFF92313D),Color(0xFFF9E9EC),Color(0xFFE9D6D9))
}

/**
 * The approved A-design navigation in one native Android application.
 * demoMode is strictly for local UI review. Release uses Supabase Auth and
 * the verified profile (plus MFA for privileged accounts), never a role chooser.
 */
@Composable
fun AgrarMentorApp(demoMode:Boolean){
 var session by remember{mutableStateOf<AuthorizedSession?>(null)}
 val gateway=remember{SupabaseAuthGateway(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 val context=LocalContext.current
 val secureStore=remember{SecureSessionStore(context)}
 val scope=rememberCoroutineScope()
 var restoring by remember{mutableStateOf(!demoMode)}
 var reconnectWarning by remember{mutableStateOf(false)}
 LaunchedEffect(demoMode){
  if(!demoMode){
   try{
    val stored=withContext(Dispatchers.IO){secureStore.loadRefreshToken()}
    if(stored!=null){
     when(val result=gateway.refresh(stored)){
      is SignInResult.Authorized->{
       withContext(Dispatchers.IO){secureStore.saveRefreshToken(result.session.refreshToken)}
       session=result.session
      }
      is SignInResult.Failed->if(result.reauthenticationRequired){
       withContext(Dispatchers.IO){secureStore.clear()}
      }
      is SignInResult.NeedsMfa->withContext(Dispatchers.IO){secureStore.clear()}
     }
    }
   }catch(e:CancellationException){throw e}
   catch(_:Exception){/* Device without available keystore can still log in for this run. */}
   finally{restoring=false}
  }
 }
 LaunchedEffect(session?.accessToken){
  val current=session?:return@LaunchedEffect
  while(true){
   delay(SessionRenewalClock.delayMillis(current.expiresAtEpochSeconds))
   when(val result=gateway.refresh(current.refreshToken)){
    is SignInResult.Authorized->{
     if(result.session.userId!=current.userId||result.session.role!=current.role){
      withContext(Dispatchers.IO){secureStore.clear()}
      session=null
     }else{
      try{withContext(Dispatchers.IO){secureStore.saveRefreshToken(result.session.refreshToken)}}
      catch(e:CancellationException){throw e}
      catch(_:Exception){/* Keep the current session in memory if device storage is unavailable. */}
      reconnectWarning=false
      session=result.session
     }
     break
    }
    is SignInResult.NeedsMfa->{
     withContext(Dispatchers.IO){secureStore.clear()}
     session=null
     break
    }
    is SignInResult.Failed->{
     if(result.reauthenticationRequired){
      withContext(Dispatchers.IO){secureStore.clear()}
      session=null
      break
     }
     reconnectWarning=true
     delay(30_000L)
    }
   }
  }
 }
 if(restoring&&!demoMode){
  Box(Modifier.fillMaxSize().background(CanvasCream),contentAlignment=Alignment.Center){
   CircularProgressIndicator(color=Color(0xFF0A613C))
  }
  return
 }
 if(!demoMode&&session==null){
  SignInScreen(gateway,onAuthenticated={authenticated->
   scope.launch{
    try{withContext(Dispatchers.IO){secureStore.saveRefreshToken(authenticated.refreshToken)}}
    catch(e:CancellationException){throw e}
    catch(_:Exception){/* Do not prevent this run's login if Keystore is unavailable. */}
    session=authenticated
    reconnectWarning=false
   }
  })
  return
 }
 val initialRole=if(demoMode)PortalRole.FARMER else session!!.role
 key(initialRole,demoMode){
  PortalShell(initialRole,demoMode,session,reconnectWarning,onSignOut={
   val accessToken=session?.accessToken
   session=null
   scope.launch{
    withContext(Dispatchers.IO){secureStore.clear()}
    if(accessToken!=null)gateway.signOut(accessToken)
   }
  })
 }
}

@Composable
private fun PortalShell(initialRole:PortalRole,demoMode:Boolean,session:AuthorizedSession?,reconnectWarning:Boolean,onSignOut:()->Unit){
 var roleKey by rememberSaveable{mutableStateOf(initialRole.name)}
 val role=PortalRole.valueOf(roleKey)
 var route by rememberSaveable{mutableStateOf(NavigationCatalog.tabs(role).first().route)}
 val history=remember{mutableStateListOf<String>()}
 val drawerState=rememberDrawerState(initialValue=DrawerValue.Closed)
 val scope=rememberCoroutineScope()
 val colors=palette(role)

 fun navigate(to:String){
  if(to!=route){history.add(route);route=to}
  scope.launch{drawerState.close()}
 }

 BackHandler(enabled=history.isNotEmpty()&&!drawerState.isOpen){
  route=history.removeAt(history.lastIndex)
 }
 BackHandler(enabled=drawerState.isOpen){scope.launch{drawerState.close()}}

 ModalNavigationDrawer(
  drawerState=drawerState,
  gesturesEnabled=true,
   drawerContent={RoleDrawer(role,route,colors,onNavigate=::navigate,onClose={scope.launch{drawerState.close()}},onSignOut=if(demoMode)null else onSignOut)}
 ){
  Scaffold(
   containerColor=CanvasCream,
   topBar={AppHeader(role,colors,showDemoSwitch=demoMode,onMenu={scope.launch{drawerState.open()}},onRolePreview={previewRole->
    roleKey=previewRole.name
    route=NavigationCatalog.tabs(previewRole).first().route
    history.clear()
    scope.launch{drawerState.close()}
   })},
   bottomBar={RoleBottomBar(role,route,colors,onNavigate=::navigate,onMenu={scope.launch{drawerState.open()}})}
  ){insets->
   PortalContent(role,route,colors,demoMode,session,reconnectWarning,onNavigate=::navigate,modifier=Modifier.padding(insets))
  }
 }
}

@Composable
private fun AppHeader(role:PortalRole,colors:PortalPalette,showDemoSwitch:Boolean,onMenu:()->Unit,onRolePreview:(PortalRole)->Unit){
 var chooseRole by remember{mutableStateOf(false)}
 Column(Modifier.fillMaxWidth().background(CardWhite).windowInsetsPadding(WindowInsets.statusBars)){
  Row(Modifier.fillMaxWidth().heightIn(min=64.dp).padding(horizontal=12.dp),verticalAlignment=Alignment.CenterVertically){
   androidx.compose.foundation.Image(painterResource(R.drawable.agrar_mentor_logo_on_light),"Agrár Mentor",Modifier.width(168.dp).height(55.dp),contentScale=ContentScale.Fit)
   Spacer(Modifier.weight(1f))
   if(showDemoSwitch)Box{
    TextButton(onClick={chooseRole=true},contentPadding=PaddingValues(horizontal=5.dp,vertical=3.dp)){
     Text("DEMÓ",fontSize=11.sp,color=colors.accent,fontWeight=FontWeight.Bold)
    }
    DropdownMenu(expanded=chooseRole,onDismissRequest={chooseRole=false}){
     PortalRole.entries.forEach{preview->
      DropdownMenuItem(text={Text(preview.title)},onClick={chooseRole=false;onRolePreview(preview)})
     }
    }
   }
   IconButton(onClick=onMenu){Icon(Icons.Default.Menu,contentDescription="Teljes menü",tint=colors.accent)}
  }
  HorizontalDivider(color=colors.border)
 }
}

@Composable
private fun RoleBottomBar(role:PortalRole,route:String,colors:PortalPalette,onNavigate:(String)->Unit,onMenu:()->Unit){
 val tabs=NavigationCatalog.tabs(role)
 val active=NavigationCatalog.activeTab(role,route)
 NavigationBar(containerColor=CardWhite,tonalElevation=2.dp){
  tabs.forEachIndexed{index,item->
   NavigationBarItem(
    selected=active==item.route,
    onClick={onNavigate(item.route)},
    icon={Icon(tabIcon(index,role),contentDescription=null,modifier=Modifier.size(23.dp))},
    label={Text(shortTabLabel(role,index),fontSize=10.sp,maxLines=1)},
    alwaysShowLabel=true,
    colors=NavigationBarItemDefaults.colors(selectedIconColor=colors.accent,selectedTextColor=colors.accent,indicatorColor=colors.tint,unselectedIconColor=MutedText,unselectedTextColor=MutedText)
   )
  }
  NavigationBarItem(
   selected=active==null,
   onClick=onMenu,
   icon={Icon(Icons.Default.Menu,contentDescription=null,modifier=Modifier.size(23.dp))},
   label={Text("Menü",fontSize=10.sp)},alwaysShowLabel=true,
   colors=NavigationBarItemDefaults.colors(selectedIconColor=colors.accent,selectedTextColor=colors.accent,indicatorColor=colors.tint,unselectedIconColor=MutedText,unselectedTextColor=MutedText)
  )
 }
}

private fun shortTabLabel(role:PortalRole,index:Int):String = when(role){
 PortalRole.FARMER->listOf("Főoldal","Táblák","Napló","Teendők")[index]
 PortalRole.ADVISOR->listOf("Kezdőlap","Ügyfelek","Napi munka","Térkép")[index]
 PortalRole.SYSTEM_ADMIN->listOf("Kezdőlap","Ügyek","Fiókok","Biztonság")[index]
}

private fun tabIcon(index:Int,role:PortalRole) = when(role){
 PortalRole.FARMER->listOf(Icons.Default.Home,Icons.Default.Map,Icons.Default.List,Icons.Default.CheckCircle)[index]
 PortalRole.ADVISOR->listOf(Icons.Default.Home,Icons.Default.People,Icons.Default.DateRange,Icons.Default.Map)[index]
 PortalRole.SYSTEM_ADMIN->listOf(Icons.Default.Home,Icons.Default.List,Icons.Default.People,Icons.Default.Warning)[index]
}

@Composable
private fun RoleDrawer(role:PortalRole,route:String,colors:PortalPalette,onNavigate:(String)->Unit,onClose:()->Unit,onSignOut:(()->Unit)?){
 var query by remember(role){mutableStateOf("")}
 val normalize:(String)->String={it.lowercase().normalizeForSearch()}
 val groups=NavigationCatalog.menu(role)
  .filter{normalize(it.title).contains(normalize(query.trim()))||normalize(it.group).contains(normalize(query.trim()))}
  .groupBy{it.group}

 ModalDrawerSheet(modifier=Modifier.fillMaxHeight().widthIn(max=330.dp),drawerContainerColor=CardWhite){
  Column(Modifier.fillMaxHeight()){
   Row(Modifier.fillMaxWidth().padding(start=14.dp,end=5.dp,top=16.dp,bottom=6.dp),verticalAlignment=Alignment.CenterVertically){
    androidx.compose.foundation.Image(painterResource(R.drawable.agrar_mentor_logo_on_light),"Agrár Mentor",Modifier.weight(1f).height(52.dp),contentScale=ContentScale.Fit)
    IconButton(onClick=onClose){Icon(Icons.Default.Close,"Menü bezárása",tint=DarkText)}
   }
   Text(role.title.uppercase(),Modifier.padding(horizontal=18.dp,vertical=6.dp),color=colors.accent,fontSize=12.sp,fontWeight=FontWeight.Bold)
   if(role==PortalRole.SYSTEM_ADMIN){
    Text("ADMIN MÓD · A beavatkozások naplózhatók.",Modifier.fillMaxWidth().padding(horizontal=14.dp,vertical=5.dp).background(colors.tint,RoundedCornerShape(9.dp)).padding(10.dp),fontSize=12.sp,color=colors.accent,fontWeight=FontWeight.SemiBold)
   }
   OutlinedTextField(
    value=query,onValueChange={query=it},singleLine=true,
    leadingIcon={Icon(Icons.Default.Search,null)},
    trailingIcon={if(query.isNotEmpty())IconButton(onClick={query=""}){Icon(Icons.Default.Close,"Keresés törlése")}},
    placeholder={Text("Menüpont keresése",fontSize=14.sp)},
    modifier=Modifier.fillMaxWidth().padding(horizontal=12.dp,vertical=8.dp),
    shape=RoundedCornerShape(14.dp)
   )
   LazyColumn(modifier=Modifier.weight(1f),contentPadding=PaddingValues(start=10.dp,end=10.dp,bottom=25.dp)){
    groups.forEach{(group,entries)->
     item(key="group_$group"){
      Text(group,Modifier.fillMaxWidth().padding(top=14.dp,bottom=7.dp,start=10.dp).background(colors.tint,RoundedCornerShape(9.dp)).padding(9.dp),color=colors.accent,fontWeight=FontWeight.Bold,fontSize=13.sp)
     }
     items(entries,key={it.route}){destination->
      NavigationDrawerItem(
       label={Text(destination.title,fontSize=14.sp,maxLines=2)},
       selected=route==destination.route,
       onClick={onNavigate(destination.route)},
       icon={Icon(if(destination.route.contains("map")||destination.route.contains("fields"))Icons.Default.Map else Icons.Default.ChevronRight,null,modifier=Modifier.size(19.dp))},
       colors=NavigationDrawerItemDefaults.colors(selectedContainerColor=colors.tint,selectedTextColor=colors.accent,selectedIconColor=colors.accent),
       modifier=Modifier.padding(vertical=2.dp)
      )
     }
    }
    if(groups.isEmpty())item{Text("Nincs ilyen menüpont.",Modifier.padding(20.dp),color=MutedText)}
   }
   if(onSignOut!=null){
    HorizontalDivider(color=colors.border)
    TextButton(onClick=onSignOut,modifier=Modifier.fillMaxWidth().padding(10.dp)){Text("Kijelentkezés",color=colors.accent,fontWeight=FontWeight.Bold)}
   }
  }
 }
}

private fun String.normalizeForSearch()=java.text.Normalizer.normalize(this,java.text.Normalizer.Form.NFD).replace(Regex("[\\u0300-\\u036f]"),"")

@Composable
private fun PortalContent(role:PortalRole,route:String,colors:PortalPalette,demoMode:Boolean,session:AuthorizedSession?,reconnectWarning:Boolean,onNavigate:(String)->Unit,modifier:Modifier=Modifier){
 val title=NavigationCatalog.find(role,route)?.title ?: when {
  route.startsWith("/fields/")->"Tábla részletei"
  route.startsWith("/admin/clients/")->"Ügyféldosszié"
  else->"Részletek"
 }
 LazyColumn(modifier.fillMaxSize(),contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(13.dp)){
  item{
   Text(role.title.uppercase(),color=colors.accent,fontSize=11.sp,fontWeight=FontWeight.Bold,letterSpacing=1.4.sp)
   Text(title,color=DarkText,fontSize=28.sp,fontWeight=FontWeight.ExtraBold,lineHeight=33.sp)
   Text(if(demoMode)"Natív Android-előnézet · mintaadatok" else "Agrár Mentor mobilalkalmazás",color=MutedText,fontSize=12.sp)
  }
  if(reconnectWarning&&!demoMode)item{
   Text("A kapcsolat megszakadt. A munkamenet automatikus megújítása folyamatban van.",color=Color(0xFF985414),fontSize=13.sp)
  }
  if(!demoMode){
   if(role==PortalRole.FARMER&&route=="/dashboard"&&session!=null){
    item{FarmerDashboardScreen(session,colors,onNavigate)}
   }else if(role==PortalRole.FARMER&&route=="/fields"&&session!=null){
    item{LiveFieldsScreen(session,colors,onNavigate)}
   }else if(role==PortalRole.FARMER&&route.startsWith("/fields/")&&session!=null){
    item{LiveFieldDetailScreen(route.removePrefix("/fields/"),session,colors,onNavigate)}
   }else if(role==PortalRole.FARMER&&route=="/tasks"&&session!=null){
    item{LiveTasksScreen(session,colors)}
   }else if(role==PortalRole.FARMER&&route=="/daily-work"&&session!=null){
    item{LiveTasksScreen(session,colors,mode=TaskListMode.DUE)}
   }else if(role==PortalRole.FARMER&&route=="/work"&&session!=null){
    item{LiveTasksScreen(session,colors,mode=TaskListMode.MINE)}
   }else if(role==PortalRole.FARMER&&route=="/dispatch"&&session!=null){
    item{TaskDispatchScreen(session,colors,onNavigate)}
   }else if(role==PortalRole.FARMER&&route=="/operations"&&session!=null){
    item{LiveOperationsScreen(session,colors)}
   }else if(role==PortalRole.FARMER&&route=="/notifications"&&session!=null){
    item{LiveNotificationsScreen(session,colors,onNavigate)}
   }else if(role==PortalRole.FARMER&&route=="/messages"&&session!=null){
    item{LiveMessagesScreen(session,colors)}
   }else if(role==PortalRole.FARMER&&route=="/documents"&&session!=null){
    item{LiveDocumentsScreen(session,colors)}
   }else if(role==PortalRole.FARMER&&route=="/invoices"&&session!=null){
    item{LiveDocumentsScreen(session,colors,onlyInvoices=true)}
   }else if(role==PortalRole.FARMER&&route=="/map"&&session!=null){
    item{NativeMapScreen(session,colors,onNavigate)}
   }else if(role==PortalRole.FARMER&&route=="/profile"&&session!=null){
    item{LiveProfileScreen(session,colors)}
   }else if(role==PortalRole.FARMER&&route in listOf("/farms","/team","/machines","/timeline")&&session!=null){
    item{LiveFarmExtrasScreen(route,session,colors,onNavigate)}
   }else if(role==PortalRole.ADVISOR&&route=="/admin/map"&&session!=null){
    item{NativeMapScreen(session,colors,onNavigate)}
   }else if(role==PortalRole.ADVISOR&&route.startsWith("/fields/")&&session!=null){
    item{LiveFieldDetailScreen(route.removePrefix("/fields/"),session,colors,onNavigate)}
   }else if(role==PortalRole.ADVISOR&&route in listOf("/admin/inspections","/admin/reports","/admin/visits")&&session!=null){
    item{AdvisorExtrasScreen(route,session,colors)}
   }else if(role==PortalRole.ADVISOR&&route=="/admin/operations"&&session!=null){
    item{LiveOperationsScreen(session,colors)}
   }else if(role==PortalRole.ADVISOR&&route=="/admin/documents"&&session!=null){
    item{LiveDocumentsScreen(session,colors)}
   }else if(role==PortalRole.ADVISOR&&route in listOf("/admin/timeline","/admin/machines")&&session!=null){
    item{LiveFarmExtrasScreen(if(route=="/admin/timeline")"/timeline" else "/machines",session,colors,onNavigate)}
   }else if(role==PortalRole.ADVISOR&&route in listOf("/admin","/admin/clients","/admin/tasks","/admin/daily-work")&&session!=null){
    item{AdvisorWorkspaceScreen(route,session,colors,onNavigate)}
   }else if(role==PortalRole.SYSTEM_ADMIN&&route in listOf("/system-admin","/system-admin/support","/system-admin/users","/system-admin/security")&&session!=null){
    item{AdminWorkspaceScreen(route,session,colors,onNavigate)}
   }else{
    item{GenericScreen(title,role,colors)}
   }
  }
  else when {
   route=="/dashboard"||route=="/admin"||route=="/system-admin" -> {
    item{RoleDashboard(role,colors,onNavigate)}
   }
   route=="/fields" -> item{FieldsOverview(colors,onNavigate)}
   route=="/tasks"||route=="/admin/tasks" -> item{TaskOverview(colors)}
   route=="/operations"||route=="/admin/operations" -> item{OperationsOverview(colors)}
   route=="/admin/clients"->item{SimpleList("Ügyfelek",listOf("Agrár Mentor demógazdaság","Nagrét gazdaság","Homoki gazdaság"),colors)}
   route=="/system-admin/support"->item{SimpleList("Támogatási ügyek",listOf("Feladatállapot ellenőrzése","Fiók hozzáférésének vizsgálata","Felhasználói bejelentések"),colors)}
   else -> item{GenericScreen(title,role,colors)}
  }
  item{Spacer(Modifier.height(12.dp))}
 }
}

private val dateFormat=DateTimeFormatter.ofPattern("yyyy. MM. dd.")
internal fun huDate(value:String?):String = if(value.isNullOrBlank())"Nincs határidő" else runCatching{
 LocalDate.parse(value.take(10)).format(dateFormat)
}.getOrDefault(value.take(10))

internal fun taskStatus(status:String):String=when(status){
 "done"->"Befejezve"
 "submitted"->"Ellenőrzésre vár"
 "in_progress"->"Folyamatban"
 "cancelled"->"Törölve"
 "open"->"Nyitott"
 else->"Folyamatban"
}

private fun operationLabel(type:String):String=when(type){
 "spraying"->"Permetezés"
 "plant_protection"->"Növényvédelem"
 "fertilizing"->"Tápanyag-utánpótlás"
 "sowing"->"Vetés"
 "soil_work"->"Talajmunka"
 "harvest"->"Betakarítás"
 "irrigation"->"Öntözés"
 "mowing"->"Kaszálás"
 else->"Egyéb művelet"
}

private enum class TaskListMode{ALL,DUE,MINE}

@Composable
private fun LiveTasksScreen(session:AuthorizedSession,colors:PortalPalette,mode:TaskListMode=TaskListMode.ALL){
 val repository=remember{FarmerWorkspaceRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 val completion=remember{GeneralTaskCompletion(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 val scope=rememberCoroutineScope()
 var tasks by remember{mutableStateOf<List<MobileTask>>(emptyList())}
 var loading by remember{mutableStateOf(true)}
 var error by remember{mutableStateOf(false)}
 var revision by remember{mutableIntStateOf(0)}
 var filter by rememberSaveable{mutableStateOf("Nyitott")}
 var selectedCompletion by remember{mutableStateOf<MobileTask?>(null)}
 var completionNote by remember{mutableStateOf("")}
 var sending by remember{mutableStateOf(false)}
 var completionMessage by remember{mutableStateOf<String?>(null)}
 LaunchedEffect(session.accessToken,revision){
  loading=true;error=false
  try{tasks=repository.tasks(session)}catch(_:Exception){error=true}
  finally{loading=false}
 }
 val today=LocalDate.now(java.time.ZoneId.of("Europe/Budapest")).toString()
 val scoped=tasks.filter{task->when(mode){
  TaskListMode.ALL->true
  TaskListMode.MINE->task.assignedTo==session.userId
  TaskListMode.DUE->task.status in listOf("open","in_progress")&&(
   (task.dueDate!=null&&task.dueDate.take(10)<=today)||task.priority in listOf("high","urgent"))
 }}
 val filtered=scoped.filter{task->when(filter){
  "Nyitott"->task.status!="done"&&task.status!="submitted"&&task.status!="cancelled"
  "Ellenőrzésre vár"->task.status=="submitted"
  "Befejezett"->task.status=="done"
  else->true
 }}
 Column(verticalArrangement=Arrangement.spacedBy(11.dp)){
  Text(when(mode){
   TaskListMode.ALL->"A gazdaság teendői. Az általános, saját feladat igazolható; a táblához kötött munkákhoz GPS-ellenőrzés kell."
   TaskListMode.MINE->"A hozzád rendelt munkák. Általános munkát innen is beküldhetsz ellenőrzésre."
   TaskListMode.DUE->"A máig esedékes és magas prioritású feladatok."
  },fontSize=13.sp,color=MutedText)
  if(completionMessage!=null)Text(completionMessage!!,fontSize=13.sp,color=colors.accent)
  if(mode!=TaskListMode.DUE){
   Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(6.dp)){
    listOf("Nyitott","Ellenőrzésre vár","Befejezett","Mind").forEach{option->
     FilterChip(selected=filter==option,onClick={filter=option},label={Text(option,fontSize=11.sp)},colors=FilterChipDefaults.filterChipColors(selectedContainerColor=colors.tint,selectedLabelColor=colors.accent))
    }
   }
  }
  if(loading)CircularProgressIndicator(color=colors.accent)
  else if(error)LoadError(colors,onRetry={revision++})
  else if(filtered.isEmpty())Text("Ebben a nézetben nincs teendő.",color=MutedText)
  else filtered.forEach{task->
   val critical=task.status!="done"&&(task.priority=="urgent"||task.priority=="high")
   val border=if(critical)Color(0xFFE2AD32)else colors.border
   Card(colors,border=border){
    Row(verticalAlignment=Alignment.CenterVertically){
     Column(Modifier.weight(1f)){
      Text(task.title,color=DarkText,fontSize=17.sp,fontWeight=FontWeight.Bold)
      Text(task.fieldName,color=MutedText,fontSize=12.sp)
     }
     Text(taskStatus(task.status),color=if(critical)Color(0xFF945E12)else colors.accent,fontSize=11.sp,fontWeight=FontWeight.Bold)
    }
    Text("Határidő: ${huDate(task.dueDate)}",color=MutedText,fontSize=12.sp)
    if(!task.description.isNullOrBlank())Text(task.description,color=DarkText,fontSize=13.sp)
    if(task.taskKind=="general"&&task.fieldId==null&&task.assignedTo==session.userId&&task.status in listOf("open","in_progress")){
     OutlinedButton(onClick={selectedCompletion=task;completionNote=""},shape=RoundedCornerShape(10.dp)){
      Text("Elvégzés beküldése ellenőrzésre",color=colors.accent)
     }
    }
   }
  }
 }
 selectedCompletion?.let{task->
  AlertDialog(
   onDismissRequest={if(!sending)selectedCompletion=null},
   title={Text("${task.title} – teljesítés igazolása")},
   text={
    Column(verticalArrangement=Arrangement.spacedBy(10.dp)){
     Text("Az általános teendőt a szerver ellenőrzésre továbbítja; a jóváhagyó később lezárhatja.",fontSize=13.sp)
     OutlinedTextField(completionNote,{completionNote=it.take(1500)},label={Text("Mit végeztél el?")},minLines=3,modifier=Modifier.fillMaxWidth())
    }
   },
   confirmButton={
    TextButton(onClick={
     sending=true
     scope.launch{
      try{
       val created=completion.submit(session,task,completionNote)
       completionMessage=if(created)"A feladat ellenőrzésre beküldve." else "A feladatot korábban már beküldték."
       selectedCompletion=null
       revision++
      }catch(_:Exception){completionMessage="A beküldés sikertelen. Ellenőrizd a feladatot és próbáld újra."}
      finally{sending=false}
     }
    },enabled=!sending&&completionNote.trim().length in 3..1500){Text(if(sending)"Beküldés…" else "Beküldöm")}
   },
   dismissButton={TextButton(onClick={selectedCompletion=null},enabled=!sending){Text("Mégsem")}}
  )
 }
}

@Composable
private fun LiveOperationsScreen(session:AuthorizedSession,colors:PortalPalette){
 val repository=remember{FarmerWorkspaceRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 var operations by remember{mutableStateOf<List<MobileOperation>>(emptyList())}
 var loading by remember{mutableStateOf(true)}
 var error by remember{mutableStateOf(false)}
 var revision by remember{mutableIntStateOf(0)}
 LaunchedEffect(session.accessToken,revision){
  loading=true;error=false
  try{operations=repository.operations(session)}catch(_:Exception){error=true}
  finally{loading=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(11.dp)){
  Text("Gazdálkodási műveletek · csak olvasási nézet",fontSize=13.sp,color=MutedText)
  if(loading)CircularProgressIndicator(color=colors.accent)
  else if(error)LoadError(colors,onRetry={revision++})
  else if(operations.isEmpty())Text("Még nincs rögzített művelet.",color=MutedText)
  else operations.forEach{op->
   Card(colors){
    Row(verticalAlignment=Alignment.CenterVertically){
     Icon(Icons.Default.DateRange,null,tint=colors.accent)
     Spacer(Modifier.width(10.dp))
     Column(Modifier.weight(1f)){
      Text(operationLabel(op.type),color=DarkText,fontSize=16.sp,fontWeight=FontWeight.Bold)
      Text("${op.fieldName} · ${huDate(op.date)}",color=MutedText,fontSize=12.sp)
     }
    }
    if(!op.product.isNullOrBlank())Text("Anyag: ${op.product}",color=DarkText,fontSize=13.sp)
    if(!op.quantity.isNullOrBlank())Text("Mennyiség: ${op.quantity}",color=MutedText,fontSize=12.sp)
    Text(when(op.approvalStatus){"pending"->"Jóváhagyásra vár";"approved"->"Jóváhagyva";else->"Bejegyezve"},color=colors.accent,fontWeight=FontWeight.Bold,fontSize=12.sp)
   }
  }
 }
}

@Composable
private fun LiveFieldDetailScreen(fieldId:String,session:AuthorizedSession,colors:PortalPalette,onNavigate:(String)->Unit){
 val repository=remember{FarmerWorkspaceRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 var detail by remember(fieldId){mutableStateOf<MobileFieldDetail?>(null)}
 var loading by remember(fieldId){mutableStateOf(true)}
 var error by remember(fieldId){mutableStateOf(false)}
 var revision by remember(fieldId){mutableIntStateOf(0)}
 LaunchedEffect(fieldId,session.accessToken,revision){
  loading=true;error=false
  try{detail=repository.field(session,fieldId)}catch(_:Exception){error=true}
  finally{loading=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  TextButton(onClick={onNavigate("/fields")}){Text("← Vissza a táblákhoz",color=colors.accent)}
  if(loading)CircularProgressIndicator(color=colors.accent)
  else if(error)LoadError(colors,onRetry={revision++})
  else detail?.let{field->
   Card(colors,background=colors.tint){
    Text(field.name,color=DarkText,fontSize=22.sp,fontWeight=FontWeight.Bold)
    Text("${field.areaHa} ha · ${field.crop}",color=DarkText)
    Text(field.farmName,color=MutedText,fontSize=12.sp)
   }
   Card(colors){
    Text("Legutóbbi szemle",color=DarkText,fontSize=17.sp,fontWeight=FontWeight.Bold)
    Text(when(field.condition){"critical"->"Kritikus";"attention"->"Figyelmet igényel";"good"->"Jó állapot";else->"Nincs szemle"},color=colors.accent,fontWeight=FontWeight.Bold)
    if(field.inspectedAt!=null)Text(huDate(field.inspectedAt),color=MutedText,fontSize=12.sp)
    if(!field.recommendation.isNullOrBlank())Text("Szaktanácsadói javaslat: ${field.recommendation}",color=DarkText,fontSize=13.sp)
   }
   Card(colors){
    Text("Teendők (${field.tasks.size})",color=DarkText,fontSize=17.sp,fontWeight=FontWeight.Bold)
    if(field.tasks.isEmpty())Text("Ehhez a táblához nincs teendő.",color=MutedText)
    else field.tasks.take(8).forEach{task->Text("• ${task.title} · ${taskStatus(task.status)}",fontSize=13.sp,color=DarkText)}
   }
   Card(colors){
    Text("Műveletek (${field.operations.size})",color=DarkText,fontSize=17.sp,fontWeight=FontWeight.Bold)
    if(field.operations.isEmpty())Text("Még nincs rögzített művelet.",color=MutedText)
    else field.operations.take(8).forEach{op->Text("• ${operationLabel(op.type)} · ${huDate(op.date)}",fontSize=13.sp,color=DarkText)}
   }
   Text("A műholdas térkép és a szerkeszthető poligonréteg bekötése még hátravan.",fontSize=12.sp,color=MutedText)
  }
 }
}

@Composable
internal fun LoadError(colors:PortalPalette,onRetry:()->Unit){
 Card(colors){
  Text("Az adatok most nem tölthetők be. Ellenőrizd az internetkapcsolatot.",color=Color(0xFFAD3340))
  OutlinedButton(onClick=onRetry){Text("Újrapróbálás",color=colors.accent)}
 }
}

@Composable
private fun RoleDashboard(role:PortalRole,colors:PortalPalette,onNavigate:(String)->Unit){
 val (headline,caption)=when(role){
  PortalRole.FARMER->"A gazdaságod egy pillantásra" to "Táblaállapotok, teendők, műveletek"
  PortalRole.ADVISOR->"Mai szakmai prioritások" to "Ügyfelek és az esedékes teendők"
  PortalRole.SYSTEM_ADMIN->"Rendszerfelügyelet" to "Folyamatok, hozzáférések és események"
 }
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  Card(colors,background=colors.accent){
   Text(headline,color=Color.White,fontSize=22.sp,fontWeight=FontWeight.Bold)
   Text(caption,color=Color.White.copy(alpha=.88f),fontSize=13.sp)
   Spacer(Modifier.height(8.dp))
   Text("Ez a képernyő egyelőre demóadatokat mutat.",color=Color.White,fontSize=11.sp)
  }
  val cards=when(role){
   PortalRole.FARMER->listOf("Táblák" to "/fields","Műveleti napló" to "/operations","Teendők" to "/tasks")
   PortalRole.ADVISOR->listOf("Ügyfelek" to "/admin/clients","Mai prioritások" to "/admin/daily-work","Térkép" to "/admin/map")
   PortalRole.SYSTEM_ADMIN->listOf("Támogatási központ" to "/system-admin/support","Felhasználók" to "/system-admin/users","Biztonsági események" to "/system-admin/security")
  }
  cards.forEach{(label,path)->
   Card(colors,onClick={onNavigate(path)}){
    Row(verticalAlignment=Alignment.CenterVertically){
     Icon(Icons.Default.ChevronRight,null,tint=colors.accent)
     Spacer(Modifier.width(9.dp))
     Text(label,fontWeight=FontWeight.Bold,color=DarkText,fontSize=17.sp)
     Spacer(Modifier.weight(1f))
     Text("Megnyitás",color=colors.accent,fontSize=12.sp)
    }
   }
  }
 }
}

@Composable
private fun FieldsOverview(colors:PortalPalette,onNavigate:(String)->Unit){
 var mapView by rememberSaveable{mutableStateOf(false)}
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  Row(Modifier.fillMaxWidth().background(colors.tint,RoundedCornerShape(13.dp)).padding(5.dp)){
   listOf(false to "Lista",true to "Térkép").forEach{(isMap,label)->
    Box(Modifier.weight(1f).background(if(mapView==isMap)colors.accent else Color.Transparent,RoundedCornerShape(9.dp)).clickable{mapView=isMap}.padding(13.dp),contentAlignment=Alignment.Center){
     Text(label,color=if(mapView==isMap)Color.White else colors.accent,fontWeight=FontWeight.Bold)
    }
   }
  }
  if(mapView){
   Card(colors){
    Text("Táblahatárok – illusztráció",fontWeight=FontWeight.Bold,color=DarkText)
    Canvas(Modifier.fillMaxWidth().height(245.dp).background(Color(0xFF5F8557),RoundedCornerShape(10.dp))){
     val w=size.width;val h=size.height
     val polygons=listOf(
      listOf(.07f to .15f,.4f to .1f,.46f to .4f,.12f to .48f),
      listOf(.5f to .15f,.91f to .22f,.86f to .63f,.5f to .48f),
      listOf(.15f to .56f,.48f to .5f,.5f to .86f,.1f to .92f),
      listOf(.54f to .55f,.92f to .68f,.88f to .94f,.55f to .9f)
     )
     polygons.forEachIndexed{index,points->
      val path=Path().apply{
       points.forEachIndexed{j,p->if(j==0)moveTo(p.first*w,p.second*h)else lineTo(p.first*w,p.second*h)}
       close()
      }
      drawPath(path,if(index==2)Color(0xFFB8A15A)else Color(0xFF467144))
      drawPath(path,Color(0xFFFFE34F),style=Stroke(width=5.dp.toPx()))
     }
    }
    Text("A valódi műholdréteg és poligonok a meglévő adatokhoz kapcsolódnak majd.",fontSize=12.sp,color=MutedText)
   }
  }else{
   FieldEntry("Déli 3. tábla","31,4 ha · Kukorica","Aktív",Color(0xFF39834D),colors,onNavigate={onNavigate("/fields/demo-1")})
   FieldEntry("Északi 1. tábla","24,8 ha · Őszi búza","Aktív",Color(0xFF39834D),colors,onNavigate={onNavigate("/fields/demo-2")})
   FieldEntry("Nagyrét 03","15,4 ha · Kukorica","Figyelmet igényel",Color(0xFFE4AE29),colors,onNavigate={onNavigate("/fields/demo-3")})
  }
 }
}

@Composable
private fun LiveFieldsScreen(session:AuthorizedSession,colors:PortalPalette,onNavigate:(String)->Unit){
 val repository=remember{FieldRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 var revision by remember{mutableIntStateOf(0)}
 var fields by remember{mutableStateOf<List<FieldSummary>>(emptyList())}
 var loading by remember{mutableStateOf(true)}
 var error by remember{mutableStateOf<String?>(null)}
 var filter by rememberSaveable{mutableStateOf("Aktív")}
 LaunchedEffect(session.accessToken,revision){
  loading=true;error=null
  try{fields=repository.load(session)}catch(_:Exception){error="A táblákat nem sikerült betölteni. Ellenőrizd a kapcsolatot és próbáld újra."}
  finally{loading=false}
 }
 val shown=fields.filter{field->when(filter){
  "Aktív"->field.isActive
  "Figyelmet igényel"->field.condition in listOf("attention","critical")
  "Nincs teendő"->field.openTasks==0
  else->true
 }}
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  Row(horizontalArrangement=Arrangement.spacedBy(8.dp),modifier=Modifier.fillMaxWidth()){
   listOf("Aktív","Összes").forEach{option->
    FilterChip(selected=filter==option,onClick={filter=option},label={Text(option)},colors=FilterChipDefaults.filterChipColors(selectedContainerColor=colors.tint,selectedLabelColor=colors.accent))
   }
  }
  Row(horizontalArrangement=Arrangement.spacedBy(8.dp),modifier=Modifier.fillMaxWidth()){
   listOf("Figyelmet igényel","Nincs teendő").forEach{option->
    FilterChip(selected=filter==option,onClick={filter=option},label={Text(option,fontSize=12.sp)},colors=FilterChipDefaults.filterChipColors(selectedContainerColor=colors.tint,selectedLabelColor=colors.accent))
   }
  }
  if(loading)CircularProgressIndicator(color=colors.accent)
  else if(error!=null){
   Text(error!!,color=Color(0xFFB1303E))
   OutlinedButton(onClick={revision++}){Text("Újrapróbálás")}
  }else if(shown.isEmpty())Text("Ebben a nézetben nincs földtábla.",color=MutedText)
  else shown.forEach{field->
   val (status,statusColor)=when{
    !field.isActive->"Inaktív" to Color.Gray
    field.condition=="critical"->"Kritikus" to Color(0xFFC9333E)
    field.condition=="attention"->"Figyelmet igényel" to Color(0xFFE4AE29)
    else->"Aktív" to Color(0xFF39834D)
   }
   Card(colors,border=statusColor,onClick={onNavigate("/fields/${field.id}")}){
    Row(verticalAlignment=Alignment.CenterVertically){
     Box(Modifier.size(53.dp).background(colors.tint,RoundedCornerShape(9.dp)),contentAlignment=Alignment.Center){Icon(Icons.Default.Map,null,tint=colors.accent)}
     Spacer(Modifier.width(11.dp))
     Column(Modifier.weight(1f)){
      Text(field.name,fontSize=16.sp,fontWeight=FontWeight.Bold,color=DarkText,maxLines=2)
      Text("${field.areaHa} ha · ${field.crop}",color=MutedText,fontSize=12.sp)
      Text(field.farmName,color=MutedText,fontSize=11.sp,maxLines=2)
      Text("$status · ${field.openTasks} nyitott teendő",color=statusColor,fontSize=11.sp,fontWeight=FontWeight.SemiBold)
     }
     Icon(Icons.Default.ChevronRight,null,tint=colors.accent)
    }
   }
  }
 }
}

@Composable
private fun FieldEntry(name:String,description:String,status:String,statusColor:Color,colors:PortalPalette,onNavigate:()->Unit){
 Card(colors,onClick=onNavigate,border=statusColor){
  Row(verticalAlignment=Alignment.CenterVertically){
   Box(Modifier.size(62.dp).background(colors.tint,RoundedCornerShape(11.dp)),contentAlignment=Alignment.Center){Icon(Icons.Default.Map,null,tint=colors.accent,modifier=Modifier.size(30.dp))}
   Spacer(Modifier.width(12.dp))
   Column(Modifier.weight(1f)){
    Text(name,fontSize=17.sp,fontWeight=FontWeight.Bold,color=DarkText)
    Text(description,color=MutedText,fontSize=12.sp)
    Text(status,color=statusColor,fontSize=12.sp,fontWeight=FontWeight.Bold)
   }
   Icon(Icons.Default.ChevronRight,null,tint=colors.accent)
  }
 }
}

@Composable
private fun TaskOverview(colors:PortalPalette){
 Column(verticalArrangement=Arrangement.spacedBy(11.dp)){
  FieldEntry("Növényvédelmi ellenőrzés","Nagyrét 03 · Ma esedékes","Kritikus",Color(0xFFCB3B43),colors,{})
  FieldEntry("Talajminta vétel","Felsőrét 02 · Holnap","Figyelmeztetés",Color(0xFFE5AC21),colors,{})
  FieldEntry("Öntözés ellenőrzés","Északi 1. · Ütemezve","Rendben",Color(0xFF39834D),colors,{})
 }
}

@Composable
private fun OperationsOverview(colors:PortalPalette){
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  SimpleList("Műveleti napló – minta",listOf("Permetezés · Nagyrét 03 · Befejezve","Talajminta · Felsőrét 02 · Befejezve","Öntözés · Déli 3. · Befejezve"),colors)
 }
}

@Composable
private fun SimpleList(title:String,entries:List<String>,colors:PortalPalette){
 Card(colors){
  Text(title,fontSize=18.sp,fontWeight=FontWeight.Bold,color=DarkText)
  Spacer(Modifier.height(8.dp))
  entries.forEach{entry->
   HorizontalDivider(color=colors.border)
   Row(Modifier.fillMaxWidth().padding(vertical=13.dp),verticalAlignment=Alignment.CenterVertically){
    Text(entry,Modifier.weight(1f),fontSize=14.sp,color=DarkText)
    Icon(Icons.Default.ChevronRight,null,tint=colors.accent)
   }
  }
 }
}

@Composable
private fun GenericScreen(title:String,role:PortalRole,colors:PortalPalette){
 Card(colors){
  Text(title,fontSize=19.sp,fontWeight=FontWeight.Bold,color=DarkText)
  Text("A ${role.title.lowercase()}i funkció Android-képernyőjének helye már szerepel a menüben.",fontSize=14.sp,color=MutedText)
  Text("A működés és az éles adatok bekötése ebben a modulban még hátravan.",fontSize=13.sp,color=colors.accent)
 }
}

@Composable
internal fun Card(colors:PortalPalette,background:Color=CardWhite,border:Color=colors.border,onClick:(()->Unit)?=null,content:@Composable ColumnScope.()->Unit){
 val base=Modifier.fillMaxWidth().border(1.dp,border,RoundedCornerShape(17.dp)).background(background,RoundedCornerShape(17.dp))
 Column(if(onClick!=null)base.clickable(onClick=onClick).padding(16.dp)else base.padding(16.dp),verticalArrangement=Arrangement.spacedBy(7.dp),content=content)
}
