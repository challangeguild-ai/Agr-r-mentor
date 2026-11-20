import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

test("accepted reference screens keep all six real farmer routes",()=>{
 const sidebar=read("components/Sidebar.tsx");
 for(const route of ["/fields","/operations","/tasks","/messages","/documents"])
  assert.ok(sidebar.includes(`"${route}"`),`Missing ${route} from navigation`);
 assert.match(sidebar,/styles\.userFooter/);
 assert.match(sidebar,/styles\.landscape/);
});

test("original agricultural photo and transparent PNG branding stay consistent across all roles and public website",async()=>{
 const photo=new URL("../public/images/agrar-fields-sunrise.webp",import.meta.url);
 const photoBytes=readFileSync(photo);
 assert.equal(photoBytes.toString("ascii",0,4),"RIFF","Agricultural banner must be a real WebP asset");
 assert.ok(statSync(photo).size<400_000,"Agricultural banner should stay lightweight on mobile");
 const sharp=(await import("sharp")).default;
 for(const name of ["agrar-mentor-logo.png","agrar-mentor-logo-on-light.png"]){
  const logo=new URL(`../public/images/${name}`,import.meta.url);
  const bytes=readFileSync(logo);
  assert.equal(bytes.subarray(0,8).toString("hex"),"89504e470d0a1a0a",`${name} must be PNG`);
  assert.equal(bytes[25],6,`${name} must have an RGBA alpha channel`);
  const corner=await sharp(bytes).extract({left:0,top:0,width:1,height:1}).ensureAlpha().raw().toBuffer();
  assert.equal(corner[3],0,`${name} background must be transparent`);
  assert.ok(statSync(logo).size<800_000,`${name} should remain lightweight on mobile`);
 }
 const sharedLogo=read("components/AgrarMentorLogo.tsx");
 assert.match(sharedLogo,/onLight\?"\/images\/agrar-mentor-logo-on-light\.png":"\/images\/agrar-mentor-logo\.png"/);
 assert.match(sharedLogo,/alt="AGRÁR MENTOR"/);
 const sidebar=read("components/FarmerSidebar.module.css");
 const field=read("app/fields/[id]/field-detail.module.css");
 const markup=read("components/Sidebar.tsx");
 assert.match(sidebar,/url\("\/images\/agrar-fields-sunrise\.webp"\)/);
 assert.match(field,/url\("\/images\/agrar-fields-sunrise\.webp"\)/);
 assert.match(markup,/<AgrarMentorLogo className=\{styles\.brandLogo\}/);
 for(const role of ["AdvisorSidebar","SystemAdminSidebar"]){
  const source=read(`components/${role}.tsx`);
  assert.match(source,/<AgrarMentorLogo className=\{styles\.brandLogo\}/,`${role}: sidebar logo missing`);
  assert.match(source,/<AgrarMentorLogo className=\{styles\.mobileBrandLogo\}/,`${role}: mobile header logo missing`);
 }
 const publicSite=read("app/page.tsx");
 assert.match(publicSite,/<AgrarMentorLogo className=\{styles\.brandLogo\} onLight/);
 assert.match(publicSite,/<AgrarMentorLogo className=\{styles\.footerBrandLogo\}/);
 assert.match(read("components/LandingLoginModal.tsx"),/<AgrarMentorLogo className=\{brandStyles\.modalLogo\} onLight/);
 assert.match(read("app/landing.module.css"),/\.brand\{width:max-content;max-width:100%;padding:0;background:transparent\}/);
 assert.match(markup,/aria-hidden="true"\/\>/);
});

test("field cards and the interactive map/list switch use real field data",()=>{
 const page=read("app/fields/page.tsx");
 const styles=read("app/fields/fields.module.css");
 assert.match(page,/requestedMode==="map"\|\|requestedMode==="list"/);
 assert.match(page,/mode=map/);
 assert.match(page,/mode=list/);
 assert.match(page,/data-mode=\{mode\}/);
 assert.match(page,/&mode=\$\{mode\}/);
 assert.match(page,/FieldMiniMap/);
 assert.match(page,/FieldsOverviewMap/);
 assert.match(styles,/\.workspace\[data-mode="map"\] \.list\{display:none\}/);
 assert.match(styles,/\.workspace\[data-mode="auto"\] \.map/);
});

