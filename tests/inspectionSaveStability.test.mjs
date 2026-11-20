import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {encodeHotspot,decodeHotspot,HOTSPOT_EVENT} from "../lib/hotspots.ts";

const action=readFileSync(new URL("../app/admin/inspectionActions.ts",import.meta.url),"utf8");
const form=readFileSync(new URL("../app/admin/InspectionForm.tsx",import.meta.url),"utf8");

test("inspection-associated GPS problem markers remain readable on the hotspot map",()=>{
 const item={type:"other",severity:"critical",lat:47.515,lng:19.91,notes:"Kártevő a tábla szélén",resolved:false,resolvedAt:null};
 assert.deepEqual(decodeHotspot(encodeHotspot(item)),item);
 assert.equal(HOTSPOT_EVENT,"field_hotspot");
 assert.match(action,/event_type:HOTSPOT_EVENT/);
 assert.match(action,/description:encodeHotspot\(/);
 assert.match(action,/item\?\.lat!=null&&item\?\.lng!=null/);
});

test("a saved inspection is never rejected solely because a task, notification or timeline write failed",()=>{
 const primaryWrite=action.indexOf('from("inspections").insert(payload)');
 const warningStart=action.indexOf("const warnings:string[]=[]");
 const taskWrite=action.indexOf('from("tasks").insert({');
 assert.ok(primaryWrite>=0&&warningStart>primaryWrite&&taskWrite>warningStart);
 assert.match(action,/if\(error\|\|!task\)warnings\.push/);
 assert.match(action,/return\{id:inspection\.id,warnings\}/);
 assert.match(action,/if\(!optionalDate\(inspectedAt\)\|\|!optionalDate\(taskDue\)\|\|!optionalDate\(nextCheck\)\)/);
});

test("inspection media upload retries target the existing inspection without duplicating confirmed files",()=>{
 assert.match(form,/if\(!inspectionIdRef\.current\)\{/);
 assert.match(form,/inspectionIdRef\.current=result\.id/);
 assert.match(form,/selectedFilesRef\.current=files/);
 assert.match(form,/formData\.delete\("media"\)/);
 assert.ok(form.indexOf("formData.delete(\"media\")")<form.indexOf("await createInspection(formData)"));
 assert.match(form,/if\(linkedFilesRef\.current\.has\(index\)\)continue/);
 assert.match(form,/savedPathsRef\.current\.get\(index\)/);
 assert.match(form,/\.eq\("inspection_id",inspectionId\)\.eq\("storage_path",path\)\.maybeSingle\(\)/);
 assert.match(form,/if\(submittingRef\.current\|\|completed\)return/);
 assert.match(form,/Hiányzó csatolmányok újrapróbálása/);
 assert.doesNotMatch(form,/window\.location\.reload\(/);
});
