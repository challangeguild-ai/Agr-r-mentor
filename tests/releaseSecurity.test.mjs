import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {escapeHtml} from "../lib/escapeHtml.ts";

const source=path=>readFileSync(new URL(path,import.meta.url),"utf8");

test("archived production rollback copies are excluded from the Next.js typecheck",()=>{
 const config=JSON.parse(source("../tsconfig.json"));
 assert.ok(config.exclude.includes("supabase/functions/**"));
 assert.ok(config.exclude.includes("docs/rollback/**"));
});

test("external diagnostic requests require a system admin with MFA before fetching",()=>{
 const gate=source("../lib/security/probeAuth.ts");
 assert.match(gate,/supabase\.auth\.getUser\(\)/);
 assert.match(gate,/profile\?\.role!=="advisor"\|\|profile\.system_role!=="admin"/);
 assert.match(gate,/aal\?\.currentLevel!=="aal2"/);
 for(const route of ["../app/api/uksup-health/route.ts","../app/api/nebih-public-meta/route.ts"]){
  const content=source(route);
  assert.ok(content.indexOf("await requireSystemAdminProbe()")<content.indexOf("await fetch("),route);
  assert.match(content,/if\(accessError\)return accessError/);
 }
});

test("a successful admin backup expires the step-up cookie on its original path",()=>{
 const issue=source("../app/api/security/step-up/route.ts");
 const exportRoute=source("../app/admin/backup/export/route.ts");
 assert.match(issue,/path:"\/admin\/backup",maxAge:STEP_UP_TTL_SECONDS/);
 assert.match(exportRoute,/response\.cookies\.set\(STEP_UP_COOKIE,"",\{path:"\/admin\/backup",maxAge:0/);
 assert.doesNotMatch(exportRoute,/cookieStore\.delete\(STEP_UP_COOKIE\)/);
});

test("an interrupted admin MFA confirmation releases the export button for retry",()=>{
 const component=source("../components/SensitiveExportButton.tsx");
 assert.match(component,/catch\{\s*setError\("A kapcsolat megszakadt/);
 assert.match(component,/finally\{setBusy\(false\)\}/);
});

test("field-editor hotspot labels and notes are HTML-escaped before Leaflet inserts them",()=>{
 const attack='<img src=x onerror="alert(1)">&';
 assert.equal(escapeHtml(attack),'&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;');
 const editor=source("../components/FieldMapEditor.tsx");
 assert.match(editor,/escapeHtml\(h\.title\)/);
 assert.match(editor,/escapeHtml\(h\.description\)/);
 assert.doesNotMatch(editor,/<strong>\$\{h\.title\}<\/strong>/);
 assert.match(editor,/setMapLoadError\("A térképi modul nem tölthető be/);
 assert.match(editor,/mapLoadError\?<p role="alert"/);
 const overview=source("../components/FieldsOverviewMap.tsx");
 assert.match(overview,/\.bindTooltip\(escapeHtml\(h\.title\)/);
});
