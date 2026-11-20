import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

test("farmer, advisor and system admin share one geometric design contract",()=>{
 const css=read("app/role-design-system.css");
 const layout=read("app/layout.tsx");
 assert.match(layout,/import "\.\/role-design-system\.css"/);
 assert.match(css,/\.farmer-app,\.agrar-role-ui\s*\{/);
 for(const token of ["--agrar-ui-card-radius","--agrar-ui-control-radius","--agrar-ui-surface","--agrar-ui-border","--agrar-ui-shadow"]){
  assert.ok(css.includes(token),`Missing shared token ${token}`);
 }
 assert.match(css,/:is\(\.farmer-app,\.agrar-role-ui\) :is\(\.panel,\.stat-card/);
});

test("role palette changes green to blue or red without changing design components",()=>{
 const css=read("app/role-design-system.css");
 assert.match(css,/\.agrar-role-advisor\{[\s\S]*?--agrar-ui-accent:#286f9c/);
 assert.match(css,/\.agrar-role-system-admin\{[\s\S]*?--agrar-ui-accent:#94323d/);
 assert.match(css,/--agrar-ui-accent:#12613f/);
 assert.match(read("app/admin/layout.tsx"),/agrar-role-ui agrar-role-advisor/);
 assert.match(read("app/system-admin/layout.tsx"),/agrar-role-ui agrar-role-system-admin/);
});

test("all three dashboards take card, panel and list sizing from shared tokens",()=>{
 const dashboards=[
  ["app/dashboard/dashboard.module.css",".summaryCard",".panelHead",".priorityRow"],
  ["app/admin/admin-dashboard.module.css",".quickCard",".panelHead",".row"],
  ["app/system-admin/system-admin-dashboard.module.css",".summaryCard",".sectionHead",".auditList article"]
 ];
 for(const [path,...selectors] of dashboards){
  const css=read(path);
  for(const selector of selectors)assert.ok(css.includes(selector),`${path} missing ${selector}`);
  for(const token of ["var(--agrar-ui-card-radius)","var(--agrar-ui-border)","var(--agrar-ui-accent)"]){
   assert.ok(css.includes(token),`${path} missing ${token}`);
  }
 }
});
