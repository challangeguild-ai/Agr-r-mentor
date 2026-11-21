package hu.agrarmentor.android.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class WebModuleLinkTest{
 @Test fun validProductionOriginOpensExactWebPage(){
  assertEquals("https://agr-r-mentor.vercel.app/admin/map/import",
   safeWebModuleUrl("https://agr-r-mentor.vercel.app/","/admin/map/import"))
  assertEquals("https://agr-r-mentor.vercel.app/admin/plant-protection-import",
   safeWebModuleUrl("https://agr-r-mentor.vercel.app","/admin/plant-protection-import"))
  assertEquals("https://agr-r-mentor.vercel.app/system-admin/backup",
   safeWebModuleUrl("https://agr-r-mentor.vercel.app","/system-admin/backup"))
  assertEquals("https://agr-r-mentor.vercel.app/admin/inspections",
   safeWebModuleUrl("https://agr-r-mentor.vercel.app","/admin/inspections"))
  assertEquals("https://agr-r-mentor.vercel.app/admin/visits",
   safeWebModuleUrl("https://agr-r-mentor.vercel.app","/admin/visits"))
  assertEquals("https://agr-r-mentor.vercel.app/operations/94e01dbb-229b-4b09-9770-c6874cbbf9b0",
   safeWebModuleUrl("https://agr-r-mentor.vercel.app","/operations/94e01dbb-229b-4b09-9770-c6874cbbf9b0"))
 }

 @Test fun untrustedDestinationsNeverOpen(){
  listOf("http://agr-r-mentor.vercel.app","https://evil.example/@user",
   "https://user:pass@agr-r-mentor.vercel.app","https://agr-r-mentor.vercel.app?token=secret",
   "https://agr-r-mentor.vercel.app:8443","javascript:alert(1)","").forEach{
   assertNull(safeWebModuleUrl(it,"/system-admin/weather"))
  }
  assertNull(safeWebModuleUrl("https://agr-r-mentor.vercel.app","//evil.example"))
  assertNull(safeWebModuleUrl("https://agr-r-mentor.vercel.app","/admin/custom?token=secret"))
  for(path in listOf("/operations/123","/operations/94e01dbb-229b-4b09-9770-c6874cbbf9b0/extra",
   "/operations/94e01dbb-229b-4b09-9770-c6874cbbf9b0?token=leak","/operations/../../system-admin/backup")){
   assertNull(safeWebModuleUrl("https://agr-r-mentor.vercel.app",path))
  }
 }
}