test("fields search actually filters the catalog and preserves search when views change",()=>{
 const page=read("app/fields/page.tsx");
 const header=read("components/FarmerTopbar.tsx");
 const css=read("app/fields/fields.module.css");
 assert.match(page,/searchAction="\/fields" defaultQuery=\{query\} preserveSearchParams=\{\{view,mode\}\}/);
 assert.match(page,/matchesFieldCatalogQuery\(\{\.\.\.field,farmName:/);
 assert.match(page,/&mode=map\$\{querySuffix\}/);
 assert.match(page,/&mode=list\$\{querySuffix\}/);
 assert.match(page,/Keresés törlése/);
 assert.match(header,/searchAction="\/dashboard"/);
 assert.match(header,/action=\{searchAction\} method="get"/);
 assert.match(header,/Object\.entries\(preserveSearchParams\)/);
 assert.match(css,/\.filters\{flex-wrap:wrap;overflow:visible/);
 assert.match(page,/inactive\?statusLabel\(field\.status\)/);
});

test("field boundaries stand out on satellite imagery and the mobile drawer stays above Leaflet",()=>{
 const map=read("components/FieldsOverviewMap.tsx");
 const css=read("app/fields/fields.module.css");
 const sidebarCss=read("components/FarmerSidebar.module.css");
 assert.match(map,/color:"#153927",weight:8,opacity:\.92,fill:false/);
 assert.match(map,/color:"#ffe348",weight:4,opacity:1/);
 assert.match(map,/interactive:false/);
 assert.match(map,/isolation:"isolate",zIndex:0/);
 assert.match(css,/\.map\{position:relative;z-index:0;isolation:isolate\}/);
 assert.match(sidebarCss,/z-index:100/);
 assert.match(sidebarCss,/z-index:95/);
});

test("field list outline uses the actual inspection status and stays neutral without one",()=>{
 const page=read("app/fields/page.tsx");
 const css=read("app/fields/fields.module.css");
 assert.match(page,/const cardOutline=inactive\?"":state==="critical"\?styles\.fieldCritical:state==="attention"\?styles\.fieldAttention:state==="good"\?styles\.fieldGood:""/);
 assert.match(css,/\.fieldCard\.fieldCritical\{border:2px solid #d84b50\}/);
 assert.match(css,/\.fieldCard\.fieldAttention\{border:2px solid #dfb62a\}/);
 assert.match(css,/\.fieldCard\.fieldGood\{border:2px solid #4c995f\}/);
});

test("field health indicates the actual inspection state, not a made-up score",()=>{
 const page=read("app/fields/[id]/page.tsx");
 assert.match(page,/id="allapot"/);
 assert.match(page,/aria-label=\{`Növényállapot:/);
 assert.match(page,/conditionLabel\(latestInspection\?\.condition\)/);
 assert.doesNotMatch(page,/condition==="good"\?"72"/);
 assert.doesNotMatch(page,/condition==="attention"\?"48"/);
 assert.doesNotMatch(page,/condition==="critical"\?"24"/);
});

test("task creation and document/message actions retain their existing workflows",()=>{
 const tasks=read("app/tasks/page.tsx");
 const docs=read("components/DocumentLibrary.tsx");
 const messages=read("app/messages/page.tsx");
 assert.match(tasks,/href="\/dispatch">\+ Új teendő/);
 assert.match(docs,/createSignedUrl\(d\.storage_path,60\)/);
 assert.match(docs,/deleteDocument\(d\.id\)/);
 assert.match(messages,/href=\{`\/fields\/\$\{selected\.field_id\}`\}/);
 assert.doesNotMatch(messages,/<textarea/);
});

test("six reference sections preserve responsive views and readable controls",()=>{
 for(const path of [
  "app/fields/fields.module.css",
  "app/fields/[id]/field-detail.module.css",
  "app/operations/operations.module.css",
  "app/tasks/tasks.module.css",
  "app/messages/messages.module.css",
  "app/documents/documents.module.css",
  "components/DocumentLibrary.module.css",
 ]){
  const css=read(path);
  assert.match(css,/@media\(max-width:767px\)/,`${path}: mobile breakpoint missing`);
  assert.match(css,/font-size:1[2-6]px/,`${path}: no readable text sizing`);
 }
});

test("shared farmer header preserves real search behavior and usable mobile controls",()=>{
 const header=read("components/FarmerTopbar.tsx");
 const css=read("components/FarmerTopbar.module.css");
 assert.match(header,/searchAction="\/dashboard"/);
 assert.match(header,/name="q" type="search"/);
 assert.match(header,/placeholder=\{placeholder\}/);
 assert.match(css,/\.search:focus-within/);
 assert.match(css,/@media\(max-width:767px\)/);
 assert.match(css,/\.search input\{font-size:16px\}/);
 assert.match(css,/\.profile\{width:42px!important/);
});

test("unknown field health is neutral and remaining farmer screens stay accessible",()=>{
 const fieldPage=read("app/fields/[id]/page.tsx");
 const fieldCss=read("app/fields/[id]/field-detail.module.css");
 const notifications=read("app/notifications/notifications.module.css");
 const profile=read("app/profile/profile.module.css");
 const shared=read("app/portal-final.css");
 assert.match(fieldPage,/latestInspection\?\.condition==="good"\?styles\.stateGood:styles\.stateUnknown/);
 assert.match(fieldCss,/\.stateUnknown\{background:#edf1ed/);
 assert.match(notifications,/\.toolbar a:focus-visible/);
 assert.match(notifications,/\.actions a,\.actions button\{min-height:42px/);
 assert.match(profile,/\.grid input,\.grid select\{font-size:16px/);
 assert.match(shared,/\.farmer-app :is\(a,button,input,select,textarea\):focus-visible/);
});

test("mobile operation export is visible and the navigation drawer is touch-friendly",()=>{
 const operations=read("app/operations/operations.module.css");
 const operationPage=read("app/operations/page.tsx");
 const sidebar=read("components/FarmerSidebar.module.css");
 assert.match(operationPage,/<OperationExportButton rows=\{exportRows\}\/>/);
 assert.match(operations,/\.titleActions>:first-child\{display:inline-flex;align-items:center;justify-content:center;min-height:43px/);
 assert.match(sidebar,/\.close\{width:44px;height:44px\}/);
 assert.match(sidebar,/\.nav a\{min-height:44px;font-size:12\.5px\}/);
 assert.match(sidebar,/\.help a,\.help button\{min-height:44px!important\}/);
});

test("real mobile field screenshots cannot be obscured by fixed farmer help or menu launchers",()=>{
 const sidebar=read("components/Sidebar.tsx");
 const sidebarCss=read("components/FarmerSidebar.module.css");
 const shared=read("app/portal-final.css");
 const help=read("components/HelpCenter.tsx");
 const helpCss=read("components/HelpCenter.module.css");
 assert.match(sidebar,/Súgóközpont<\/button>/);
 assert.match(sidebar,/dispatchEvent\(new Event\("agrar-help-center-open"\)\)/);
 assert.match(help,/addEventListener\("agrar-help-center-open",show\)/);
 assert.match(help,/removeEventListener\("agrar-help-center-open",show\)/);
 assert.match(help,/aria-label="Súgóközpont megnyitása"/);
 assert.match(help,/role="dialog" aria-modal="true"/);
 assert.match(helpCss,/:global\(\.farmer-app\) \.launch\{display:none!important\}/);
 assert.match(sidebarCss,/:global\(\.farmer-app\) \.launch\{position:absolute;top:10px;left:12px\}/);
 assert.match(shared,/\.farmer-app\{position:relative\}/);
});
