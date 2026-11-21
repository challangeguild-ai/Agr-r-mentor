import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,join} from "node:path";
import {matchingCatalogCrop,normalizeCatalogCrop} from "../lib/plantRecommendationCrop.ts";

const root=join(dirname(fileURLToPath(import.meta.url)),"..");
const source=path=>readFileSync(join(root,path),"utf8");

test("field crop matches official catalog despite accents, whitespace or casing",()=>{
 assert.equal(normalizeCatalogCrop("  ŐSZI  BÚZA  "),"oszi buza");
 assert.equal(matchingCatalogCrop("Őszi búza",["Kukorica","oszi buza"]),"oszi buza");
 assert.equal(matchingCatalogCrop("kukorica",["Kukorica","Búza"]),"Kukorica");
});

test("unknown crop is never guessed into a pesticide authorization",()=>{
 assert.equal(matchingCatalogCrop("Kukorica",["Napraforgó","Búza"]),"");
 assert.equal(matchingCatalogCrop(null,["Kukorica"]),"");
 assert.equal(matchingCatalogCrop("Búza",[]),"");
});

test("recommendation entry and official-use checks are reachable from advisor web pages",()=>{
 const nav=source("components/AdminNav.tsx");
 const tasks=source("app/admin/tasks/page.tsx");
 const form=source("components/OperationTaskPlanForm.tsx");
 const action=source("app/admin/tasks/operation-actions.ts");
 const tour=source("components/GuidedTour.tsx");
 assert.match(nav,/\/admin\/tasks#operation-plan/);
 assert.match(tasks,/id="operation-plan"/);
 assert.match(tasks,/OperationTaskPlanForm/);
 assert.match(form,/matchingCatalogCrop\(/);
 assert.match(form,/setUseId\(id\);setDose\(""\)/);
 assert.match(form,/fieldId&&uses\.length===0&&!error/);
 assert.match(form,/fields\.length===0/);
 assert.match(form,/!crop\|\|!productId\|\|!useId\|\|!dose\.trim\(\)/);
 assert.match(action,/plannedDose<=0/);
 assert.match(action,/productUseBlockingReason/);
 assert.match(action,/licenseCoversDate/);
 assert.match(tour,/advisor-recommendations/);
});
