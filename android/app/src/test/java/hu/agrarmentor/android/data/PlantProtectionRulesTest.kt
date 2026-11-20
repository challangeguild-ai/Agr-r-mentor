package hu.agrarmentor.android.data

import org.junit.Assert.*
import org.junit.Test

class PlantProtectionRulesTest {
 @Test fun hungarianUnknownAndExpiredStatusesFailClosed(){
  val date="2026-11-20"
  assertNotNull(PlantProtectionRules.blockedStatus("HU",date,true,null,null,"unknown",null))
  assertNotNull(PlantProtectionRules.blockedStatus("HU",date,true,null,null,"withdrawn_grace","2026-11-19"))
  assertNull(PlantProtectionRules.blockedStatus("HU",date,true,null,"2026-11-19","withdrawn_grace","2026-11-21"))
  assertNotNull(PlantProtectionRules.blockedStatus("HU",date,true,"2026-11-21",null,"valid",null))
  assertNotNull(PlantProtectionRules.blockedStatus("HU",date,false,null,null,"valid",null))
 }

 @Test fun requiredApprovalAndOfficialDoseRange(){
  assertTrue(PlantProtectionRules.requiresApprover("HU","I",false,false,false))
  assertTrue(PlantProtectionRules.requiresApprover("SK",null,false,true,false))
  assertFalse(PlantProtectionRules.requiresApprover("HU","III",false,false,false))
  assertTrue(PlantProtectionRules.validDose(2.0,1.0,3.0))
  assertFalse(PlantProtectionRules.validDose(4.0,1.0,3.0))
  assertFalse(PlantProtectionRules.validDose(null,1.0,3.0))
 }
}
