package hu.agrarmentor.android.data

import java.time.LocalDate

/** Mirrors the farm-side and personal plant-protection license checks on the web. */
internal object OperationApprovalRules {
 fun levelAllows(level:String,category:String?):Boolean {
  val normalized=category.orEmpty().trim().removeSuffix(".").uppercase()
  return when(normalized){
   "I"->level=="I"
   "II"->level=="I"||level=="II"
   else->level in setOf("I","II","III")
  }
 }

 fun activeLicense(active:Boolean,validUntil:String?,today:LocalDate):Boolean =
  active&&!validUntil.isNullOrBlank()&&runCatching{LocalDate.parse(validUntil.take(10))>=today}.getOrDefault(false)

 fun activeFarmAssignment(active:Boolean,validUntil:String?,today:LocalDate):Boolean =
  active&&(validUntil.isNullOrBlank()||runCatching{LocalDate.parse(validUntil.take(10))>=today}.getOrDefault(false))

 fun canApprove(required:Boolean,status:String,requestedApproverId:String,userId:String):Boolean =
  required&&status=="pending"&&requestedApproverId==userId
}
