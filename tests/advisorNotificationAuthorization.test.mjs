import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const migration=readFileSync(new URL("../supabase/migrations/20261119093000_authorized_advisor_notifications.sql",import.meta.url),"utf8");
const hotspotActions=readFileSync(new URL("../app/fields/[id]/hotspot-actions.ts",import.meta.url),"utf8");
const hotspotForm=readFileSync(new URL("../components/HotspotForm.tsx",import.meta.url),"utf8");
const reports=readFileSync(new URL("../app/fields/[id]/report-actions.ts",import.meta.url),"utf8");
const farmerReportForm=readFileSync(new URL("../components/FarmerReportForm.tsx",import.meta.url),"utf8");

test("farmer report and hotspot notifications are allowed only for the owning farmer's persisted event",()=>{
 assert.match(migration,/p_kind = 'farmer_report'/);
 assert.match(migration,/r\.id = v_entity_id and r\.farmer_id = v_actor and f\.owner_id = v_actor/);
 assert.match(migration,/p_kind in \('hotspot','hotspot_resolved'\)/);
 assert.match(migration,/e\.id = v_entity_id and e\.event_type = 'field_hotspot'/);
 assert.match(migration,/and f\.owner_id = v_actor/);
 assert.match(migration,/\(substring\(e\.description from 13\)::jsonb ->> 'resolved'\)::boolean/);
 assert.match(reports,/eventKey:`report:\$\{report\.id\}:created`/);
 assert.match(hotspotActions,/eventKey:`hotspot:\$\{event\.id\}:created`/);
 assert.match(hotspotActions,/eventKey:`hotspot:\$\{eventId\}:resolved`/);
});

test("ordinary task workflow notifications require a task assigned to the current caller",()=>{
 assert.match(migration,/v_parts := regexp_match/);
 assert.match(migration,/t\.id = v_entity_id and t\.assigned_to = v_actor/);
 assert.match(migration,/e\.created_by = v_actor/);
 assert.match(migration,/t\.status = 'submitted' and r\.reported_by = v_actor/);
 assert.match(migration,/r\.review_status = 'pending'/);
 assert.match(migration,/if not coalesce\(v_allowed,false\) then/);
});

test("hotspot links target an authorized advisor page and exposed profile RPC loses anonymous execution",()=>{
 assert.match(hotspotActions,/kind:"hotspot"[^\n]*href:"\/admin\/map"/);
 assert.match(hotspotActions,/kind:"hotspot_resolved"[^\n]*href:"\/admin\/map"/);
 assert.match(migration,/p_href not like '\/admin%'/);
 assert.match(migration,/revoke all on function public\.notify_advisors\(text,text,text,text,text\) from public, anon, authenticated/);
 assert.match(migration,/grant execute on function public\.notify_advisors\(text,text,text,text,text\) to authenticated/);
 assert.match(migration,/to_regprocedure\('public\.update_own_profile\(text,text,text\)'\)/);
 assert.match(migration,/revoke execute on function public\.update_own_profile\(text,text,text\) from public, anon/);
});

test("hotspot save reports partial success and prevents retry duplicates",()=>{
 assert.match(hotspotActions,/if\(!latInput\|\|!lngInput\|\|!Number\.isFinite\(lat\)/);
 assert.match(hotspotActions,/dueDate&&!validDateOnly\(dueDate\)/);
 assert.ok(hotspotActions.indexOf("dueDate&&!validDateOnly(dueDate)")<hotspotActions.indexOf('from("timeline_events").insert'),"date validation must happen before the first write");
 assert.match(hotspotActions,/if\(taskError\|\|!task\)[^\n]*warning=/);
 assert.match(hotspotActions,/return\{ok:true,warning\}/);
 assert.match(hotspotForm,/if\(submittingRef\.current\)return/);
 assert.match(hotspotForm,/setMessage\(result\.warning\|\|"A problémagóc rögzítve\."\)/);
 assert.match(hotspotForm,/router\.refresh\(\)/);
 assert.doesNotMatch(hotspotForm,/window\.location\.reload\(/);
});

test("closing an already resolved hotspot preserves the original creator and does not repeat notifications",()=>{
 assert.match(hotspotActions,/if\(data\.resolved\)return/);
 assert.doesNotMatch(hotspotActions,/update\(\{description:encodeHotspot\(data\),title:[^\n]*created_by/);
});

test("farmer report attachments survive wizard navigation and interrupted uploads cannot duplicate the report",()=>{
 assert.match(farmerReportForm,/display:step===2\?"block":"none"/);
 assert.match(farmerReportForm,/<input name="media" type="file"/);
 assert.match(farmerReportForm,/formData\.getAll\("media"\)/);
 assert.match(farmerReportForm,/if\(!reportIdRef\.current\)\{/);
 assert.match(farmerReportForm,/reportIdRef\.current=report\.id/);
 assert.match(farmerReportForm,/selectedFilesRef\.current=files/);
 assert.match(farmerReportForm,/if\(linkedFilesRef\.current\.has\(index\)\)continue/);
 assert.match(farmerReportForm,/uploadedPathsRef\.current\.get\(index\)/);
 assert.match(farmerReportForm,/\.eq\("report_id",reportId\)\.eq\("storage_path",path\)\.maybeSingle\(\)/);
 assert.match(farmerReportForm,/disabled=\{busy\|\|reportSaved\}/);
 assert.match(farmerReportForm,/Hiányzó csatolmányok újrapróbálása/);
 assert.match(reports,/return\{id:report\.id,warning\}/);
});
