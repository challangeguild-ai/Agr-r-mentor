/** Advisory only: field boundaries may legitimately be outside Hungary and Slovakia. */
export function fieldLocationHint(lng:number,lat:number):string|null{
  if(!Number.isFinite(lng)||!Number.isFinite(lat))return "A térképi középpont nem értelmezhető.";
  if(lng>=45&&lng<=50.5&&lat>=15.5&&lat<=24){
    return "Valószínűleg felcserélt hosszúság/szélesség! A GeoJSON koordinátáinak sorrendje [hosszúság, szélesség]. Ellenőrizd a fájl exportját.";
  }
  if(lng<15.5||lng>24||lat<45||lat>50.5){
    return "A poligon Magyarország és Szlovákia környékén kívül esik. Ez lehet helyes is, de mentés előtt ellenőrizd a vetületet és a helyszínt.";
  }
  return null;
}
