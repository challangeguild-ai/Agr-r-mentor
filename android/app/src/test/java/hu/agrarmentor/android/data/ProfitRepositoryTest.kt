package hu.agrarmentor.android.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.json.JSONObject

class ProfitRepositoryTest{
 @Test fun realizedAndProjectedAreDifferentUntilHarvestIsSold(){
  val result=calculateProfitFigures(12.0,100_000.0,listOf(
   ProfitEntry("cost",amount=500_000.0),
   ProfitEntry("sale",quantity=5.0,unitPrice=110_000.0)
  ))
  assertEquals(500_000L,result.cost)
  assertEquals(550_000L,result.realizedRevenue)
  assertEquals(50_000L,result.realizedResult)
  assertEquals(750_000L,result.projectedResult)
  assertEquals(7.0,result.unsoldTonnes,0.0001)
 }

 @Test fun noHarvestMeansNoInventedRevenue(){
  val result=calculateProfitFigures(0.0,125_000.0,listOf(ProfitEntry("cost",amount=85_000.0)))
  assertEquals(-85_000L,result.realizedResult)
  assertEquals(-85_000L,result.projectedResult)
  assertEquals(0.0,result.unsoldTonnes,0.0001)
 }

 @Test fun otherFarmersFinancialRowsNeverReachNativeCards(){
  val own=JSONObject().put("created_by","farmer-a").put("farm_id","farm-a").put("field_id","field-a")
  val other=JSONObject().put("created_by","farmer-b").put("farm_id","farm-a").put("field_id","field-a")
  assertTrue(belongsToCurrentFarmer(own,"farmer-a",setOf("farm-a"),setOf("field-a")))
  assertFalse(belongsToCurrentFarmer(other,"farmer-a",setOf("farm-a"),setOf("field-a")))
  assertFalse(belongsToCurrentFarmer(own,"farmer-a",setOf("farm-b"),setOf("field-a")))
  assertFalse(belongsToCurrentFarmer(own,"farmer-a",setOf("farm-a"),setOf("field-b")))
  val sale=JSONObject().put("created_by","farmer-b").put("season_id","season-a")
  assertFalse(belongsToCurrentFarmerEntry(sale,"farmer-a",setOf("season-a")))
 }
}
