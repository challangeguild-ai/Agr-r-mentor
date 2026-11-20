package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate

class AdvisorSupervisionRepositoryTest {
 @Test fun decodeSameSeasonFormatAsWebsite(){
  val decoded=decodeMobileSupervision("SUPERVISION:{\"activeFrom\":\"03-15\",\"activeTo\":\"10-31\",\"inspectionIntervalDays\":21,\"enabled\":true,\"note\":\"Terepi idény\"}")
  assertEquals(MobileSupervisionConfig("03-15","10-31",21,true,"Terepi idény"),decoded)
  assertNull(decodeMobileSupervision("OTHER:{}"))
  assertNull(decodeMobileSupervision("SUPERVISION:broken"))
 }

 @Test fun crossYearSeasonAndDisabledConfig(){
  val season=MobileSupervisionConfig("11-01","02-28",30,true)
  assertTrue(mobileSupervisionActive(season,LocalDate.of(2026,12,15)))
  assertTrue(mobileSupervisionActive(season,LocalDate.of(2027,1,15)))
  assertFalse(mobileSupervisionActive(season,LocalDate.of(2027,4,15)))
  assertFalse(mobileSupervisionActive(season.copy(enabled=false),LocalDate.of(2026,12,15)))
 }

 @Test fun invalidMonthDayAndCycleRejected(){
  assertThrows(IllegalArgumentException::class.java){validateMobileSupervision(MobileSupervisionConfig(activeFrom="02-30"))}
  assertThrows(IllegalArgumentException::class.java){validateMobileSupervision(MobileSupervisionConfig(inspectionIntervalDays=0))}
  assertThrows(IllegalArgumentException::class.java){validateMobileSupervision(MobileSupervisionConfig(note="a".repeat(501)))}
  validateMobileSupervision(MobileSupervisionConfig())
 }

 @Test fun onlyAdvisorCanReadOrSave(){
  val repository=AdvisorSupervisionRepository("https://example.supabase.co","public-test-key")
  val farmer=AuthorizedSession(PortalRole.FARMER,"test","11111111-1111-1111-1111-111111111111","",0L)
  assertThrows(IllegalArgumentException::class.java){runBlocking{repository.load(farmer)}}
  assertThrows(IllegalArgumentException::class.java){runBlocking{
   repository.save(farmer,"11111111-1111-1111-1111-111111111111",MobileSupervisionConfig(),"22222222-2222-2222-2222-222222222222")
  }}
 }
}
