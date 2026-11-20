package hu.agrarmentor.android.data

/** Shared validation for the native report workflow; RLS remains authoritative. */
internal object ReportWorkflowRules {
 private val categories=setOf("crop_health","pest","disease","weed","water","weather","soil","machine","work","other")
 private val severities=setOf("normal","high","urgent")

 fun validDraft(title:String,message:String,category:String,severity:String):Boolean =
  title.trim().length in 1..200&&message.length<=5000&&category in categories&&severity in severities

 fun sameDraft(a:ReportDraftIdentity,b:ReportDraftIdentity)=a==b

 fun canRespond(status:String,close:Boolean,reply:String):Boolean =
  (status!="closed"||close)&& (close||reply.trim().isNotEmpty()&&reply.length<=5000)
}

internal data class ReportDraftIdentity(
 val fieldId:String,val title:String,val message:String,val category:String,val severity:String,
 val mediaKeys:List<String> = emptyList()
)
