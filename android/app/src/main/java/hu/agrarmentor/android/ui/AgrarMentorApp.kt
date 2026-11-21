package hu.agrarmentor.android.ui

import androidx.activity.compose.BackHandler
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
import hu.agrarmentor.android.data.FieldRainSummary
import hu.agrarmentor.android.data.FieldWeatherRepository
import hu.agrarmentor.android.data.FarmerWorkspaceRepository
import hu.agrarmentor.android.data.FieldTaskCompletion
import hu.agrarmentor.android.data.GeneralTaskCompletion
import hu.agrarmentor.android.data.MobileFieldDetail
import hu.agrarmentor.android.data.MapFieldsRepository
import hu.agrarmentor.android.data.NativeMapField
import hu.agrarmentor.android.data.NativeMapGeoJson
import hu.agrarmentor.android.data.MobileOperation
import hu.agrarmentor.android.data.MobileTask
import hu.agrarmentor.android.data.OperationCreateRepository
import hu.agrarmentor.android.model.NavigationCatalog
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.text.NumberFormat
import java.util.Locale

private val CanvasCream=AgrarDesign.cream
private val CardWhite=Color(0xFFFFFEFC)
private val DarkText=AgrarDesign.ink
private val MutedText=AgrarDesign.subdued

internal data class PortalPalette(val accent:Color,val tint:Color,val border:Color,val drawer:Color)
private fun palette(role:PortalRole)=when(role){
 PortalRole.FARMER->PortalPalette(Color(0xFF0A613C),Color(0xFFE6F3E7),Color(0xFFD7E5D8),Color(0xFF073F2B))
 PortalRole.ADVISOR->PortalPalette(Color(0xFF2366A3),Color(0xFFE7F1FA),Color(0xFFD7E4ED),Color(0xFF153A60))
 PortalRole.SYSTEM_ADMIN->PortalPalette(Color(0xFF92313D),Color(0xFFF9E9EC),Color(0xFFE9D6D9),Color(0xFF64232F))
}

/**
 * Every new application process starts at sign-in. There are no demo users or
 * role switches: the server-verified profile selects the only permitted portal.
 */
@Composable
fun AgrarMentorApp(){
 var session by remember{mutableStateOf<AuthorizedSession?>(null)}
 val gateway=remember{SupabaseAuthGateway(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY,BuildConfig.WEB_ORIGIN)}
 val context=LocalContext.current
 val scope=rememberCoroutineScope()
 var reconnectWarning by remember{mutableStateOf(false)}
 // Remove refresh tokens left by older test versions; new launches never restore sessions.
 LaunchedEffect(Unit){withContext(Dispatchers.IO){runCatching{SecureSessionStore(context).clear()}}}
 LaunchedEffect(session?.accessToken){
  val current=session?:return@LaunchedEffect
  while(true){
   delay(SessionRenewalClock.delayMillis(current.expiresAtEpochSeconds))
   when(val result=gateway.refresh(current.refreshToken)){
    is SignInResult.Authorized->{
     if(result.session.userId!=current.userId||result.session.role!=current.role){
      session=null
     }else{
      reconnectWarning=false
      session=result.session
     }
     break
    }
    is SignInResult.NeedsMfa->{
     session=null
     break
    }
    is SignInResult.Failed->{
     if(result.reauthenticationRequired){
      session=null
      break
     }
     reconnectWarning=true
     delay(30_000L)
    }
   }
  }
 }
 if(session==null){
  SignInScreen(gateway,onAuthenticated={authenticated->
   session=authenticated
   reconnectWarning=false
  })
  return
 }
 val authenticated=session!!
 key(authenticated.userId,authenticated.role){
  PortalShell(authenticated.role,authenticated,reconnectWarning,onSignOut={
   val accessToken=authenticated.accessToken
   session=null
   reconnectWarning=false
   // Invalidate the server session; no refresh token is persisted on the device.
   scope.launch{gateway.signOut(accessToken)}
  })
 }
}

@Composable
private fun PortalShell(role:PortalRole,session:AuthorizedSession,reconnectWarning:Boolean,onSignOut:()->Unit){
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

 MaterialTheme(colorScheme=lightColorScheme(
  primary=colors.accent,onPrimary=Color.White,
  primaryContainer=colors.tint,onPrimaryContainer=colors.drawer,
  secondary=colors.accent,onSecondary=Color.White,
  secondaryContainer=colors.tint,onSecondaryContainer=colors.drawer,
  background=CanvasCream,onBackground=DarkText,
  surface=CardWhite,onSurface=DarkText,outline=colors.border
 )){
  ModalNavigationDrawer(
   drawerState=drawerState,
   gesturesEnabled=true,
   drawerContent={RoleDrawer(role,route,colors,onNavigate=::navigate,onClose={scope.launch{drawerState.close()}},onSignOut=onSignOut)}
  ){
   Scaffold(
    containerColor=CanvasCream,
    topBar={AppHeader(role,colors,onMenu={scope.launch{drawerState.open()}},onNavigate=::navigate)},
    bottomBar={RoleBottomBar(role,route,colors,onNavigate=::navigate,onMenu={scope.launch{drawerState.open()}})}
   ){insets->
    PortalContent(role,route,colors,session,reconnectWarning,onNavigate=::navigate,modifier=Modifier.padding(insets))
   }
  }
 }
}

