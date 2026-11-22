import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";

const source=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const migration=source("supabase/migrations/20261122081322_farm_profit_privacy_hardening.sql");
const farmerPage=source("app/profit/page.tsx");
const actions=source("app/profit/actions.ts");
const advisorPage=source("app/admin/profit/page.tsx");
const advisorLayout=source("app/admin/layout.tsx");
const advisorMenu=source("components/AdvisorSidebar.tsx");
const tour=source("components/ComprehensiveTour.tsx");

test("both financial RLS tables require original creator, current owner and farmer role",()=>{
 assert.match(migration,/drop policy if exists "farmer owns season"/);
 assert.match(migration,/drop policy if exists "farmer owns financial entries"/);
 assert.equal((migration.match(/(?<!\.)created_by=\(select auth\.uid\(\)\)/g)??[]).length,4);
 assert.equal((migration.match(/p\.role='farmer'/g)??[]).length,4);
 assert.equal((migration.match(/coalesce\(p\.system_role,'user'\)='user'/g)??[]).length,4);
 assert.equal((migration.match(/f\.owner_id=\(select auth\.uid\(\)\)/g)??[]).length,4);
 assert.equal((migration.match(/s\.created_by=\(select auth\.uid\(\)\)/g)??[]).length,2);
 assert.match(migration,/for all to authenticated/);
 assert.doesNotMatch(migration,/security definer/i);
});

test("farmer server views and writes retain creator scoping independently of RLS",()=>{
 assert.match(farmerPage,/\.eq\("owner_id",user\.id\)/);
 assert.equal((farmerPage.match(/\.eq\("created_by",user\.id\)/g)??[]).length,2);
 assert.match(actions,/\.eq\("created_by",ownerId\)/);
 assert.match(actions,/\.eq\("created_by",user\.id\)/);
 assert.match(actions,/profile\.role!=="farmer"/);
});

test("advisor privacy view shows masked amounts but never queries financial records",()=>{
 assert.match(advisorMenu,/\["\/admin\/profit","▥","Jövedelmezőség 🔒","advisor-profit"\]/);
 assert.match(tour,/href:"\/admin\/profit",menu:'\[data-tour="advisor-profit"\]'/);
 assert.match(advisorPage,/•••••• Ft/);
 assert.match(advisorPage,/href="\/admin\/clients"/);
 assert.doesNotMatch(advisorPage,/createClient|field_profit_seasons|field_profit_entries|service_role/);
 assert.match(advisorLayout,/profile\?\.role!=="advisor"/);
 assert.match(advisorLayout,/currentLevel!=="aal2"/);
});
