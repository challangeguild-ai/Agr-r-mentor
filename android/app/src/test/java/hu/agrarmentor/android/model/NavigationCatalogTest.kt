package hu.agrarmentor.android.model

import org.junit.Assert.*
import org.junit.Test

class NavigationCatalogTest {
 @Test fun allRoleMenusHaveUniqueRoutes() {
  for(role in PortalRole.entries){
   val routes=NavigationCatalog.menu(role).map{it.route}
   assertEquals(role.title,routes.size,routes.toSet().size)
  }
 }
 @Test fun allRolesHaveFourShortcutsPlusMenuButton() {
  for(role in PortalRole.entries){
   val tabs=NavigationCatalog.tabs(role)
   assertEquals(4,tabs.size)
   assertTrue(tabs.all{NavigationCatalog.menu(role).contains(it)})
  }
 }
 @Test fun advisorCannotSelectAdminRoleWithoutAuthorization() {
  assertEquals(RoleDecision.MfaRequired,PortalRoleResolver.resolve(VerifiedProfile("advisor","admin","aal1")))
  assertEquals(RoleDecision.Granted(PortalRole.SYSTEM_ADMIN),PortalRoleResolver.resolve(VerifiedProfile("advisor","admin","aal2")))
  assertEquals(RoleDecision.Granted(PortalRole.ADVISOR),PortalRoleResolver.resolve(VerifiedProfile("advisor",null,"aal2")))
  assertEquals(RoleDecision.Granted(PortalRole.FARMER),PortalRoleResolver.resolve(VerifiedProfile("farmer",null,"aal1")))
  assertEquals(RoleDecision.Denied,PortalRoleResolver.resolve(VerifiedProfile("visitor",null,"aal2")))
 }
 @Test fun deepPagesKeepContext() {
  assertEquals("/fields",NavigationCatalog.activeTab(PortalRole.FARMER,"/fields/123/hotspots"))
  assertEquals("/admin/clients",NavigationCatalog.activeTab(PortalRole.ADVISOR,"/admin/clients/123"))
  assertEquals("/system-admin/support",NavigationCatalog.activeTab(PortalRole.SYSTEM_ADMIN,"/system-admin/support"))
  assertNull(NavigationCatalog.activeTab(PortalRole.SYSTEM_ADMIN,"/system-admin/weather"))
  assertNull(NavigationCatalog.activeTab(PortalRole.ADVISOR,"/admin/backup"))
 }
}
