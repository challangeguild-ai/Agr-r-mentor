package hu.agrarmentor.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AdvisorProfitRepositoryTest{
 @Test fun exactAmountsFromAuthorizedResponse(){
  val input=JSONObject("""{"farms":[{"name":"Minta","seasons":[{"fieldName":"Búza","cropName":"Búza","year":2026,"harvestedTonnes":10,"totals":{"totalCost":400000,"realizedRevenue":510000,"realizedResult":110000,"projectedResult":200000,"soldTonnes":5,"unsoldTonnes":5}}]}]}""")
  val farms=parseAdvisorFinance(input)
  assertEquals("Minta",farms.first().name)
  assertEquals(400000L,farms.first().seasons.first().figures.cost)
  assertEquals(110000L,farms.first().seasons.first().figures.realizedResult)
 }
 @Test fun noGrantMeansNoCards(){assertTrue(parseAdvisorFinance(JSONObject("""{"farms":[]}""")).isEmpty())}
}
