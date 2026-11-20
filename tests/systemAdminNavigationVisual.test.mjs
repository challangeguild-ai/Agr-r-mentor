import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

test("system admin uses one mobile navigation with all six destinations",()=>{
 const component=read("components/SystemAdminSidebar.tsx");
 for(const href of ["/system-admin","/system-admin/support","/system-admin/users","/system-admin/security","/system-admin/weather","/system-admin/backup"]){
  assert.ok(component.includes(`"${href}"`),`Missing admin destination ${href}`);
 }
 assert.doesNotMatch(component,/<nav className=\{styles\.mobileNav\}/);
 assert.match(component,/aria-label="Admin menü megnyitása" aria-expanded=\{open\} aria-controls="system-admin-drawer"/);
 assert.match(component,/<aside id="system-admin-drawer"/);
 assert.match(component,/aria-label="Oldalsáv bezárása"/);
 assert.match(component,/setOpen\(false\)/);
});

test("admin hamburger and drawer stack above fixed header at mobile widths",()=>{
 const css=read("components/SystemAdminSidebar.module.css");
 const mobile=css.slice(css.lastIndexOf("/* Single mobile navigation"));
 assert.match(mobile,/\.launch\{[^}]*z-index:120/);
 assert.match(mobile,/\.overlay\{z-index:125\}/);
 assert.match(mobile,/\.sidebar\{z-index:130/);
 assert.match(mobile,/\.mobileNav\{display:none!important\}/);
 assert.match(mobile,/\.nav a\{min-height:46px;font-size:13px\}/);
});

test("admin pages no longer reserve bottom navigation space",()=>{
 const layout=read("app/system-admin/SystemAdminLayout.module.css");
 const dashboard=read("app/system-admin/system-admin-dashboard.module.css");
 assert.match(layout,/padding-bottom:calc\(28px \+ env\(safe-area-inset-bottom\)\)!important/);
 assert.match(dashboard,/padding-bottom:calc\(28px \+ env\(safe-area-inset-bottom\)\)!important/);
});
