package hu.agrarmentor.android.data

import java.time.LocalDate
import java.time.ZoneId

/** Non-plant-protection operation recording. Chemical use needs the separate official catalogue workflow. */
internal object OperationCreateRules {
 val types=listOf(
  "fertilizing" to "Tápanyag-utánpótlás", "sowing" to "Vetés",
  "soil_work" to "Talajmunka", "harvest" to "Betakarítás",
  "irrigation" to "Öntözés", "mowing" to "Kaszálás", "other" to "Egyéb művelet"
 )
 fun validDate(input:String,today:LocalDate=LocalDate.now(ZoneId.of("Europe/Budapest"))):Boolean=
  input.matches(Regex("[0-9]{4}-[0-9]{2}-[0-9]{2}"))&&
   runCatching{LocalDate.parse(input).let{it.toString()==input&&!it.isAfter(today)}}.getOrDefault(false)

 fun parseAmount(input:String):Double?{
  val value=input.trim().replace(',','.')
  if(value.isEmpty())return null
  require(value.matches(Regex("[+-]?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)"))){"Érvénytelen számérték."}
  return value.toDouble().also{require(it.isFinite()){"A megadott szám túl nagy."}}
 }

 fun validNumbers(area:Double?,maxArea:Double?,dose:Double?,quantity:Double?):Boolean =
  (area==null||(area>0&&(maxArea==null||area<=maxArea)))&&
   (dose==null||dose>=0)&&(quantity==null||quantity>=0)

 fun validDetails(type:String,date:String,subtype:String,product:String,notes:String):Boolean =
  types.any{it.first==type}&&validDate(date)&&subtype.length<=120&&product.length<=180&&notes.length<=1000&&
   (type!="fertilizing"||product.isNotBlank())
}
