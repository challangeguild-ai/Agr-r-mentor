package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeParseException

class AdvisorFieldWorkRepositoryTest{
 private val farm="11111111-1111-4111-8111-111111111111"
 private val field="22222222-2222-4222-8222-222222222222"

 @Test fun inspectionMustHaveAccessibleFieldAndKnownCondition(){
  val today=LocalDate.now(ZoneId.of("Europe/Budapest")).toString()
  validAdvisorInspection(AdvisorInspectionInput(field,today,"attention","Megfigyelés","Javaslat"))
  assertThrows(IllegalArgumentException::class.java){validAdvisorInspection(AdvisorInspectionInput("other",today,"good","",""))}
  assertThrows(IllegalArgumentException::class.java){validAdvisorInspection(AdvisorInspectionInput(field,today,"unknown","",""))}
  assertThrows(IllegalArgumentException::class.java){validAdvisorInspection(AdvisorInspectionInput(field,today,"critical","","",issueStatus="unknown"))}
  assertThrows(DateTimeParseException::class.java){validAdvisorInspection(AdvisorInspectionInput(field,today,"good","","",nextCheck="2026-02-31"))}
  assertThrows(IllegalArgumentException::class.java){validAdvisorInspection(AdvisorInspectionInput(field,LocalDate.now(ZoneId.of("Europe/Budapest")).plusDays(1).toString(),"good","",""))}
 }

 @Test fun visitUsesUnambiguousBudapestTimeAndRejectsDstGapAndOverlap(){
  assertEquals(Instant.parse("2026-07-11T08:30:00Z"),advisorVisitInstant("2026-07-11","10:30"))
  assertEquals(Instant.parse("2026-01-11T09:30:00Z"),advisorVisitInstant("2026-01-11","10:30"))
  assertThrows(IllegalArgumentException::class.java){advisorVisitInstant("2026-03-29","02:30")}
  assertThrows(IllegalArgumentException::class.java){advisorVisitInstant("2026-10-25","02:30")}
 }

 @Test fun visitValidatesFarmFieldAndPurpose(){
  val input=AdvisorVisitInput(farm,field,"2026-12-03","10:00","Terepi szemle","Rövid jegyzet")
  validAdvisorVisit(input)
  assertThrows(IllegalArgumentException::class.java){validAdvisorVisit(input.copy(farmId="not-uuid"))}
  assertThrows(IllegalArgumentException::class.java){validAdvisorVisit(input.copy(fieldId="not-uuid"))}
  assertThrows(IllegalArgumentException::class.java){validAdvisorVisit(input.copy(purpose=" "))}
  assertThrows(IllegalArgumentException::class.java){validAdvisorVisit(input.copy(note="a".repeat(3001)))}
 }

 @Test fun visitEncodingStaysCompatibleWithWebVisitEnvelope(){
  val expected=AdvisorVisitData("2026-07-11T08:30:00Z","Növényállapot","Szemle előtt telefon", "planned",null)
  assertEquals(expected,decodeMobileAdvisorVisit(encodeMobileAdvisorVisit(expected)))
  assertEquals("",decodeMobileAdvisorVisit("ADVISORVISIT:{\"scheduledAt\":\"2026-07-11T08:30:00Z\",\"purpose\":\"Terv\",\"status\":\"planned\"}")?.note)
  assertNull(decodeMobileAdvisorVisit("Külső szöveg"))
  assertNull(decodeMobileAdvisorVisit("ADVISORVISIT:{broken"))
  assertEquals("planned",decodeMobileAdvisorVisit("ADVISORVISIT:{\"scheduledAt\":\"2026-07-11T08:30:00Z\",\"status\":\"unexpected\"}")?.status)
 }

 @Test fun farmerCannotCreateInspectionOrVisit(){
  val session=AuthorizedSession(PortalRole.FARMER,"token",farm,"refresh",0)
  val repo=AdvisorFieldWorkRepository("https://example.invalid","public-anon")
  val today=LocalDate.now(ZoneId.of("Europe/Budapest")).toString()
  assertThrows(IllegalArgumentException::class.java){
   kotlinx.coroutines.runBlocking{repo.createInspection(session,AdvisorInspectionInput(field,today,"good","",""),farm,field)}
  }
  assertThrows(IllegalArgumentException::class.java){
   kotlinx.coroutines.runBlocking{repo.createVisit(session,AdvisorVisitInput(farm,field,today,"11:00","Szemle",""),farm)}
  }
 }
}
