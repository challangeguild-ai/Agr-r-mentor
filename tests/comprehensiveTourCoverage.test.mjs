import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync,readdirSync} from "node:fs";
import {join,resolve} from "node:path";

const root=resolve(import.meta.dirname,"..");
const tour=readFileSync(join(root,"components/ComprehensiveTour.tsx"),"utf8");
const farmerMenu=readFileSync(join(root,"components/Sidebar.tsx"),"utf8");
const advisorMenu=readFileSync(join(root,"components/AdvisorSidebar.tsx"),"utf8");
const adminMenu=readFileSync(join(root,"components/SystemAdminSidebar.tsx"),"utf8");

function jsxFiles(folder){
 return readdirSync(folder,{withFileTypes:true}).flatMap(item=>{
  const absolute=join(folder,item.name);
  if(item.isDirectory())return jsxFiles(absolute);
  if(!item.isFile()||!item.name.endsWith(".tsx")||item.name==="ComprehensiveTour.tsx")return [];
  return [absolute];
 });
}

const source=[...jsxFiles(join(root,"app")),...jsxFiles(join(root,"components"))]
 .map(path=>readFileSync(path,"utf8")).join("\n");

test("every comprehensive tour has a real page and a mounted target, including weather and profile",()=>{
 const hrefs=[...tour.matchAll(/href:"(\/[^"?#]+)"/g)].map(match=>match[1]);
 assert.ok(hrefs.length>=30,"expected all roles and the common profile page");
 for(const href of hrefs){
  assert.ok(existsSync(join(root,"app",href.slice(1),"page.tsx")),`missing tour page: ${href}`);
 }

 const selectors=[...tour.matchAll(/(?:menu|primarySelector|detailSelector|selector):\s*'\[data-(help-block|tour|admin-tour)="([^"]+)"\]'/g)]
  .map(match=>({attribute:match[1],value:match[2]}));
 assert.ok(selectors.length>=90,`unexpectedly small tour: ${selectors.length} targets`);
 for(const {attribute,value} of selectors){
  if(attribute==="help-block"){
   assert.ok(source.includes(`data-help-block="${value}"`),`missing UI target: ${value}`);
  }else{
   const menu=attribute==="admin-tour"?adminMenu:value.startsWith("advisor-")?advisorMenu:farmerMenu;
   assert.ok(menu.includes(`"${value}"`)||source.includes(`data-${attribute}="${value}"`),`missing navigation target: ${value}`);
  }
 }
 for(const role of ["farmer","advisor","system-admin"]){
  assert.match(tour,new RegExp(`${role=== "system-admin"?'"system-admin"':role}:\\{version:\\d+`),`missing versioned tour: ${role}`);
 }
 assert.match(tour,/id:"weather",label:"HungaroMet kapcsolat"/);
 assert.match(tour,/id:"profile-details"/);
});

test("all menu links of each role are included in its comprehensive tour",()=>{
 const entries=[
  ...[...farmerMenu.matchAll(/\["\/[^"\n]+","[^"]+","[^"]+","[^"]+","(farmer-[^"]+)"\]/g)].map(x=>x[1]),
  ...[...advisorMenu.matchAll(/\["\/[^"\n]+","[^"]+","[^"]+","(advisor-[^"]+)"\]/g)].map(x=>x[1]),
  ...[...adminMenu.matchAll(/\["\/[^"\n]+","[^"]+","[^"]+","(admin-[^"]+)"\]/g)].map(x=>x[1])
 ];
 assert.ok(entries.length>=30,`menu parsing missed entries: ${entries.length}`);
 for(const value of entries)assert.ok(tour.includes(`menu:'[data-${value.startsWith("admin-")?"admin-tour":"tour"}="${value}"]'`),`unexplained menu item: ${value}`);
});