@Composable
private fun AppHeader(role:PortalRole,colors:PortalPalette,onMenu:()->Unit,onNavigate:(String)->Unit){
 val attention=when(role){
  PortalRole.FARMER->"/notifications"
  PortalRole.ADVISOR->"/admin/reports"
  PortalRole.SYSTEM_ADMIN->"/system-admin/security"
 }
 val profile=when(role){
  PortalRole.FARMER->"/profile"
  PortalRole.ADVISOR->"/admin/profile"
  PortalRole.SYSTEM_ADMIN->"/system-admin/profile"
 }
 Column(Modifier.fillMaxWidth().background(CardWhite).windowInsetsPadding(WindowInsets.statusBars)){
  Row(Modifier.fillMaxWidth().heightIn(min=60.dp).padding(horizontal=8.dp),verticalAlignment=Alignment.CenterVertically){
   androidx.compose.foundation.Image(painterResource(R.drawable.agrar_mentor_logo_on_light),"Agrár Mentor",Modifier.widthIn(max=148.dp).height(50.dp),contentScale=ContentScale.Fit)
   Spacer(Modifier.weight(1f))
   IconButton(onClick={onNavigate(attention)}){
    Icon(if(role==PortalRole.SYSTEM_ADMIN)Icons.Default.Warning else Icons.Default.Notifications,contentDescription=when(role){
     PortalRole.FARMER->"Értesítések";PortalRole.ADVISOR->"Gazdálkodói jelzések";PortalRole.SYSTEM_ADMIN->"Biztonsági események"},tint=colors.accent)
   }
   IconButton(onClick={onNavigate(profile)}){Icon(Icons.Default.AccountCircle,contentDescription="Saját profil",tint=colors.accent)}
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
private fun RoleDrawer(role:PortalRole,route:String,colors:PortalPalette,onNavigate:(String)->Unit,onClose:()->Unit,onSignOut:()->Unit){
 var query by remember(role){mutableStateOf("")}
 val normalize:(String)->String={it.lowercase().normalizeForSearch()}
 val groups=NavigationCatalog.menu(role)
  .filter{normalize(it.title).contains(normalize(query.trim()))||normalize(it.group).contains(normalize(query.trim()))}
  .groupBy{it.group}

 ModalDrawerSheet(modifier=Modifier.fillMaxHeight().widthIn(max=330.dp),drawerContainerColor=colors.drawer){
  Column(Modifier.fillMaxHeight()){
   Row(Modifier.fillMaxWidth().padding(start=14.dp,end=5.dp,top=16.dp,bottom=6.dp),verticalAlignment=Alignment.CenterVertically){
    Box(Modifier.weight(1f).background(CardWhite,RoundedCornerShape(10.dp)).padding(horizontal=8.dp)){
     androidx.compose.foundation.Image(painterResource(R.drawable.agrar_mentor_logo_on_light),"Agrár Mentor",Modifier.fillMaxWidth().height(52.dp),contentScale=ContentScale.Fit)
    }
    IconButton(onClick=onClose){Icon(Icons.Default.Close,"Menü bezárása",tint=Color.White)}
   }
   Text(role.title.uppercase(),Modifier.padding(horizontal=18.dp,vertical=6.dp),color=AgrarDesign.gold,fontSize=12.sp,fontWeight=FontWeight.Bold)
   if(role==PortalRole.SYSTEM_ADMIN){
    Text("ADMIN MÓD · A beavatkozások naplózhatók.",Modifier.fillMaxWidth().padding(horizontal=14.dp,vertical=5.dp).background(Color.White.copy(alpha=.10f),RoundedCornerShape(9.dp)).padding(10.dp),fontSize=12.sp,color=Color.White,fontWeight=FontWeight.SemiBold)
   }
   OutlinedTextField(
    value=query,onValueChange={query=it},singleLine=true,
    leadingIcon={Icon(Icons.Default.Search,null,tint=Color.White)},
    trailingIcon={if(query.isNotEmpty())IconButton(onClick={query=""}){Icon(Icons.Default.Close,"Keresés törlése",tint=Color.White)}},
    placeholder={Text("Menüpont keresése",fontSize=14.sp,color=Color.White.copy(alpha=.75f))},
    modifier=Modifier.fillMaxWidth().padding(horizontal=12.dp,vertical=8.dp),
    shape=RoundedCornerShape(14.dp),
    colors=OutlinedTextFieldDefaults.colors(focusedTextColor=Color.White,unfocusedTextColor=Color.White,focusedBorderColor=AgrarDesign.gold,unfocusedBorderColor=Color.White.copy(alpha=.55f))
   )
   LazyColumn(modifier=Modifier.weight(1f),contentPadding=PaddingValues(start=10.dp,end=10.dp,bottom=25.dp)){
    groups.forEach{(group,entries)->
     item(key="group_$group"){
      Text(group,Modifier.fillMaxWidth().padding(top=14.dp,bottom=7.dp,start=10.dp).background(Color.White.copy(alpha=.1f),RoundedCornerShape(9.dp)).padding(9.dp),color=AgrarDesign.gold,fontWeight=FontWeight.Bold,fontSize=13.sp)
     }
     items(entries,key={it.route}){destination->
      NavigationDrawerItem(
       label={Text(destination.title,fontSize=14.sp,maxLines=2)},
       selected=route==destination.route,
       onClick={onNavigate(destination.route)},
       icon={Icon(if(destination.route.contains("map")||destination.route.contains("fields"))Icons.Default.Map else Icons.Default.ChevronRight,null,modifier=Modifier.size(19.dp))},
       colors=NavigationDrawerItemDefaults.colors(selectedContainerColor=colors.accent,selectedTextColor=Color.White,selectedIconColor=AgrarDesign.gold,unselectedTextColor=Color.White,unselectedIconColor=Color.White.copy(alpha=.85f)),
       modifier=Modifier.padding(vertical=2.dp)
      )
     }
    }
    if(groups.isEmpty())item{Text("Nincs ilyen menüpont.",Modifier.padding(20.dp),color=Color.White)}
    item{
     androidx.compose.foundation.Image(painterResource(R.drawable.agrar_fields_sunrise),contentDescription="Mezőgazdasági tájkép",modifier=Modifier.fillMaxWidth().height(92.dp).padding(top=16.dp),contentScale=ContentScale.Crop)
    }
   }
   HorizontalDivider(color=Color.White.copy(alpha=.25f))
   TextButton(onClick=onSignOut,modifier=Modifier.fillMaxWidth().padding(10.dp)){Text("Kijelentkezés",color=AgrarDesign.gold,fontWeight=FontWeight.Bold)}
  }
 }
}

private fun String.normalizeForSearch()=java.text.Normalizer.normalize(this,java.text.Normalizer.Form.NFD).replace(Regex("[\\u0300-\\u036f]"),"")

@Composable
private fun PortalContent(role:PortalRole,route:String,colors:PortalPalette,session:AuthorizedSession,reconnectWarning:Boolean,onNavigate:(String)->Unit,modifier:Modifier=Modifier){
 val title=NavigationCatalog.find(role,route)?.title ?: when {
  route=="/fields/attention"->"Figyelmet igénylő táblák"
  route.startsWith("/fields/")->"Tábla részletei"
  route.startsWith("/tasks/")->"Feladat részletei"
  route.startsWith("/operations/")||route.startsWith("/admin/operations/")->"Művelet részletei"
  route=="/admin/tasks/review"->"Ellenőrzésre váró feladatok"
  route.startsWith("/admin/tasks/")->"Feladat részletei"
  route.startsWith("/admin/clients/")->"Ügyféldosszié"
  route.startsWith("/system-admin/fields/")->"Gazdaság földtáblái"
  else->"Részletek"
 }
 LazyColumn(modifier.fillMaxSize(),contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(13.dp)){
  item{
   Text(role.title.uppercase(),color=colors.accent,fontSize=11.sp,fontWeight=FontWeight.Bold,letterSpacing=1.4.sp)
   Text(title,color=DarkText,fontSize=28.sp,fontWeight=FontWeight.ExtraBold,lineHeight=33.sp)
   HorizontalDivider(color=colors.border,modifier=Modifier.padding(top=8.dp))
  }
  if(reconnectWarning)item{
   Text("A kapcsolat megszakadt. A munkamenet automatikus megújítása folyamatban van.",color=Color(0xFF985414),fontSize=13.sp)
  }
  run{
   if(role==PortalRole.FARMER&&route=="/dashboard"&&session!=null){
    item{FarmerDashboardScreen(session,colors,onNavigate)}
   }else if(role==PortalRole.FARMER&&route=="/fields"&&session!=null){
    item{LiveFieldsScreen(session,colors,onNavigate)}
   }else if(role==PortalRole.FARMER&&route=="/fields/attention"&&session!=null){
    item{LiveFieldsScreen(session,colors,onNavigate,initialFilter="Figyelmet igényel")}
   }else if(role==PortalRole.FARMER&&route.startsWith("/fields/")&&session!=null){
    item{LiveFieldDetailScreen(route.removePrefix("/fields/").substringBefore('/'),session,colors,onNavigate)}
   }else if(role==PortalRole.FARMER&&route=="/tasks"&&session!=null){
    item{LiveTasksScreen(session,colors,onNavigate=onNavigate)}
   }else if(role==PortalRole.FARMER&&route.startsWith("/tasks/")&&session!=null){
    item{LiveTasksScreen(session,colors,onNavigate=onNavigate,selectedTaskId=route.removePrefix("/tasks/"))}
   }else if(role==PortalRole.FARMER&&route=="/daily-work"&&session!=null){
    item{LiveTasksScreen(session,colors,mode=TaskListMode.DUE,onNavigate=onNavigate)}
   }else if(role==PortalRole.FARMER&&route=="/work"&&session!=null){
    item{LiveTasksScreen(session,colors,mode=TaskListMode.MINE,onNavigate=onNavigate)}
   }else if(role==PortalRole.FARMER&&route=="/dispatch"&&session!=null){
    item{TaskDispatchScreen(session,colors,onNavigate)}
   }else if(role==PortalRole.FARMER&&route=="/operations/approvals"&&session!=null){
    item{LiveOperationApprovalsScreen(session,colors)}
   }else if(role==PortalRole.FARMER&&route=="/operations"&&session!=null){
    item{LiveOperationsScreen(session,colors,onNavigate)}
   }else if(role==PortalRole.FARMER&&route.startsWith("/operations/")&&session!=null){
    item{LiveOperationDetailScreen(route.removePrefix("/operations/"),session,colors,onNavigate)}
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
    item{LiveFieldDetailScreen(route.removePrefix("/fields/").substringBefore('/'),session,colors,onNavigate)}
   }else if(role==PortalRole.ADVISOR&&route=="/admin/reports"&&session!=null){
    item{LiveAdvisorReportsScreen(session,colors)}
   }else if(role==PortalRole.ADVISOR&&route=="/admin/profile"&&session!=null){
    item{LiveProfileScreen(session,colors)}
   }else if(role==PortalRole.ADVISOR&&route in listOf("/admin/inspections","/admin/visits")&&session!=null){
    item{AdvisorExtrasScreen(route,session,colors)}
   }else if(role==PortalRole.ADVISOR&&route=="/admin/operations"&&session!=null){
    item{LiveOperationsScreen(session,colors,onNavigate)}
   }else if(role==PortalRole.ADVISOR&&route.startsWith("/admin/operations/")&&session!=null){
    item{LiveOperationDetailScreen(route.removePrefix("/admin/operations/"),session,colors,onNavigate)}
   }else if(role==PortalRole.ADVISOR&&route=="/admin/documents"&&session!=null){
    item{LiveDocumentsScreen(session,colors)}
   }else if(role==PortalRole.ADVISOR&&route in listOf("/admin/timeline","/admin/machines")&&session!=null){
    item{LiveFarmExtrasScreen(if(route=="/admin/timeline")"/timeline" else "/machines",session,colors,onNavigate)}
   }else if(role==PortalRole.ADVISOR&&route=="/admin/contacts"&&session!=null){
    item{AdvisorContactsScreen(session,colors)}
   }else if(role==PortalRole.ADVISOR&&route=="/admin/team"&&session!=null){
    item{AdvisorTeamScreen(session,colors)}
   }else if(role==PortalRole.ADVISOR&&route=="/admin/workday"&&session!=null){
    item{AdvisorWorkdayScreen(session,colors,onNavigate)}
   }else if(role==PortalRole.ADVISOR&&route=="/admin/supervision"&&session!=null){
    item{AdvisorSupervisionScreen(session,colors)}
   }else if(role==PortalRole.ADVISOR&&route.startsWith("/admin/map/proposals")&&session!=null){
    item{AdvisorBoundaryScreen(route,session,colors,onNavigate)}
   }else if(role==PortalRole.ADVISOR&&route=="/admin/map/quality"&&session!=null){
    item{AdvisorMapQualityScreen(session,colors,onNavigate)}
   }else if(role==PortalRole.ADVISOR&&route=="/admin/plant-protection-import"&&session!=null){
    item{AdvisorCatalogScreen(session,colors,onNavigate)}
   }else if(role==PortalRole.ADVISOR&&route=="/admin/map/import"&&session!=null){
    item{AdvancedWebModuleScreen(route,colors,onNavigate)}
   }else if(role==PortalRole.ADVISOR&&(route in listOf("/admin","/admin/clients","/admin/portfolio","/admin/tasks","/admin/daily-work","/admin/priorities")||route.startsWith("/admin/tasks/"))&&session!=null){
    item{AdvisorWorkspaceScreen(route,session,colors,onNavigate)}
   }else if(role==PortalRole.ADVISOR&&route.startsWith("/admin/clients/")&&session!=null){
    item{AdvisorClientDossierScreen(route.removePrefix("/admin/clients/"),session,colors,onNavigate)}
   }else if(role==PortalRole.SYSTEM_ADMIN&&(route in listOf("/system-admin","/system-admin/support","/system-admin/users","/system-admin/security","/system-admin/farms","/system-admin/fields")||route.startsWith("/system-admin/fields/"))&&session!=null){
    item{AdminWorkspaceScreen(route,session,colors,onNavigate)}
   }else if(role==PortalRole.SYSTEM_ADMIN&&route=="/system-admin/profile"&&session!=null){
    item{LiveProfileScreen(session,colors)}
   }else if(role==PortalRole.SYSTEM_ADMIN&&route in listOf("/system-admin/weather","/system-admin/backup")&&session!=null){
    item{AdvancedWebModuleScreen(route,colors,onNavigate)}
   }else{
    item{GenericScreen(title,role,colors,onNavigate)}
   }
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
private fun LiveTasksScreen(session:AuthorizedSession,colors:PortalPalette,mode:TaskListMode=TaskListMode.ALL,onNavigate:(String)->Unit,selectedTaskId:String?=null){
 val repository=remember{FarmerWorkspaceRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 val completion=remember{GeneralTaskCompletion(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 val fieldCompletion=remember{FieldTaskCompletion(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 val scope=rememberCoroutineScope()
 var tasks by remember{mutableStateOf<List<MobileTask>>(emptyList())}
 var loading by remember{mutableStateOf(true)}
 var error by remember{mutableStateOf(false)}
 var revision by remember{mutableIntStateOf(0)}
 var filter by rememberSaveable{mutableStateOf("Nyitott")}
 var selectedCompletion by remember{mutableStateOf<MobileTask?>(null)}
 var openedTask by remember{mutableStateOf<MobileTask?>(null)}
 var selectedFieldCompletion by remember{mutableStateOf<MobileTask?>(null)}
 var completionNote by remember{mutableStateOf("")}
 var sending by remember{mutableStateOf(false)}
 var completionMessage by remember{mutableStateOf<String?>(null)}
 var search by remember(mode){mutableStateOf("")}
 var shown by remember(mode){mutableIntStateOf(40)}
 LaunchedEffect(session.accessToken,revision){
  loading=true;error=false
  try{tasks=repository.tasks(session)}
  catch(e:CancellationException){throw e}
  catch(_:Exception){error=true}
  finally{loading=false}
 }
 LaunchedEffect(selectedTaskId,tasks){
  if(selectedTaskId!=null)openedTask=tasks.firstOrNull{it.id==selectedTaskId}
 }
 val today=LocalDate.now(java.time.ZoneId.of("Europe/Budapest")).toString()
 val scoped=tasks.filter{task->when(mode){
  TaskListMode.ALL->true
  TaskListMode.MINE->task.assignedTo==session.userId
  TaskListMode.DUE->task.status in listOf("open","in_progress")&&(
   (task.dueDate!=null&&task.dueDate.take(10)<=today)||task.priority in listOf("high","urgent"))
 }}
 val filtered=scoped.filter{task->(task.title.contains(search,true)||task.fieldName.contains(search,true))&&when(filter){
  "Nyitott"->task.status!="done"&&task.status!="submitted"&&task.status!="cancelled"
  "Ellenőrzésre vár"->task.status=="submitted"
  "Befejezett"->task.status=="done"
  else->true
 }}
 Column(verticalArrangement=Arrangement.spacedBy(11.dp)){
  Text(when(mode){
   TaskListMode.ALL->"A gazdaság teendői. Saját munkád ellenőrzésre küldhető: a földtáblás feladathoz GPS és helyszíni fotó kell."
   TaskListMode.MINE->"A hozzád rendelt munkák GPS-es vagy szöveges igazolással küldhetők ellenőrzésre."
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
  OutlinedTextField(value=search,onValueChange={search=it;shown=40},label={Text("Teendő vagy földtábla keresése")},singleLine=true,modifier=Modifier.fillMaxWidth())
  if(!loading&&!error)Text("${filtered.size} találat",fontSize=12.sp,color=MutedText)
  if(!loading&&!error&&selectedTaskId!=null&&tasks.none{it.id==selectedTaskId}){
   Text("A kiválasztott feladat nem található vagy nincs hozzáférésed.",fontSize=13.sp,color=Color(0xFFB1303E))
  }
  if(loading)CircularProgressIndicator(color=colors.accent)
  else if(error)LoadError(colors,onRetry={revision++})
  else if(filtered.isEmpty())Text("Ebben a nézetben nincs teendő.",color=MutedText)
  else filtered.take(shown).forEach{task->
   val critical=task.status!="done"&&(task.priority=="urgent"||task.priority=="high")
   val border=if(critical)Color(0xFFE2AD32)else colors.border
   Card(colors,border=border,onClick={openedTask=task}){
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
    if(task.fieldId!=null&&task.assignedTo==session.userId&&task.status in listOf("open","in_progress")){
     OutlinedButton(onClick={selectedFieldCompletion=task},shape=RoundedCornerShape(10.dp)){
      Text("GPS + fotó: munka igazolása",color=colors.accent)
     }
    }
   }
  }
  if(!loading&&!error&&filtered.size>shown)TextButton(onClick={shown+=40}){Text("További teendők ›",color=colors.accent)}
 }
 openedTask?.let{task->
  AlertDialog(onDismissRequest={openedTask=null},title={Text(task.title)},text={Column(verticalArrangement=Arrangement.spacedBy(8.dp)){
   Text(task.fieldName,fontWeight=FontWeight.Bold)
   Text("Állapot: ${taskStatus(task.status)}")
   Text("Határidő: ${huDate(task.dueDate)}")
   task.description?.let{Text(it)}
   Text("A tényleges teljesítést a feladatkártya műveleti gombjával lehet beküldeni.",fontSize=12.sp,color=MutedText)
  }},confirmButton={
   Row(horizontalArrangement=Arrangement.spacedBy(6.dp)){
    if(task.fieldId!=null)TextButton(onClick={openedTask=null;onNavigate("/fields/${task.fieldId}")}){Text("Földtábla")}
    TextButton(onClick={openedTask=null}){Text("Bezárás")}
   }
  })
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
 selectedFieldCompletion?.let{task->
  FieldTaskProofDialog(session,task,fieldCompletion,onDismiss={selectedFieldCompletion=null},onSubmitted={
   selectedFieldCompletion=null
   completionMessage="A munkát GPS-szel és fotóval ellenőrzésre küldtük."
   revision++
  })
 }
}

@Composable
private fun LiveOperationsScreen(session:AuthorizedSession,colors:PortalPalette,onNavigate:(String)->Unit){
 val repository=remember{FarmerWorkspaceRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 val createRepository=remember{OperationCreateRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 var operations by remember{mutableStateOf<List<MobileOperation>>(emptyList())}
 var loading by remember{mutableStateOf(true)}
 var error by remember{mutableStateOf(false)}
 var revision by remember{mutableIntStateOf(0)}
 var showCreate by remember{mutableStateOf(false)}
 var notice by remember{mutableStateOf<String?>(null)}
 var search by remember{mutableStateOf("")}
 var shown by remember{mutableIntStateOf(40)}
 LaunchedEffect(session.accessToken,revision){
  loading=true;error=false
  try{operations=repository.operations(session)}
  catch(e:CancellationException){throw e}
  catch(_:Exception){error=true}
  finally{loading=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(11.dp)){
  Text("Gazdálkodási műveletek és jóváhagyási állapotok",fontSize=13.sp,color=MutedText)
  if(notice!=null)Text(notice!!,fontSize=13.sp,color=colors.accent)
  if(session.role==PortalRole.FARMER){
   Button(onClick={showCreate=true},enabled=!loading,colors=ButtonDefaults.buttonColors(containerColor=colors.accent)){
    Text("Új művelet rögzítése")
   }
  }
  OutlinedTextField(value=search,onValueChange={search=it;shown=40},label={Text("Művelet vagy földtábla keresése")},singleLine=true,modifier=Modifier.fillMaxWidth())
  val filtered=operations.filter{it.fieldName.contains(search,true)||operationLabel(it.type).contains(search,true)||it.product?.contains(search,true)==true}
  if(!loading&&!error)Text("${filtered.size} találat",fontSize=12.sp,color=MutedText)
  if(loading)CircularProgressIndicator(color=colors.accent)
  else if(error)LoadError(colors,onRetry={revision++})
  else if(filtered.isEmpty())Text(if(operations.isEmpty())"Még nincs rögzített művelet." else "Nincs a keresésnek megfelelő művelet.",color=MutedText)
  else filtered.take(shown).forEach{op->
   Card(colors,onClick={onNavigate(if(session.role==PortalRole.ADVISOR)"/admin/operations/${op.id}" else "/operations/${op.id}")}){
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
    Row(verticalAlignment=Alignment.CenterVertically){
     Text(when(op.approvalStatus){"pending"->"Jóváhagyásra vár";"approved"->"Jóváhagyva";else->"Bejegyezve"},color=colors.accent,fontWeight=FontWeight.Bold,fontSize=12.sp,modifier=Modifier.weight(1f))
     Icon(Icons.Default.ChevronRight,contentDescription="Művelet megnyitása",tint=colors.accent)
    }
   }
  }
  if(!loading&&!error&&filtered.size>shown)TextButton(onClick={shown+=40}){Text("További műveletek ›",color=colors.accent)}
 }
 if(showCreate&&session.role==PortalRole.FARMER){
  OperationCreateDialog(session,colors,createRepository,onDismiss={showCreate=false},onSaved={warning->
   notice=warning?:"A művelet sikeresen bekerült a naplóba."
   showCreate=false;revision++
  })
 }
}

@Composable
private fun LiveOperationDetailScreen(operationId:String,session:AuthorizedSession,colors:PortalPalette,onNavigate:(String)->Unit){
 val repository=remember{FarmerWorkspaceRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 var operation by remember(operationId){mutableStateOf<MobileOperation?>(null)}
 var loading by remember(operationId){mutableStateOf(true)}
 var failed by remember(operationId){mutableStateOf(false)}
 var revision by remember(operationId){mutableIntStateOf(0)}
 val back=if(session.role==PortalRole.ADVISOR)"/admin/operations" else "/operations"
 LaunchedEffect(session.accessToken,operationId,revision){
  loading=true;failed=false
  try{operation=repository.operation(session,operationId)}
  catch(e:CancellationException){throw e}
  catch(_:Exception){failed=true}
  finally{loading=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  TextButton(onClick={onNavigate(back)}){Text("← Vissza a műveleti naplóhoz",color=colors.accent)}
  if(loading)CircularProgressIndicator(color=colors.accent)
  else if(failed)LoadError(colors,onRetry={revision++})
  else if(operation==null)Card(colors){Text("Ez a művelet a jelenlegi jogosultsággal nem érhető el.",color=MutedText)}
  else operation?.let{op->
   PortalHero(operationLabel(op.type),"${op.fieldName} · ${huDate(op.date)}",colors)
   Card(colors){
    Text("Rögzített művelet",fontSize=17.sp,fontWeight=FontWeight.Bold,color=DarkText)
    Text("Földtábla: ${op.fieldName}",color=DarkText)
    Text("Dátum: ${huDate(op.date)}",color=DarkText)
    op.product?.let{Text("Anyag vagy művelet: $it",color=DarkText)}
    op.quantity?.let{Text("Mennyiség / dózis: $it",color=DarkText)}
    Text("Jóváhagyás: ${when(op.approvalStatus){"pending"->"Várakozik";"approved"->"Jóváhagyva";else->"Nem jóváhagyásköteles"}}",color=colors.accent,fontWeight=FontWeight.Bold)
   }
   if(op.fieldId.isNotBlank())PortalRouteTile("Földtábla adatlapja","A művelethez tartozó tábla megnyitása",colors){onNavigate("/fields/${op.fieldId}")}
   Text("A teljes műveleti audit és hatósági megfelelőségi részletek az elkülönített, jogosultságvédett webes felületen ellenőrizhetők.",color=MutedText,fontSize=12.sp)
   WebModuleOpenButton("/operations/${op.id}",colors)
  }
 }
}

@Composable
private fun LiveFieldDetailScreen(fieldId:String,session:AuthorizedSession,colors:PortalPalette,onNavigate:(String)->Unit){
 val repository=remember{FarmerWorkspaceRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 val mapRepository=remember{MapFieldsRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 val weatherRepository=remember{FieldWeatherRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 var detail by remember(fieldId){mutableStateOf<MobileFieldDetail?>(null)}
 var mappedField by remember(fieldId,session.userId){mutableStateOf<NativeMapField?>(null)}
 var rain by remember(fieldId,session.userId){mutableStateOf<FieldRainSummary?>(null)}
 var rainLoading by remember(fieldId){mutableStateOf(true)}
 var rainFailed by remember(fieldId){mutableStateOf(false)}
 var rainRevision by remember(fieldId){mutableIntStateOf(0)}
 var mapLoading by remember(fieldId){mutableStateOf(true)}
 var mapFailed by remember(fieldId){mutableStateOf(false)}
 var mapRevision by remember(fieldId){mutableIntStateOf(0)}
 var loading by remember(fieldId){mutableStateOf(true)}
 var error by remember(fieldId){mutableStateOf(false)}
 var revision by remember(fieldId){mutableIntStateOf(0)}
 var activeTab by rememberSaveable(fieldId){mutableStateOf("Áttekintés")}
 LaunchedEffect(fieldId,session.accessToken,revision){
  loading=true;error=false
  try{detail=repository.field(session,fieldId)}
  catch(e:CancellationException){throw e}
  catch(_:Exception){error=true}
  finally{loading=false}
 }
 LaunchedEffect(fieldId,session.accessToken,mapRevision){
  mapLoading=true;mapFailed=false;mappedField=null
  try{mappedField=mapRepository.loadOne(session,fieldId)}
  catch(e:CancellationException){throw e}
  catch(_:Exception){mapFailed=true}
  finally{mapLoading=false}
 }
 LaunchedEffect(fieldId,session.accessToken,rainRevision){
  rainLoading=true;rainFailed=false;rain=null
  try{rain=weatherRepository.load(session,fieldId)}
  catch(e:CancellationException){throw e}
  catch(_:Exception){rainFailed=true}
  finally{rainLoading=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  TextButton(onClick={onNavigate(NavigationCatalog.fieldDetailBackRoute(session.role))}){
   Text(if(session.role==PortalRole.ADVISOR)"← Vissza a térképhez" else "← Vissza a táblákhoz",color=colors.accent)
  }
  if(loading)CircularProgressIndicator(color=colors.accent)
  else if(error)LoadError(colors,onRetry={revision++})
  else detail?.let{field->
   PortalHero(field.name,"${field.areaHa} ha · ${field.crop} · ${field.farmName}",colors)
   Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(7.dp)){
    listOf("Áttekintés","Teendők","Műveletek","Időjárás","Térkép").forEach{tab->
     FilterChip(selected=activeTab==tab,onClick={activeTab=tab},label={Text(tab)},colors=FilterChipDefaults.filterChipColors(selectedContainerColor=colors.tint,selectedLabelColor=colors.accent))
    }
   }
   if(activeTab=="Áttekintés"){
   Card(colors){
    Text("Tábla adatai",color=DarkText,fontSize=17.sp,fontWeight=FontWeight.Bold)
    Text("Állapot: ${when(field.status){"inactive"->"Inaktív";"archived"->"Archivált";else->"Aktív"}}",color=DarkText,fontSize=13.sp)
    field.settlement?.let{Text("Település: $it",color=DarkText,fontSize=13.sp)}
    field.parcelNumber?.let{Text("Helyrajzi szám: $it",color=DarkText,fontSize=13.sp)}
    field.meparBlockId?.let{Text("MePAR blokk: $it",color=DarkText,fontSize=13.sp)}
    field.cropYear?.let{Text("Gazdasági év: $it",color=DarkText,fontSize=13.sp)}
    field.sowingDate?.let{Text("Vetés: ${huDate(it)}",color=DarkText,fontSize=13.sp)}
    field.notes?.let{Text("Megjegyzés: $it",color=DarkText,fontSize=13.sp)}
   }
   Card(colors){
    Text("Legutóbbi szemle",color=DarkText,fontSize=17.sp,fontWeight=FontWeight.Bold)
    Text(when(field.condition){"critical"->"Kritikus";"attention"->"Figyelmet igényel";"good"->"Jó állapot";else->"Nincs szemle"},color=colors.accent,fontWeight=FontWeight.Bold)
    if(field.inspectedAt!=null)Text(huDate(field.inspectedAt),color=MutedText,fontSize=12.sp)
    if(!field.recommendation.isNullOrBlank())Text("Szaktanácsadói javaslat: ${field.recommendation}",color=DarkText,fontSize=13.sp)
   }
   }
   if(activeTab=="Teendők"){
   Card(colors){
    Text("Teendők (${field.tasks.size})",color=DarkText,fontSize=17.sp,fontWeight=FontWeight.Bold)
    if(field.tasks.isEmpty())Text("Ehhez a táblához nincs teendő.",color=MutedText)
    else field.tasks.take(20).forEach{task->PortalRouteTile(task.title,"${taskStatus(task.status)} · ${huDate(task.dueDate)}",colors){onNavigate(if(session.role==PortalRole.ADVISOR)"/admin/tasks" else "/tasks")}}
   }
   }
   if(activeTab=="Műveletek"){
   Card(colors){
    Text("Műveletek (${field.operations.size})",color=DarkText,fontSize=17.sp,fontWeight=FontWeight.Bold)
    if(field.operations.isEmpty())Text("Még nincs rögzített művelet.",color=MutedText)
    else field.operations.take(20).forEach{op->PortalRouteTile(operationLabel(op.type),"${huDate(op.date)} · ${op.product?:"Művelet"}",colors){onNavigate(if(session.role==PortalRole.ADVISOR)"/admin/operations/${op.id}" else "/operations/${op.id}")}}
   }
   }
   if(activeTab=="Időjárás"){
   Card(colors){
    Text("Csapadéknapló · HungaroMet",color=DarkText,fontSize=17.sp,fontWeight=FontWeight.Bold)
    if(rainLoading)CircularProgressIndicator(color=colors.accent)
    else if(rainFailed){
     Text("A csapadékmérések most nem érhetők el. A többi táblaadat megtekinthető.",color=MutedText,fontSize=12.sp)
     TextButton(onClick={rainRevision++}){Text("Mérések újrapróbálása",color=colors.accent)}
    }else rain?.let{summary->
     Text("7 nap: ${rainDisplay(summary.rain7,summary.measuredDays7)} · ${summary.rainyDays7} esős nap (${summary.measuredDays7}/7 mért)",color=DarkText,fontSize=14.sp)
     Text("30 nap: ${rainDisplay(summary.rain30,summary.measuredDays30)} · ${summary.rainyDays30} esős nap (${summary.measuredDays30}/30 mért)",color=DarkText,fontSize=14.sp)
     val last=summary.latest
     if(last==null){
      Text("Az elmúlt 30 napból nincs érvényes mérés. Az időjárási szinkron után itt jelennek meg az adatok.",color=MutedText,fontSize=12.sp)
     }else{
      Text("Legutóbbi mérés: ${huDate(last.date.toString())} · ${last.station?:last.provider}",color=colors.accent,fontSize=12.sp)
      last.distanceKm?.let{Text("Mérőállomás távolsága: ${rainNumber(it)} km",color=MutedText,fontSize=12.sp)}
      Text("Utolsó mért eső: ${summary.lastRain?.let{"${rainNumber(it.millimeters)} mm · ${huDate(it.date.toString())}"}?:"nincs eső a rendelkezésre álló mérésekben"}",color=DarkText,fontSize=12.sp)
      summary.measurements.take(5).forEach{measurement->
       Text("${huDate(measurement.date.toString())}: ${rainNumber(measurement.millimeters)} mm${if(measurement.millimeters>0)" · esős nap" else " · csapadékmentes"}",color=MutedText,fontSize=12.sp)
      }
     }
     Text("A 0 mm mért csapadékmentes nap; a hiányzó napot nem számoljuk nullának. A mérés közeli állomásról származik, nem magáról a tábláról.",color=MutedText,fontSize=12.sp)
    }
   }
   }
   if(activeTab=="Térkép"){
   Card(colors){
    Text("Földtábla a térképen",color=DarkText,fontSize=17.sp,fontWeight=FontWeight.Bold)
    if(mapLoading)CircularProgressIndicator(color=colors.accent)
    else if(mapFailed){
     Text("A térképi határ most nem tölthető be. A tábla többi adata továbbra is elérhető.",color=MutedText,fontSize=12.sp)
     TextButton(onClick={mapRevision++}){Text("Térkép újrapróbálása",color=colors.accent)}
    }else if(mappedField==null)Text("A térképi adat nem hozzáférhető.",color=MutedText,fontSize=12.sp)
    else mappedField?.let{fieldMap->
     if(NativeMapGeoJson.center(fieldMap)==null)Text("Ehhez a táblához még nincs érvényes térképi helypont vagy poligon.",color=MutedText,fontSize=12.sp)
     else{
      NativeFieldMap(listOf(fieldMap))
      Text(if(fieldMap.boundary!=null)"Rögzített poligon – csak megtekintés" else "Rögzített helypont – poligon még nincs",color=colors.accent,fontSize=12.sp)
      field.geometrySource?.let{source->Text("Rögzített forrásjelölés: ${when(source){"cadastral"->"Kataszter";"mepar"->"MePAR";"external"->"Külső adat";else->"Kézi"}} (nem hitelesítési igazolás)",color=MutedText,fontSize=12.sp)}
     }
    }
    Text("OpenFreeMap / OpenStreetMap térkép. A poligon itt nem szerkeszthető és nem hiteles földmérési adat; műholdréteg még nincs.",fontSize=12.sp,color=MutedText)
   }
   }
  }
 }
}

private fun rainNumber(value:Double):String=NumberFormat.getNumberInstance(Locale.forLanguageTag("hu-HU"))
 .apply{maximumFractionDigits=1}.format(value)

private fun rainDisplay(total:Double,days:Int)=if(days>0)"${rainNumber(total)} mm" else "Nincs mérés"

@Composable
internal fun LoadError(colors:PortalPalette,onRetry:()->Unit){
 Card(colors){
  Text("Az adatok most nem tölthetők be. Ellenőrizd az internetkapcsolatot.",color=Color(0xFFAD3340))
  OutlinedButton(onClick=onRetry){Text("Újrapróbálás",color=colors.accent)}
 }
}

@Composable
private fun LiveFieldsScreen(session:AuthorizedSession,colors:PortalPalette,onNavigate:(String)->Unit,initialFilter:String="Aktív"){
 val repository=remember{FieldRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 var revision by remember{mutableIntStateOf(0)}
 var fields by remember{mutableStateOf<List<FieldSummary>>(emptyList())}
 var loading by remember{mutableStateOf(true)}
 var error by remember{mutableStateOf<String?>(null)}
 var filter by rememberSaveable(initialFilter){mutableStateOf(initialFilter)}
 LaunchedEffect(session.accessToken,revision){
  loading=true;error=null
  try{fields=repository.load(session)}
  catch(e:CancellationException){throw e}
  catch(_:Exception){error="A táblákat nem sikerült betölteni. Ellenőrizd a kapcsolatot és próbáld újra."}
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
private fun GenericScreen(title:String,role:PortalRole,colors:PortalPalette,onNavigate:(String)->Unit){
 Card(colors){
  Text(title,fontSize=19.sp,fontWeight=FontWeight.Bold,color=DarkText)
  Text("Ez az oldal nem érhető el ezzel a szerepkörrel vagy már nem létezik.",fontSize=14.sp,color=MutedText)
  TextButton(onClick={onNavigate(NavigationCatalog.tabs(role).first().route)}){
   Text("Vissza a kezdőlapra ›",color=colors.accent)
  }
 }
}

@Composable
internal fun Card(colors:PortalPalette,background:Color=CardWhite,border:Color=colors.border,onClick:(()->Unit)?=null,content:@Composable ColumnScope.()->Unit){
 val base=Modifier.fillMaxWidth().border(1.dp,border,RoundedCornerShape(17.dp)).background(background,RoundedCornerShape(17.dp))
 Column(if(onClick!=null)base.clickable(onClick=onClick).padding(16.dp)else base.padding(16.dp),verticalArrangement=Arrangement.spacedBy(7.dp),content=content)
}
