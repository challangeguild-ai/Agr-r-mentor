import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("admin security overview has a visible title, Hungarian event labels and mobile-safe details", () => {
  const page = read("app/system-admin/security/page.tsx");
  const css = read("app/system-admin/security/security.module.css");
  assert.match(page, /<h2 id="security-summary-heading">Biztonsági helyzetkép<\/h2>/);
  assert.match(page, /EVENT_LABELS\[event\.event_type\]/);
  assert.match(page, /security_events/);
  assert.match(css, /\.eventDetails/);
  assert.match(css, /overflow-wrap:break-word|overflow-wrap:anywhere/);
  assert.match(css, /@media\(max-width:700px\)/);
});

test("admin backup keeps protected export flow and role-red notices", () => {
  const page = read("app/system-admin/backup/page.tsx");
  const css = read("app/system-admin/backup/backup.module.css");
  assert.match(page, /<SensitiveExportButton\s*\/>/);
  assert.match(page, /Friss hitelesítés szükséges/);
  assert.match(css, /\.securityNotice/);
  assert.match(css, /--agrar-ui-accent|#8f2d40/);
});

test("admin weather keeps incident statuses but clears the mobile header", () => {
  const css = read("app/system-admin/weather/weather.module.css");
  assert.match(css, /--agrar-ui-accent/);
  assert.match(css, /@media\(max-width:767px\)/);
  assert.match(css, /padding:76px 12px/);
});

test("advisor summary headers are no longer help-only strips", () => {
  for (const [pagePath, title] of [
    ["app/admin/page.tsx", "Gyors szakmai modulok"],
    ["app/admin/clients/page.tsx", "Ügyfélállomány áttekintése"],
    ["app/admin/documents/page.tsx", "Dokumentumtár áttekintése"],
    ["app/admin/map/page.tsx", "Földtáblák áttekintése"],
    ["app/admin/operations/page.tsx", "Műveleti napló áttekintése"],
  ]) {
    const page = read(pagePath);
    assert.ok(page.includes(`className="advisor-summary-heading"><h2>${title}</h2>`), pagePath);
    assert.doesNotMatch(page, /gridColumn:"1\/-1",display:"flex",justifyContent:"flex-end"/);
  }
  const css = read("app/admin/AdminLayout.module.css");
  assert.match(css, /\.advisor-summary-heading h2/);
});

test("advisor documents and client workspaces use role-color tokens", () => {
  for (const path of [
    "app/admin/clients/clients.module.css",
    "app/admin/clients/[id]/client-workspace.module.css",
    "app/documents/documents.module.css",
    "components/DocumentLibrary.module.css",
  ]) {
    assert.match(read(path), /--agrar-ui-accent/, path);
  }
  assert.match(read("app/admin/AdminLayout.module.css"), /\.admin-overview-card strong\)\{color:var\(--agrar-ui-accent\)!important/);
});

test("advisor workday and visit stats adapt to phones without horizontal page overflow", () => {
  const css = read("app/admin/AdminLayout.module.css");
  const workday = read("app/admin/workday/page.tsx");
  const visits = read("app/admin/visits/page.tsx");
  assert.match(workday, /className="advisor-workday-columns"/);
  assert.match(workday, /className="advisor-week-scroll"/);
  assert.match(workday, /priorityLabel\(t\.priority\)/);
  assert.match(visits, /className="advisor-visit-stats"/);
  assert.match(css, /\.advisor-workday-columns\)\{grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /\.advisor-visit-stats\)\{grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /supervision-seasons/);
});
