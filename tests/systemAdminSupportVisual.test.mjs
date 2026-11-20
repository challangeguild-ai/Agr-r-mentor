import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("admin support summary has a visible heading instead of an empty help-only card", () => {
  const page = read("app/system-admin/support/page.tsx");
  assert.match(page, /data-help-block="system-support-summary"/);
  assert.match(page, /<header className=\{styles\.summaryHeading\}>/);
  assert.match(page, /<h2 id="support-summary-heading">Feladatok gyors áttekintése<\/h2>/);
  assert.doesNotMatch(page, /gridColumn:\s*"1\/-1"/);
});

test("admin support displays Hungarian status labels but preserves server-side status values", () => {
  const page = read("app/system-admin/support/page.tsx");
  for (const [status, label] of Object.entries({
    open: "Nyitott", in_progress: "Folyamatban", submitted: "Ellenőrzésre vár", done: "Lezárt",
  })) {
    assert.ok(page.includes(`${status}: "${label}"`), `Hiányzó magyar státusz: ${status}`);
    assert.ok(page.includes(`<option value="${status}">${label}</option>`), `Hiányzó belső érték: ${status}`);
  }
  assert.match(page, /statusLabel\(task\.status\)/);
  assert.doesNotMatch(page, /<span className="user-pill">\{task\.status\}<\/span>/);
});

test("admin support correction form stays inside phone cards and retains audited action", () => {
  const page = read("app/system-admin/support/page.tsx");
  const css = read("app/system-admin/support/support.module.css");
  assert.match(page, /<form action=\{adminUpdateTaskStatus\} className=\{styles\.repairForm\}>/);
  assert.match(page, /name="reason"[^>]+minLength=\{8\} required/);
  assert.match(page, /name="task_id" value=\{task\.id\}/);
  assert.match(css, /\.taskCard\{[^}]*min-width:0;max-width:100%/);
  assert.match(css, /\.repairForm\{[^}]*grid-template-columns:minmax\(150px,\.7fr\) minmax\(0,2fr\) auto/);
  assert.match(css, /\.repairForm select,\.repairForm input:not\(\[type="hidden"\]\)\{[^}]*max-width:100%;min-width:0;box-sizing:border-box/);
  const phoneRules = css.slice(css.indexOf("@media(max-width:700px)"));
  assert.match(phoneRules, /\.repairForm\{grid-template-columns:minmax\(0,1fr\)\}/);
});
