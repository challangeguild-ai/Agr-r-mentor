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

test("all role portals share the agricultural green visual system and real sign-in gate",()=>{
 assert.match(main,/private fun palette\(role:PortalRole\)=PortalPalette\(/);
 assert.match(main,/AgrarDesign\.green/);
 assert.match(main,/if\(session==null\)\{\s*SignInScreen\(/);
 assert.match(main,/ModalDrawerSheet\([^\n]+drawerContainerColor=AgrarDesign\.forest/);
 assert.match(theme,/R\.drawable\.agrar_fields_sunrise/);
 assert.ok(existsSync(join(root,"android/app/src/main/res/drawable-nodpi/agrar_fields_sunrise.webp")));
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
