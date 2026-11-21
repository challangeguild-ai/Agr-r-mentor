package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.model.PortalRole
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class MapFieldsRepositoryTest{
 private val valid="11111111-2222-3333-4444-555555555555"

 @Test fun oneFieldRequestRejectsInjectedFiltersBeforeNetwork(){
  assertTrue(validMapFieldId(valid))
  assertFalse(validMapFieldId("$valid&or=(id.neq.null)"))
  assertFalse(validMapFieldId("$valid/inspections"))
  assertFalse(validMapFieldId("nincs-tábla"))
  val repository=MapFieldsRepository("https://example.supabase.co","publishable-test-key")
  val session=AuthorizedSession(PortalRole.FARMER,"token",valid,"",0L)
  assertThrows(IllegalArgumentException::class.java){runBlocking{repository.loadOne(session,"$valid&select=*")}}
 }

 @Test fun polygonAndPointUseTheSameMapFeatureModel(){
  val polygon="""{"type":"Polygon","coordinates":[[[19,47],[19.01,47],[19.01,47.01],[19,47.01],[19,47]]]}"""
  val field=NativeMapField(valid,"Déli tábla","Gazdaság",null,null,polygon)
  assertEquals(47.0,NativeMapGeoJson.center(field)!!.first,0.0)
  assertEquals(19.0,NativeMapGeoJson.center(field)!!.second,0.0)
  assertTrue(NativeMapGeoJson.polygons(listOf(field)).contains("Déli tábla"))
  assertTrue(NativeMapGeoJson.points(listOf(field)).contains("Point"))
 }
}
