import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

test("accepted reference screens keep all six real farmer routes",()=>{
 const sidebar=read("components/Sidebar.tsx");
 for(const route of ["/fields","/operations","/tasks","/messages","/documents"])
  assert.ok(sidebar.includes(`"${route}"`),`Missing ${route} from navigation`);
 assert.match(sidebar,/styles\.userFooter/);
 assert.match(sidebar,/styles\.landscape/);
});

test("field cards and the interactive map/list switch use real field data",()=>{
 const page=read("app/fields/page.tsx");
 const styles=read("app/fields/fields.module.css");
 assert.match(page,/requestedMode==="map"\|\|requestedMode==="list"/);
 assert.match(page,/mode=map/);
 assert.match(page,/mode=list/);
 assert.match(page,/data-mode=\{mode\}/);
 assert.match(page,/&mode=\$\{mode\}/);
 assert.match(page,/FieldMiniMap/);
 assert.match(page,/FieldsOverviewMap/);
 assert.match(styles,/\.workspace\[data-mode="map"\] \.list\{display:none\}/);
 assert.match(styles,/\.workspace\[data-mode="auto"\] \.map/);
});

test("field health indicates the actual inspection state, not a made-up score",()=>{
 const page=read("app/fields/[id]/page.tsx");
 assert.match(page,/id="allapot"/);
 assert.match(page,/aria-label=\{`Növényállapot:/);
 assert.match(page,/conditionLabel\(latestInspection\?\.condition\)/);
 assert.doesNotMatch(page,/condition==="good"\?"72"/);
 assert.doesNotMatch(page,/condition==="attention"\?"48"/);
 assert.doesNotMatch(page,/condition==="critical"\?"24"/);
});

test("task creation and document/message actions retain their existing workflows",()=>{
 const tasks=read("app/tasks/page.tsx");
 const docs=read("components/DocumentLibrary.tsx");
 const messages=read("app/messages/page.tsx");
 assert.match(tasks,/href="\/dispatch">\+ Új teendő/);
 assert.match(docs,/createSignedUrl\(d\.storage_path,60\)/);
 assert.match(docs,/deleteDocument\(d\.id\)/);
 assert.match(messages,/href=\{`\/fields\/\$\{selected\.field_id\}`\}/);
 assert.doesNotMatch(messages,/<textarea/);
});

test("six reference sections preserve responsive views and readable controls",()=>{
 for(const path of [
  "app/fields/fields.module.css",
  "app/fields/[id]/field-detail.module.css",
  "app/operations/operations.module.css",
  "app/tasks/tasks.module.css",
  "app/messages/messages.module.css",
  "app/documents/documents.module.css",
  "components/DocumentLibrary.module.css",
 ]){
  const css=read(path);
  assert.match(css,/@media\(max-width:767px\)/,`${path}: mobile breakpoint missing`);
  assert.match(css,/font-size:1[2-6]px/,`${path}: no readable text sizing`);
 }
});
