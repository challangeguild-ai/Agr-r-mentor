package hu.agrarmentor.android.data

/** Shared native preflight. Server-side permits, regulatory trigger and RLS are the authority. */
internal object PlantProtectionRules {
 fun blockedStatus(country:String,date:String,active:Boolean,validFrom:String?,validUntil:String?,
  regulatoryStatus:String?,graceUntil:String?):String? {
  if(!active)return "A készítmény nem aktív."
  if(!OperationCreateRules.validDate(date))return "Érvénytelen végrehajtási dátum."
  if(!validFrom.isNullOrBlank()&&date<validFrom)return "A készítmény engedélye még nem volt érvényes."
  val status=regulatoryStatus.orEmpty().trim().lowercase()
  val grace=graceUntil.orEmpty()
  if(country=="HU"){
   if(status.isBlank()||status=="unknown")return "A magyar hatósági státusz nem igazolt."
   if(status=="not_applicable"&&(grace.isBlank()||date>grace))return "A készítmény ezen a napon Magyarországon nem alkalmazható."
   if(status=="withdrawn_grace"&&(grace.isBlank()||date>grace))return "A visszavont készítmény türelmi ideje lejárt vagy nem igazolt."
  }
  val withinGrace=country=="HU"&&status in setOf("not_applicable","withdrawn_grace")&&
   grace.isNotBlank()&&date<=grace
  if(!validUntil.isNullOrBlank()&&date>validUntil&&!withinGrace)return "A készítmény engedélye lejárt."
  return null
 }

 fun requiresApprover(country:String,category:String?,approvalRequired:Boolean,professionalOnly:Boolean,prescription:Boolean):Boolean{
  val normalized=category.orEmpty().trim().removeSuffix(".").uppercase()
  return approvalRequired||professionalOnly||prescription||(country=="HU"&&normalized in setOf("I","II"))
 }

 fun validDose(value:Double?,minimum:Double?,maximum:Double?):Boolean =
  (minimum==null&&maximum==null&&value==null)||
   (value!=null&&value>=0&&(minimum==null||value>=minimum)&&(maximum==null||value<=maximum))
}
