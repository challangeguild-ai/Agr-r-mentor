package hu.agrarmentor.android.data

import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate

class OperationApprovalRulesTest {
 @Test fun restrictedCategoriesRequireMatchingLevel(){
  assertTrue(OperationApprovalRules.levelAllows("I","I."))
  assertFalse(OperationApprovalRules.levelAllows("II","I"))
  assertTrue(OperationApprovalRules.levelAllows("II","II"))
  assertTrue(OperationApprovalRules.levelAllows("I","II"))
  assertFalse(OperationApprovalRules.levelAllows("III","II"))
 }

 @Test fun expiredOrMissingPermitCannotBeUsed(){
  val now=LocalDate.parse("2026-11-20")
  assertTrue(OperationApprovalRules.activeLicense(true,"2026-11-20",now))
  assertFalse(OperationApprovalRules.activeLicense(true,"2026-11-19",now))
  assertFalse(OperationApprovalRules.activeLicense(false,"2030-01-01",now))
  assertFalse(OperationApprovalRules.activeLicense(true,null,now))
  assertTrue(OperationApprovalRules.activeFarmAssignment(true,null,now))
  assertFalse(OperationApprovalRules.activeFarmAssignment(true,"2026-11-19",now))
 }

 @Test fun onlyDesignatedUserMayApprovePendingOperation(){
  assertTrue(OperationApprovalRules.canApprove(true,"pending","own","own"))
  assertFalse(OperationApprovalRules.canApprove(true,"approved","own","own"))
  assertFalse(OperationApprovalRules.canApprove(true,"pending","other","own"))
  assertFalse(OperationApprovalRules.canApprove(false,"pending","own","own"))
 }
}
