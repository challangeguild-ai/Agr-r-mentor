import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

test("advisor mobile dashboard keeps priority action visible and reachable",()=>{
 const page=read("app/admin/page.tsx");
 const css=read("app/admin/admin-dashboard.module.css");
 const head=page.slice(page.indexOf("styles.alertHead"),page.indexOf("styles.alertGrid"));
 assert.match(head,/<Link href="\/admin\/priorities">Mai prioritások →<\/Link>/);
 assert.ok(css.lastIndexOf(".alertHead a{display:inline-flex")>css.lastIndexOf(".alertHead a{display:none}"),"Mobile styling must restore the priority link");
 assert.match(css,/\.alertHead a\{display:inline-flex;align-items:center;min-height:44px/);
});

test("advisor dashboard stays below the mobile header with readable cards",()=>{
 const css=read("app/admin/admin-dashboard.module.css");
 assert.match(css,/\.topbar\{position:relative;top:auto;z-index:auto/);
 assert.match(css,/\.quickCard small\{font-size:11\.5px/);
 assert.match(css,/\.clientFocusTop small\{font-size:11\.5px/);
 assert.match(css,/\.alert small\{font-size:11\.5px;line-height:1\.4;white-space:normal/);
 assert.match(css,/\.row small,\.row time\{font-size:11\.5px/);
});
