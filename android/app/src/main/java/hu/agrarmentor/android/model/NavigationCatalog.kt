package hu.agrarmentor.android.model

/** One application, three role-specific navigations; URLs are mapped to mobile routes. */
data class MobileDestination(val route:String,val title:String,val group:String)

object NavigationCatalog {
 val farmer=listOf(
  MobileDestination("/dashboard","Áttekintés","Napi munka"),
  MobileDestination("/daily-work","Mai prioritások","Napi munka"),
  MobileDestination("/operations","Műveleti napló","Napi munka"),
  MobileDestination("/operations/approvals","Jóváhagyások","Napi munka"),
  MobileDestination("/tasks","Teendők","Napi munka"),
  MobileDestination("/dispatch","Munkakiosztás","Napi munka"),
  MobileDestination("/timeline","Idővonal","Napi munka"),
  MobileDestination("/farms","Gazdaságom","Gazdaság"),
  MobileDestination("/fields","Táblák","Gazdaság"),
  MobileDestination("/map","Térkép","Gazdaság"),
  MobileDestination("/team","Munkatársak","Gazdaság"),
  MobileDestination("/machines","Géppark","Gazdaság"),
  MobileDestination("/invoices","Számlák","Gazdaság"),
  MobileDestination("/messages","Üzenetek","Kapcsolat és adatok"),
  MobileDestination("/documents","Dokumentumok","Kapcsolat és adatok"),
  MobileDestination("/notifications","Értesítések","Kapcsolat és adatok"),
  MobileDestination("/profile","Profil és beállítások","Fiók"),
  MobileDestination("/work","Munkaterület","Fiók")
 )
 val advisor=listOf(
  MobileDestination("/admin","Kezdőlap","Napi munka"),
  MobileDestination("/admin/daily-work","Mai prioritások","Napi munka"),
  MobileDestination("/admin/workday","Munkanap","Napi munka"),
  MobileDestination("/admin/tasks","Feladatok","Napi munka"),
  MobileDestination("/admin/operations","Műveletek","Napi munka"),
  MobileDestination("/admin/inspections","Szemlék","Napi munka"),
  MobileDestination("/admin/visits","Látogatások","Napi munka"),
  MobileDestination("/admin/priorities","Prioritások","Napi munka"),
  MobileDestination("/admin/clients","Ügyfelek","Ügyfelek és csapat"),
  MobileDestination("/admin/contacts","Elérhetőségek","Ügyfelek és csapat"),
  MobileDestination("/admin/portfolio","Portfólió","Ügyfelek és csapat"),
  MobileDestination("/admin/team","Munkatársak","Ügyfelek és csapat"),
  MobileDestination("/admin/machines","Gépek","Ügyfelek és csapat"),
  MobileDestination("/admin/supervision","Felügyelet","Ügyfelek és csapat"),
  MobileDestination("/admin/map","Térkép","Szakmai eszközök"),
  MobileDestination("/admin/map/proposals","Határjavaslatok","Szakmai eszközök"),
  MobileDestination("/admin/map/quality","Határminőség","Szakmai eszközök"),
  MobileDestination("/admin/map/import","Térképimport","Szakmai eszközök"),
  MobileDestination("/admin/plant-protection-import","Növényvédelem","Szakmai eszközök"),
  MobileDestination("/admin/recommendations","Növényvédelmi ajánlások","Szakmai eszközök"),
  MobileDestination("/admin/documents","Dokumentumok","Szakmai eszközök"),
  MobileDestination("/admin/timeline","Idővonal","Szakmai eszközök"),
  MobileDestination("/admin/reports","Jelentések","Szakmai eszközök"),
  MobileDestination("/admin/profile","Profil és beállítások","Fiók")
 )
 val admin=listOf(
  MobileDestination("/system-admin","Rendszeráttekintés","Rendszer"),
  MobileDestination("/system-admin/support","Támogatási központ","Rendszer"),
  MobileDestination("/system-admin/users","Felhasználók","Rendszer"),
 MobileDestination("/system-admin/farms","Gazdaságok","Nyilvántartás"),
 MobileDestination("/system-admin/fields","Földtáblák","Nyilvántartás"),
  MobileDestination("/system-admin/security","Biztonsági események","Rendszer"),
  MobileDestination("/system-admin/weather","HungaroMet kapcsolat","Rendszer"),
  MobileDestination("/system-admin/backup","Biztonsági mentés","Rendszer"),
  MobileDestination("/system-admin/profile","Profil és beállítások","Fiók")
 )

 fun menu(role:PortalRole):List<MobileDestination> = when(role){
  PortalRole.FARMER->farmer
  PortalRole.ADVISOR->advisor
  PortalRole.SYSTEM_ADMIN->admin
 }

 fun tabs(role:PortalRole):List<MobileDestination> = when(role){
  PortalRole.FARMER->listOf("/dashboard","/fields","/operations","/tasks")
  PortalRole.ADVISOR->listOf("/admin","/admin/clients","/admin/daily-work","/admin/map")
  PortalRole.SYSTEM_ADMIN->listOf("/system-admin","/system-admin/support","/system-admin/users","/system-admin/security")
 }.map{route->menu(role).first{it.route==route}}

 /** A nested detail inherits its parent quick-navigation selection. */
 fun activeTab(role:PortalRole,route:String):String? = tabs(role).map{it.route}
  .filter{route==it||(!isHomeRoute(role,it)&&route.startsWith("$it/"))}
  .maxByOrNull{it.length}

 private fun isHomeRoute(role:PortalRole,route:String)=route==when(role){
  PortalRole.FARMER->"/dashboard"
  PortalRole.ADVISOR->"/admin"
  PortalRole.SYSTEM_ADMIN->"/system-admin"
 }

 fun find(role:PortalRole,route:String):MobileDestination? = menu(role).find{it.route==route}

 /** Field details are shared between farmers and advisors, but their list roots differ. */
 fun fieldDetailBackRoute(role:PortalRole):String=when(role){
  PortalRole.FARMER->"/fields"
  PortalRole.ADVISOR->"/admin/map"
  PortalRole.SYSTEM_ADMIN->"/system-admin"
 }
}
