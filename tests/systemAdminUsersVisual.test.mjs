import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

test("system admin users page follows shared role card and form tokens",()=>{
 const page=read("app/system-admin/users/page.tsx");
 const css=read("app/system-admin/users/users.module.css");
 assert.match(page,/import styles from "\.\/users\.module\.css"/);
 assert.match(page,/aria-label="Felhasználói összesítés"/);
 assert.match(page,/className=\{styles\.summaryCard\}/);
 assert.match(css,/var\(--agrar-ui-card-radius\)/);
 assert.match(css,/var\(--agrar-ui-control-radius\)/);
 assert.match(css,/var\(--agrar-ui-accent\)/);
 assert.match(css,/\.inviteForm input\{[^}]*min-height:44px/);
});

test("system admin user records become readable labelled cards on phones",()=>{
 const page=read("app/system-admin/users/page.tsx");
 const css=read("app/system-admin/users/users.module.css");
 for(const label of ["Név","Szakmai szerep","Rendszerjog","Telefon","Létrehozva"]){
  assert.ok(page.includes(`data-label="${label}"`),`Missing mobile field label: ${label}`);
 }
 assert.match(page,/<th scope="col">/);
 assert.match(css,/@media\(max-width:767px\)/);
 assert.match(css,/\.table thead\{display:none\}/);
 assert.match(css,/\.table tbody tr\{display:block/);
 assert.match(css,/content:attr\(data-label\)/);
});

test("visual refresh preserves the MFA-protected advisor invitation action and never adds role editing",()=>{
 const page=read("app/system-admin/users/page.tsx");
 assert.match(page,/<form action=\{inviteAdvisor\}/);
 assert.match(page,/name="email" type="email" autoComplete="email" required/);
 assert.match(page,/name="full_name" autoComplete="name"/);
 assert.match(page,/p\.system_role==="admin"|user\.system_role==="admin"/);
 assert.doesNotMatch(page,/name="system_role"|name="role"/);
 assert.match(page,/adminjog kiosztása szándékosan nem egyszerű kapcsoló/i);
});
