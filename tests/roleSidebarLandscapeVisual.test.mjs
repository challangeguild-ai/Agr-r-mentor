import test from "node:test";
import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("all three role sidebars share the existing agricultural landscape artwork", () => {
  const imagePath = new URL("../public/images/agrar-fields-sunrise.webp", import.meta.url);
  assert.ok(existsSync(imagePath), "A meglévő mezőgazdasági tájkép hiányzik");

  for (const [component, stylesheet] of [
    ["Sidebar.tsx", "FarmerSidebar.module.css"],
    ["AdvisorSidebar.tsx", "AdvisorSidebar.module.css"],
    ["SystemAdminSidebar.tsx", "SystemAdminSidebar.module.css"],
  ]) {
    const tsx = read(`components/${component}`);
    const css = read(`components/${stylesheet}`);
    assert.match(tsx, /<div className=\{styles\.landscape\} aria-hidden="true"\s*\/>/, `${component}: tájképelem hiányzik`);
    assert.match(css, /\.landscape\{[^}]*url\("\/images\/agrar-fields-sunrise\.webp"\)/, `${stylesheet}: kép nincs beállítva`);
    assert.ok(tsx.indexOf("className={styles.landscape}") < tsx.indexOf("className={styles.account}") || component === "Sidebar.tsx", `${component}: a tájkép legyen a fiókrész fölött`);
  }
});

test("advisor and admin landscape never covers menu controls and adapts on shorter screens", () => {
  for (const component of ["AdvisorSidebar", "SystemAdminSidebar"]) {
    const tsx = read(`components/${component}.tsx`);
    const css = read(`components/${component}.module.css`);
    const help = tsx.indexOf("className={styles.help}");
    const image = tsx.indexOf("className={styles.landscape}");
    const account = tsx.indexOf("className={styles.account}");
    assert.ok(help >= 0 && help < image && image < account, `${component}: a menü alsó elemeinek sorrendje hibás`);
    assert.match(css, /\.landscape\{[^}]*flex:0 0 78px/);
    assert.match(css, /@media\(max-height:780px\)\{\.landscape\{flex-basis:52px;min-height:52px\}\}/);
  }
});

test("mobile role drawers scroll as one surface without hiding their last links", () => {
  for (const component of ["AdvisorSidebar", "SystemAdminSidebar"]) {
    const css = read(`components/${component}.module.css`);
    const mobileRules = css.slice(css.lastIndexOf("/* Keep all nine advisor destinations") >= 0
      ? css.lastIndexOf("/* Keep all nine advisor destinations")
      : css.lastIndexOf("/* One scrolling surface"));
    assert.match(mobileRules, /\.sidebar\{[^}]*overflow-y:auto/, component);
    assert.match(mobileRules, /\.nav\{[^}]*flex:none;min-height:max-content;overflow:visible/, component);
  }
});
