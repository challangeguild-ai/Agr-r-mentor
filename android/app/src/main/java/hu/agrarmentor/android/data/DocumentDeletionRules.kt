package hu.agrarmentor.android.data

import hu.agrarmentor.android.model.PortalRole

/** Mirror the documents DELETE RLS: original uploader or an agricultural advisor. */
internal object DocumentDeletionRules {
 fun canDelete(role:PortalRole,actorId:String,uploadedBy:String):Boolean =
  validMapFieldId(actorId)&&validMapFieldId(uploadedBy)&&
   (role==PortalRole.ADVISOR||role==PortalRole.FARMER&&actorId==uploadedBy)

 fun safeStoredPath(uploadedBy:String,path:String):Boolean =
  validMapFieldId(uploadedBy)&&path.startsWith("$uploadedBy/")&&
   path.split('/').all{it.isNotBlank()&&it!="."&&it!=".."&&!it.contains('\\')}
}
