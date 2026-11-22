import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";

const source=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const migration=source("supabase/migrations/20261122081322_farm_profit_privacy_hardening.sql");
const farmerPage=source("app/profit/page.tsx");
const actions=source("app/profit/actions.ts");
const advisorPage=source("app/admin/profit/AdvisorFinanceView.tsx");
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

test("advisor sees exact audited figures only after MFA and grant checks",()=>{
 assert.match(advisorMenu,/\["\/admin\/profit","▥","Jövedelmezőség","advisor-profit"\]/);
 assert.match(tour,/href:"\/admin\/profit",menu:'\[data-tour="advisor-profit"\]'/);
 assert.match(advisorPage,/readAdvisorFinance\(user\.id/);
 assert.match(advisorPage,/s\.totals\.realizedRevenue/);
 assert.match(advisorPage,/currentLevel!=="aal2"/);
 assert.doesNotMatch(advisorPage,/createAdminClient|service_role/);
 assert.match(advisorLayout,/profile\?\.role!=="advisor"/);
 assert.match(advisorLayout,/currentLevel!=="aal2"/);
});

test("financial access is grant-gated, audited and never exposed via advisor RLS",()=>{
 const grants=source("supabase/migrations/20261122103129_advisor_finance_access.sql");
 const helper=source("lib/advisorProfit.ts");
 const endpoint=source("app/api/advisor/profit/route.ts");
 const actions=source("app/system-admin/actions.ts");
 assert.match(grants,/farm_advisor_finance_grants/);
 assert.match(grants,/grant select on public\.farm_advisor_finance_grants to authenticated/);
 assert.doesNotMatch(grants,/grant (?:insert|update|delete|all) on public\.farm_advisor_finance_grants to authenticated/);
 assert.doesNotMatch(grants,/create policy .* on public\.field_profit_(?:seasons|entries)/);
 assert.match(grants,/advisor_finance_grant_audit/);
 assert.match(helper,/\.eq\("advisor_id",userId\)\.is\("revoked_at",null\)/);
 assert.match(helper,/grantOwners\.get\(f\.id\)===f\.owner_id/);
 assert.match(helper,/owners\.get\(s\.farm_id\)===s\.created_by/);
 assert.match(helper,/action:"advisor_finance_view"/);
 assert.match(helper,/if\(auditError\)throw/);
 assert.match(endpoint,/db\.auth\.getUser\(token\)/);
 assert.match(endpoint,/claims\.aal!=="aal2"/);
 assert.match(endpoint,/private, no-store/);
 assert.match(actions,/form\.get\("basis_ack"\)!=="yes"/);
});
