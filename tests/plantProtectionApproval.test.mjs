import test from "node:test";
import assert from "node:assert/strict";
import {requiresPlantProtectionApprover,licenseAllowsCategory,regulatoryCategory} from "../lib/plantProtectionApproval.ts";

test("Hungarian category I and II require a farm approver even without extra flags",()=>{
 for(const category of ["I","I.","II","II."])
  assert.equal(requiresPlantProtectionApprover("HU",{regulatory_category:category}),true,category);
 assert.equal(requiresPlantProtectionApprover("HU",{regulatory_category:"III"}),false);
});
test("explicit approval and professional-use flags work in both countries",()=>{
 assert.equal(requiresPlantProtectionApprover("SK",{regulatory_category:"I"}),false);
 assert.equal(requiresPlantProtectionApprover("SK",{prescription_required:true}),true);
 assert.equal(requiresPlantProtectionApprover("HU",{professional_use_only:true}),true);
 assert.equal(requiresPlantProtectionApprover("SK",{approval_required:true}),true);
});
test("license category ordering cannot allow II or III operators to approve category I",()=>{
 assert.equal(licenseAllowsCategory("I","I."),true);
 assert.equal(licenseAllowsCategory("II","I."),false);
 assert.equal(licenseAllowsCategory("III","I."),false);
 assert.equal(licenseAllowsCategory("I","II"),true);
 assert.equal(licenseAllowsCategory("II","II."),true);
 assert.equal(licenseAllowsCategory("III","II"),false);
});
test("unknown licenses are not treated as valid, category labels are normalized",()=>{
 assert.equal(regulatoryCategory(" ii. "),"II");
 assert.equal(licenseAllowsCategory(null,"III"),false);
 assert.equal(licenseAllowsCategory("III","III"),true);
});
