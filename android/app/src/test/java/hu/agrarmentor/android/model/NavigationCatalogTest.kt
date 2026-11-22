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
 @Test fun sensitiveDatabaseExportIsAdminOnly(){
  assertFalse(NavigationCatalog.advisor.any{it.route=="/admin/backup"})
  assertTrue(NavigationCatalog.admin.any{it.route=="/system-admin/backup"})
 }
 @Test fun fieldDetailsReturnToTheProperRoleMap(){
  assertEquals("/fields",NavigationCatalog.fieldDetailBackRoute(PortalRole.FARMER))
  assertEquals("/admin/map",NavigationCatalog.fieldDetailBackRoute(PortalRole.ADVISOR))
  assertEquals("/system-admin",NavigationCatalog.fieldDetailBackRoute(PortalRole.SYSTEM_ADMIN))
 }
 @Test fun adminInventoryLinksAreNativeAndRestrictedToSystemAdmins(){
  for(path in listOf("/system-admin/farms","/system-admin/fields")){
   assertTrue(NavigationCatalog.admin.any{it.route==path})
   assertFalse(NavigationCatalog.advisor.any{it.route==path})
   assertFalse(NavigationCatalog.farmer.any{it.route==path})
  }
 }
 @Test fun everyRoleHasItsOwnAccountPage(){
  val profiles=mapOf(
   PortalRole.FARMER to "/profile",
   PortalRole.ADVISOR to "/admin/profile",
   PortalRole.SYSTEM_ADMIN to "/system-admin/profile"
  )
  for((role,route) in profiles){
   assertTrue(NavigationCatalog.menu(role).any{it.route==route})
   for(other in PortalRole.entries.filter{it!=role}){
    assertFalse(NavigationCatalog.menu(other).any{it.route==route})
   }
  }
 }
 @Test fun plantRecommendationsAreAdvisorOnly(){
  assertTrue(NavigationCatalog.advisor.any{it.route=="/admin/recommendations"})
  assertFalse(NavigationCatalog.farmer.any{it.route=="/admin/recommendations"})
  assertFalse(NavigationCatalog.admin.any{it.route=="/admin/recommendations"})
 }
 @Test fun financialNumbersAreOnlyOnFarmerNavigation(){
  assertTrue(NavigationCatalog.farmer.any{it.route=="/profit"})
  assertTrue(NavigationCatalog.advisor.any{it.route=="/admin/profit"})
  assertFalse(NavigationCatalog.advisor.any{it.route=="/profit"})
  assertFalse(NavigationCatalog.admin.any{it.route=="/profit"})
 }
}
