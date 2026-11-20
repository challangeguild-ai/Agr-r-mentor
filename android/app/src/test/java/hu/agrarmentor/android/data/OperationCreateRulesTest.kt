package hu.agrarmentor.android.data

import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate

class OperationCreateRulesTest {
 @Test fun excludesRegulatedSprayingWithoutOfficialCatalog(){
  assertFalse(OperationCreateRules.validDetails("spraying","2026-11-20","","",""))
  assertFalse(OperationCreateRules.validDetails("plant_protection","2026-11-20","","",""))
  assertTrue(OperationCreateRules.validDetails("harvest","2026-11-20","","",""))
  assertFalse(OperationCreateRules.validDetails("fertilizing","2026-11-20","","",""))
  assertTrue(OperationCreateRules.validDetails("fertilizing","2026-11-20","","NPK",""))
 }

 @Test fun rejectsImpossibleDatesAndInvalidAmounts(){
  assertFalse(OperationCreateRules.validDate("2026-02-30"))
  assertFalse(OperationCreateRules.validDate("2026-11-21",LocalDate.parse("2026-11-20")))
  assertEquals(2.5,OperationCreateRules.parseAmount("2,5")!!,0.00001)
  assertNull(OperationCreateRules.parseAmount(""))
  assertThrows(IllegalArgumentException::class.java){OperationCreateRules.parseAmount("2.4abc")}
  assertFalse(OperationCreateRules.validNumbers(10.1,10.0,null,null))
  assertFalse(OperationCreateRules.validNumbers(0.0,10.0,null,null))
  assertFalse(OperationCreateRules.validNumbers(4.0,10.0,-0.1,null))
  assertTrue(OperationCreateRules.validNumbers(4.0,10.0,0.0,0.0))
 }
}
