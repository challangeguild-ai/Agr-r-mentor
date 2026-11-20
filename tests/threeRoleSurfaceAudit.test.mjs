import test from "node:test";
import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("every role's phone drawer has one scrollable surface and all links remain in flow", () => {
  for (const name of ["FarmerSidebar", "AdvisorSidebar", "SystemAdminSidebar"]) {
    const css = read(`components/${name}.module.css`);
    const lastMobile = css.slice(css.lastIndexOf("@media(max-width:767px)"));
    assert.match(lastMobile, /\.sidebar\{[^}]*overflow-y:auto/, name);
    assert.match(lastMobile, /\.nav\{[^}]*flex:none;min-height:max-content;overflow:visible/, name);
  }
  const farmer = read("components/Sidebar.tsx");
  assert.match(farmer, /aria-label="Gazdálkodói menü"/);
  assert.match(farmer, /aria-controls="farmer-navigation-drawer"/);
  assert.match(farmer, /if\(event\.key==="Escape"\)setOpen\(false\)/);
  const advisor = read("components/AdvisorSidebar.tsx");
  assert.match(advisor, /aria-label="Szaktanácsadói menü"/);
  assert.match(advisor, /aria-expanded=\{open\} aria-controls="advisor-navigation-drawer"/);
  assert.match(advisor, /if\(event\.key==="Escape"\)setOpen\(false\)/);
});

test("advisor report filters do not force three columns on a phone", () => {
  const page = read("app/admin/reports/page.tsx");
  const css = read("app/admin/AdminLayout.module.css");
  assert.match(page, /className="report-filter-bar"/);
  assert.match(css, /\.report-filter-bar\)\{grid-template-columns:minmax\(0,1fr\)!important/);
  assert.match(css, /\.report-filter-bar select\)\{[^}]*min-width:0/);
});

test("advisor and system admin keyboard users can see focused form controls", () => {
  for (const path of ["app/admin/AdminLayout.module.css", "app/system-admin/SystemAdminLayout.module.css"]) {
    const css = read(path);
    assert.match(css, /input:focus-visible/);
    assert.match(css, /outline:3px solid var\(--agrar-ui-focus\)!important/);
  }
});

test("field worker's statistics and actions wrap instead of overflowing phone width", () => {
  const worker = read("app/work/page.tsx");
  const css = read("app/role-design-system.css");
  assert.match(worker, /className="worker-page-header"/);
  assert.match(worker, /className="worker-summary-stats"/);
  assert.match(css, /\.worker-page-header\{flex-wrap:wrap/);
  assert.match(css, /\.worker-summary-stats\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
});

test("farmer dashboard uses locally maintained agricultural hero imagery", () => {
  assert.ok(existsSync(new URL("../public/images/agrar-fields-sunrise.webp", import.meta.url)));
  const css = read("app/dashboard/dashboard.module.css");
  assert.match(css, /url\("\/images\/agrar-fields-sunrise\.webp"\)/);
  assert.doesNotMatch(css, /upload\.wikimedia\.org/);
});
