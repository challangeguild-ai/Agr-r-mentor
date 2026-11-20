import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

test("the web UI and action require database policy v2 before manual HU logging",()=>{
 const action=read("app/operations/actions.ts");
 const catalog=read("app/api/operation-catalog/route.ts");
 assert.match(action,/policyVersion!==2/);
 assert.match(catalog,/policyVersion===2/);
 assert.match(action,/validateManualPlantProtection\(/);
 const detail=read("app/operations/[id]/page.tsx");
 assert.match(detail,/reg\.permit_check_attested===true/);
 assert.match(detail,/nincs tárolt engedélyokirat-ellenőrzési nyilatkozat/);
});

test("the web insert persists the farmer's permit-check statement only on a manual HU operation",()=>{
 const action=read("app/operations/actions.ts");
 assert.match(action,/spraying&&!checked&&countryCode==="HU"\?\{permit_check_attested:formData\.get\("manual_permit_checked"\)==="on"\}/);
});
