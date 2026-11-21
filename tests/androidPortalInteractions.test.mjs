import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {join,dirname} from "node:path";

const root=join(dirname(fileURLToPath(import.meta.url)),"..");
const ui="android/app/src/main/java/hu/agrarmentor/android/ui";
const read=(relative)=>readFileSync(join(root,relative),"utf8");
const main=read(`${ui}/AgrarMentorApp.kt`);
const overview=read(`${ui}/FarmerDashboardScreen.kt`);
const workspace=read(`${ui}/RoleWorkspaceScreens.kt`);
const nav=read("android/app/src/main/java/hu/agrarmentor/android/model/NavigationCatalog.kt");
const theme=read(`${ui}/PortalDesign.kt`);

test("roles share the reference layout but keep green, blue and burgundy palettes",()=>{
 assert.match(main,/private fun palette\(role:PortalRole\)=when\(role\)/);
 for(const role of ["FARMER","ADVISOR","SYSTEM_ADMIN"]){
  assert.match(main,new RegExp(`PortalRole\\.${role}->PortalPalette\\(`));
 }
 assert.match(main,/0xFF0A613C/); // farmer green
 assert.match(main,/0xFF2366A3/); // advisor blue
 assert.match(main,/0xFF92313D/); // administrator burgundy
 assert.match(main,/if\(session==null\)\{\s*SignInScreen\(/);
 assert.match(main,/ModalDrawerSheet\([^\n]+drawerContainerColor=colors\.drawer/);
 assert.match(theme,/colors\.drawer\.copy/);
 assert.match(theme,/R\.drawable\.agrar_fields_sunrise/);
 assert.ok(existsSync(join(root,"android/app/src/main/res/drawable-nodpi/agrar_fields_sunrise.webp")));
 assert.match(main,/MaterialTheme\(colorScheme=lightColorScheme\(/);
 assert.match(main,/primary=colors\.accent,onPrimary=Color\.White/);
 assert.match(main,/primaryContainer=colors\.tint,onPrimaryContainer=colors\.drawer/);
});

test("reference-inspired header alerts and account buttons have real role-specific destinations",()=>{
 for(const route of ["/notifications","/admin/reports","/system-admin/security","/profile","/admin/profile","/system-admin/profile"]){
  assert.ok(main.includes(`"${route}"`),`${route} missing from routed header`);
 }
 assert.match(main,/IconButton\(onClick=\{onNavigate\(attention\)\}\)/);
 assert.match(main,/IconButton\(onClick=\{onNavigate\(profile\)\}\)/);
 assert.match(main,/role==PortalRole\.ADVISOR&&route=="\/admin\/profile"[\s\S]*?LiveProfileScreen/);
 assert.match(main,/role==PortalRole\.SYSTEM_ADMIN&&route=="\/system-admin\/profile"[\s\S]*?LiveProfileScreen/);
 assert.match(nav,/MobileDestination\("\/admin\/profile"/);
 assert.match(nav,/MobileDestination\("\/system-admin\/profile"/);
 const communication=read(`${ui}/CommunicationScreens.kt`);
 assert.match(communication,/else if\(loadFailed\)LoadError\(colors,onRetry=\{revision\+\+\}\)/);
 assert.doesNotMatch(main,/A működés és az éles adatok bekötése ebben a modulban még hátravan/);
 assert.match(main,/Vissza a kezdőlapra ›/);
});

test("farmer overview KPI and priority entries open relevant modules",()=>{
 for(const route of ["/fields","/tasks","/daily-work"]){
  assert.ok(overview.includes(`onNavigate("${route}")`),`${route} has no farmer action`);
 }
 assert.match(overview,/PortalMetric\("Összterület"/);
 assert.match(overview,/PortalMetric\("Nyitott teendő"/);
 assert.match(overview,/data\.priorityTasks\.forEach\{task->[\s\S]*?Card\(colors,onClick=/);
});

test("advisor overview metrics and relevant work cards have destinations",()=>{
 for(const route of ["/admin/clients","/admin/map","/admin/tasks","/admin/reports","/admin/inspections","/admin/visits"]){
  assert.ok(workspace.includes(`onNavigate("${route}")`)||workspace.includes(`"${route}"`),`${route} is not actionable`);
 }
 assert.match(workspace,/PortalMetric\("Nyitott gazdálkodói jelzések"/);
 assert.match(workspace,/TextButton\(onClick=\{openedTask=task\}\)/);
});

test("system admin gets native searchable farms and fields without bypassing permissions",()=>{
 for(const route of ["/system-admin/farms","/system-admin/fields"]){
  assert.ok(nav.includes(`MobileDestination("${route}"`));
  assert.ok(main.includes(`"${route}"`));
  assert.ok(workspace.includes(`"${route}"`));
 }
 assert.match(workspace,/private fun AdminInventory\(/);
 assert.match(workspace,/OutlinedTextField\(value=search/);
 assert.match(workspace,/data\.farmList/);
 assert.match(workspace,/data\.fieldList/);
 assert.match(workspace,/Card\(colors,onClick=\{opened=user\.id\}\)/);
 assert.match(workspace,/Card\(colors,onClick=\{opened=index\}\)/);
});

test("field tabs and operation cards open native details for both authorized roles",()=>{
 for(const title of ["Áttekintés","Teendők","Műveletek","Időjárás","Térkép"]){
  assert.ok(main.includes(`"${title}"`),`${title} tab missing`);
 }
 assert.match(main,/private fun LiveOperationDetailScreen\(/);
 assert.match(main,/route\.startsWith\("\/operations\/"\)/);
 assert.match(main,/route\.startsWith\("\/admin\/operations\/"\)/);
 assert.match(main,/onNavigate\(if\(session\.role==PortalRole\.ADVISOR\)"\/admin\/operations\/\$\{op\.id\}"/);
 const web=read(`${ui}/AdvancedWebModuleScreen.kt`);
 assert.match(web,/WebModuleOpenButton\(route,colors\)/);
 assert.match(web,/safeWebModuleUrl\(BuildConfig\.WEB_ORIGIN,path\)/);
});

test("advisor priority task opens its own details instead of an unrelated list",()=>{
 assert.match(workspace,/Card\(colors,onClick=\{onNavigate\("\/admin\/tasks\/\$\{task\.id\}"\)\}\)/);
 assert.match(main,/route\.startsWith\("\/admin\/tasks\/"\)/);
 assert.match(workspace,/selectedTaskId=route\.removePrefix\("\/admin\/tasks\/"\)/);
 assert.match(workspace,/openedTask=data\.tasks\.firstOrNull\{it\.id==selectedTaskId\}/);
});

test("large record lists support searches and bounded initial rendering",()=>{
 assert.match(workspace,/private fun AdvisorClients[\s\S]*?filtered\.take\(shown\)/);
 assert.match(workspace,/private fun AdvisorTasks[\s\S]*?tasks\.take\(shown\)/);
 assert.match(workspace,/private fun AdminUsers[\s\S]*?users\.take\(shown\)/);
 assert.match(workspace,/private fun AdminSupport[\s\S]*?indexes\.take\(shown\)/);
 assert.match(main,/private fun LiveTasksScreen[\s\S]*?filtered\.take\(shown\)/);
 assert.match(main,/private fun LiveOperationsScreen[\s\S]*?filtered\.take\(shown\)/);
});

test("admin farm card drills into associated fields and their actual metadata",()=>{
 const repo=read("android/app/src/main/java/hu/agrarmentor/android/data/RoleWorkspaceRepository.kt");
 assert.match(repo,/data class AdminInventoryField\([\s\S]*?farmId:String/);
 assert.match(repo,/fields\?select=id,name,farm_id,area_ha,current_crop,settlement,status/);
 assert.match(workspace,/data\.fieldList\.filter\{it\.farmId==id\}/);
 assert.match(workspace,/onNavigate\("\/system-admin\/fields\/\$\{farm\.id\}"\)/);
 assert.match(main,/route\.startsWith\("\/system-admin\/fields\/"\)/);
 assert.match(workspace,/field\.areaHa\?\.let\{Text\("Terület: \$it ha"\)\}/);
});

test("admin accounts cannot inflate the farmer or advisor counts",()=>{
 assert.match(workspace,/data\.users\.count\{it\.role=="farmer"&&it\.systemRole!="admin"\}/);
 assert.match(workspace,/data\.users\.count\{it\.role=="advisor"&&it\.systemRole!="admin"\}/);
 assert.match(workspace,/PortalMetric\("Rendszeradminisztrátorok"/);
 assert.match(workspace,/if\(roleFilter=="admin"\)it\.systemRole=="admin"/);
});

test("web operation audit button has a strictly validated route",()=>{
 const link=read("android/app/src/main/java/hu/agrarmentor/android/data/WebModuleLink.kt");
 const linkTest=read("android/app/src/test/java/hu/agrarmentor/android/data/WebModuleLinkTest.kt");
 assert.match(main,/WebModuleOpenButton\("\/operations\/\$\{op\.id\}",colors\)/);
 assert.match(link,/validMapFieldId\(path\.removePrefix\("\/operations\/"\)\)/);
 assert.match(linkTest,/\/operations\/\.\.\/\.\.\/system-admin\/backup/);
 assert.doesNotMatch(main,/AdvisorWorkspaceScreen\("\/admin",session,colors,onNavigate\)/);
});

test("an operation detail never downloads every operation from a farm",()=>{
 const repo=read("android/app/src/main/java/hu/agrarmentor/android/data/FarmerWorkspaceRepository.kt");
 assert.match(repo,/suspend fun operation\(session:AuthorizedSession,operationId:String\):MobileOperation\?/);
 assert.match(repo,/require\(validMapFieldId\(operationId\)\)/);
 assert.match(repo,/&id=eq\.\$operationId&limit=1/);
 assert.match(main,/operation=repository\.operation\(session,operationId\)/);
});
