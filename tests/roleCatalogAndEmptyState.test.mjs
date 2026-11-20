import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

test("advisor plant-protection import forms keep wide fields usable on phones",()=>{
 const component=read("app/admin/plant-protection-import/ImportForm.tsx");
 const css=read("app/admin/plant-protection-import/ImportForm.module.css");
 assert.match(component,/className=\{`admin-form \$\{styles\.catalogForm\}`\}/);
 assert.equal((component.match(/className=\{styles\.wide\}/g)||[]).length,6);
 assert.doesNotMatch(component,/gridTemplateColumns:"1fr 1fr"/);
 assert.doesNotMatch(component,/className="operation-wide"/);
 assert.match(css,/\.catalogForm\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:767px\)\{[\s\S]*\.catalogForm\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.match(css,/\.submit\{grid-column:auto;width:100%\}/);
 assert.match(css,/var\(--agrar-ui-accent\)/);
 assert.match(component,/role="progressbar" aria-label="ÚKSÚP feldolgozás"/);
});

test("advisor catalog statuses are Hungarian instead of raw database values",()=>{
 const page=read("app/admin/plant-protection-import/page.tsx");
 assert.match(page,/status==="ready"\)return"Betöltve"/);
 assert.match(page,/status==="pending"\)return"Importálásra vár"/);
 assert.match(page,/catalogStatusLabel\(s\?\.status\)/);
});

test("rarely used advisor and administrator views explain empty lists",()=>{
 const machines=read("app/admin/machines/page.tsx");
 const security=read("app/system-admin/security/page.tsx");
 assert.match(machines,/!machines\?\.length&&<p className="empty-state" role="status">/);
 assert.match(security,/rows\.length === 0 && <p className="empty-state" role="status">/);
});
