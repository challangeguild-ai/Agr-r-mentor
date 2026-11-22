import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";

const migration=readFileSync(new URL("../supabase/migrations/20261122073451_farm_profitability.sql",import.meta.url),"utf8");
const actions=readFileSync(new URL("../app/profit/actions.ts",import.meta.url),"utf8");
const page=readFileSync(new URL("../app/profit/page.tsx",import.meta.url),"utf8");
const forms=readFileSync(new URL("../app/profit/ProfitForms.tsx",import.meta.url),"utf8");
const sidebar=readFileSync(new URL("../components/Sidebar.tsx",import.meta.url),"utf8");

test("financial seasons and entries are owner-scoped with RLS",()=>{
 assert.match(migration,/alter table public\.field_profit_seasons enable row level security/i);
 assert.match(migration,/alter table public\.field_profit_entries enable row level security/i);
 assert.match(migration,/revoke all on public\.field_profit_seasons from public,anon/i);
 assert.match(migration,/revoke all on public\.field_profit_entries from public,anon/i);
 assert.match(migration,/f\.owner_id=\(select auth\.uid\(\)\)/);
 assert.match(migration,/created_by=\(select auth\.uid\(\)\)/);
 assert.match(migration,/constraint field_profit_seasons_field_farm_fk foreign key \(field_id,farm_id\)/);
});

test("sale and harvest guards reject overselling even from direct Data API",()=>{
 assert.match(migration,/for update;/i);
 assert.match(migration,/create trigger field_profit_sale_quantity_guard/i);
 assert.match(migration,/create trigger field_profit_harvest_quantity_guard/i);
 assert.match(migration,/v_sold\+new\.quantity_tonnes>v_harvest/);
 assert.match(migration,/v_sold>new\.harvested_tonnes/);
 assert.match(migration,/revoke all on function public\.enforce_profit_sale_limit\(\) from public,anon,authenticated/i);
});

test("financial writes verify farmer ownership and do not accept client-side farm IDs",()=>{
 assert.match(actions,/profile\.role!=="farmer"/);
 assert.match(actions,/\.eq\("owner_id",ownerId\)/);
 assert.match(actions,/farm_id:field\.farm_id/);
 assert.match(actions,/await ownedSeason\(supabase,user\.id/);
 assert.doesNotMatch(actions,/farm_id:value\(form/);
});

test("farmer navigation leads to working financial forms and safe error states",()=>{
 assert.match(sidebar,/\["\/profit","profit"/);
 assert.match(page,/href=\{`\/profit\?year=\$\{year\}&new=1`\}/);
 assert.match(page,/!available\?/);
 assert.match(page,/entriesError\?/);
 assert.match(forms,/action=\{addProfitCost|useActionState\(addProfitCost/);
 assert.match(forms,/useActionState\(addProfitSale/);
 assert.match(forms,/useActionState\(deleteProfitEntry/);
 assert.match(forms,/useActionState\(saveProfitSeason/);
 assert.match(forms,/router\.push\(state\.navigateTo\)/);
});
