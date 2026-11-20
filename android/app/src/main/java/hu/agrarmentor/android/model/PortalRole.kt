package hu.agrarmentor.android.model

enum class PortalRole(val title:String){
 FARMER("Gazdálkodó"),
 ADVISOR("Szaktanácsadó"),
 SYSTEM_ADMIN("Rendszeradmin")
}

/** The server-side profiles table is the authority, never a user-selectable UI flag. */
data class VerifiedProfile(
 val role:String?,
 val systemRole:String?,
 val authenticatorAssuranceLevel:String?
)

sealed interface RoleDecision {
 data class Granted(val portal:PortalRole):RoleDecision
 data object MfaRequired:RoleDecision
 data object Denied:RoleDecision
}

object PortalRoleResolver {
 /** Mirrors existing web portal routing rules; the server still enforces RLS. */
 fun resolve(profile:VerifiedProfile):RoleDecision = when {
  profile.role=="advisor" && profile.systemRole=="admin" -> {
   if(profile.authenticatorAssuranceLevel=="aal2")RoleDecision.Granted(PortalRole.SYSTEM_ADMIN)
   else RoleDecision.MfaRequired
  }
  profile.role=="advisor" -> {
   if(profile.authenticatorAssuranceLevel=="aal2")RoleDecision.Granted(PortalRole.ADVISOR)
   else RoleDecision.MfaRequired
  }
  profile.role=="farmer" -> RoleDecision.Granted(PortalRole.FARMER)
  else -> RoleDecision.Denied
 }
}
