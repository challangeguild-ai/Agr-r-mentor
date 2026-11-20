package hu.agrarmentor.android.ui

import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.data.OperationCreateInput
import hu.agrarmentor.android.data.OperationCreateRepository
import hu.agrarmentor.android.data.OperationCreateRules
import hu.agrarmentor.android.data.OperationField
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.ZoneId

private val OperationHint=Color(0xFF61796B)
private val OperationError=Color(0xFFAC2A35)

/** Three native steps: HU factual log when permit uses are unavailable; verified use otherwise. */
@Composable
internal fun OperationCreateDialog(
 session:AuthorizedSession,colors:PortalPalette,repository:OperationCreateRepository,
 onDismiss:()->Unit,onSaved:(String?)->Unit
){
 val previous=remember(repository){repository.pendingInput()}
 var fields by remember{mutableStateOf<List<OperationField>>(emptyList())}
 var loading by remember{mutableStateOf(true)}
 var step by remember{mutableIntStateOf(0)}
 var fieldId by remember{mutableStateOf(previous?.fieldId?:"")}
 var date by remember{mutableStateOf(previous?.date?:LocalDate.now(ZoneId.of("Europe/Budapest")).toString())}
 var type by remember{mutableStateOf(previous?.type?:"soil_work")}
 var subtype by remember{mutableStateOf(previous?.subtype?:"")}
 var product by remember{mutableStateOf(previous?.product?:"")}
 var crop by remember{mutableStateOf(previous?.crop?:"")}
 var target by remember{mutableStateOf(previous?.target?:"")}
 var permitAcknowledged by remember{mutableStateOf(previous?.permitAcknowledged?:false)}
 var huManualAvailable by remember{mutableStateOf<Boolean?>(null)}
 var productId by remember{mutableStateOf(previous?.productId)}
 var useId by remember{mutableStateOf(previous?.useId)}
 var doseMode by remember{mutableStateOf(previous?.doseMode?:"custom")}
 var requestedApproverId by remember{mutableStateOf(previous?.requestedApproverId)}
 var treatedArea by remember{mutableStateOf(previous?.treatedArea?:"")}
 var dose by remember{mutableStateOf(previous?.dose?:"")}
 var doseUnit by remember{mutableStateOf(previous?.doseUnit?:"")}
 var quantity by remember{mutableStateOf(previous?.quantity?:"")}
 var quantityUnit by remember{mutableStateOf(previous?.quantityUnit?:"")}
 var machine by remember{mutableStateOf(previous?.machine?:"")}
 var operator by remember{mutableStateOf(previous?.operator?:"")}
 var weather by remember{mutableStateOf(previous?.weather?:"")}
 var notes by remember{mutableStateOf(previous?.notes?:"")}
 var fieldMenu by remember{mutableStateOf(false)}
 var typeMenu by remember{mutableStateOf(false)}
 var saving by remember{mutableStateOf(false)}
 var error by remember{mutableStateOf<String?>(null)}
 val scope=rememberCoroutineScope()
 LaunchedEffect(session.accessToken){
  loading=true;error=null
  try{fields=repository.ownedFields(session)}catch(_:Exception){error="A saját földtáblák nem érhetők el."}
  finally{loading=false}
 }
 val selected=fields.find{it.id==fieldId}
 val chemical=type=="spraying"||type=="plant_protection"
 LaunchedEffect(session.accessToken,selected?.countryCode){
  huManualAvailable=null
  if(selected?.countryCode=="HU"){
   huManualAvailable=runCatching{repository.huManualAvailable(session)}.getOrDefault(false)
  }
 }
 val manualHu=chemical&&selected?.countryCode=="HU"&&huManualAvailable==true
 val draft=OperationCreateInput(fieldId,date,type,subtype,product,treatedArea,dose,doseUnit,quantity,quantityUnit,machine,operator,weather,notes,
  productId,useId,doseMode,requestedApproverId,crop,target,permitAcknowledged)
 fun validate():String?{
  if(selected==null)return "Válassz saját földtáblát."
  if(!OperationCreateRules.validDate(date))return "Érvényes dátumot adj meg (ÉÉÉÉ-HH-NN)."
  if(OperationCreateRules.types.none{it.first==type})return "Válassz érvényes művelettípust."
  if(step==0)return null
  if(!OperationCreateRules.validDetails(type,date,subtype,product,notes))return "Ellenőrizd a művelettípust, az anyagot és a szöveges adatokat."
  if(chemical&&!manualHu&&(productId.isNullOrBlank()||useId.isNullOrBlank()))return "Válassz hivatalos készítményt és engedélyezett felhasználást."
  return runCatching{
   val area=OperationCreateRules.parseAmount(treatedArea)
   val d=if(chemical&&doseMode=="official_max")null else OperationCreateRules.parseAmount(dose)
   val q=OperationCreateRules.parseAmount(quantity)
   if(!OperationCreateRules.validNumbers(area,selected.areaHa,d,q))"A terület vagy a mennyiségek érvénytelenek."
   else if(manualHu&&!OperationCreateRules.validHuManualLog("HU",false,product,crop,d,doseUnit,permitAcknowledged))"A kézi naplóhoz készítmény, kultúra, tényleges pozitív dózis, egység és engedélyokirat-ellenőrzés kell."
   else null
  }.getOrElse{it.message?:"Érvénytelen számérték."}
 }
 AlertDialog(onDismissRequest={if(!saving)onDismiss()},title={Text("Művelet rögzítése · ${step+1}/3")},
  text={Column(Modifier.fillMaxWidth().heightIn(max=520.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(9.dp)){
   if(previous!=null)Text("A korábban megkezdett mentést folytatod. Új azonosító nem jön létre.",color=OperationHint,fontSize=12.sp)
   if(loading)CircularProgressIndicator(color=colors.accent)
   else if(fields.isEmpty())Text("Nem található saját földtábla. Műveletet csak a gazdaság tulajdonosa rögzíthet.",color=OperationError,fontSize=12.sp)
   else when(step){
    0->{
     Text("1. Alapadatok",fontWeight=FontWeight.Bold)
     Box{
      OutlinedButton(onClick={fieldMenu=true},enabled=!saving){Text("Földtábla: ${selected?.name?:"Válassz"}")}
      DropdownMenu(expanded=fieldMenu,onDismissRequest={fieldMenu=false}){
       fields.forEach{field->DropdownMenuItem(text={Text("${field.farmName} · ${field.name}")},onClick={
        if(fieldId!=field.id){productId=null;useId=null;product="";crop="";target="";permitAcknowledged=false;dose="";doseUnit="";requestedApproverId=null}
        fieldId=field.id;fieldMenu=false
       })}
      }
     }
     if(selected?.areaHa!=null)Text("Tábla mérete: ${selected.areaHa} ha",color=OperationHint,fontSize=12.sp)
     OutlinedTextField(date,{date=it.take(10)},label={Text("Művelet dátuma (ÉÉÉÉ-HH-NN)")},singleLine=true,modifier=Modifier.fillMaxWidth())
     Box{
      OutlinedButton(onClick={typeMenu=true},enabled=!saving){Text("Típus: ${OperationCreateRules.types.find{it.first==type}?.second?:"Válassz"}")}
      DropdownMenu(expanded=typeMenu,onDismissRequest={typeMenu=false}){
       OperationCreateRules.types.forEach{(key,label)->DropdownMenuItem(text={Text(label)},onClick={
        if(type!=key){productId=null;useId=null;product="";crop="";target="";permitAcknowledged=false;dose="";doseUnit="";doseMode="custom";requestedApproverId=null}
        type=key;typeMenu=false
       })}
      }
     }
     Text(if(manualHu)"A magyar felhasználási adatok hiányában csak a ténylegesen elvégzett kezelés kézi, nem engedély-ellenőrzött naplózása érhető el."
      else "Igazolt felhasználási adat esetén hivatalos készítmény, felhasználás és szükség esetén jogosult jóváhagyó szükséges.",color=OperationHint,fontSize=12.sp)
    }
    1->{
     Text("2. Végrehajtási adatok",fontWeight=FontWeight.Bold)
     OutlinedTextField(subtype,{subtype=it.take(120)},label={Text("Művelet részlete (nem kötelező)")},modifier=Modifier.fillMaxWidth())
     if(manualHu){
      Text("⚠ Kézi naplóbejegyzés – nem igazolja a szer engedélyezettségét vagy a kijuttatási jogosultságot.",color=OperationError,fontSize=12.sp)
      OutlinedTextField(product,{product=it.take(180)},label={Text("Ténylegesen kijuttatott szer neve")},modifier=Modifier.fillMaxWidth())
      OutlinedTextField(crop,{crop=it.take(160)},label={Text("Kezelt kultúra")},modifier=Modifier.fillMaxWidth())
      OutlinedTextField(target,{target=it.take(160)},label={Text("Cél / károsító (nem kötelező)")},modifier=Modifier.fillMaxWidth())
      Row(verticalAlignment=androidx.compose.ui.Alignment.CenterVertically){
       Checkbox(checked=permitAcknowledged,onCheckedChange={permitAcknowledged=it})
       Text("A hatályos NÉBIH engedélyokiratot külön ellenőriztem; ez csak tényleges kezelés naplózása.",fontSize=12.sp)
      }
      Text("Engedélykereső: novenyvedoszer.nebih.gov.hu/Engedelykereso/kereso",color=OperationHint,fontSize=11.sp)
     }else if(chemical&&selected!=null){
      PlantProtectionSelector(session,selected,date,
       PlantSelectionState(productId,product,useId,dose,doseUnit,doseMode,requestedApproverId),onChange={value->
        productId=value.productId;product=value.productName;useId=value.useId
        dose=value.dose;doseUnit=value.doseUnit;doseMode=value.doseMode;requestedApproverId=value.approverId
       })
     }else OutlinedTextField(product,{product=it.take(180)},label={Text(if(type=="fertilizing")"Anyag neve (kötelező)"else"Anyag neve (nem kötelező)")},modifier=Modifier.fillMaxWidth())
     OutlinedTextField(treatedArea,{treatedArea=it.take(30)},label={Text("Kezelt terület (ha)")},modifier=Modifier.fillMaxWidth())
     if(!chemical||manualHu)Row(horizontalArrangement=Arrangement.spacedBy(7.dp)){
      OutlinedTextField(dose,{dose=it.take(30)},label={Text(if(manualHu)"Tényleges dózis"else"Dózis")},modifier=Modifier.weight(1f))
      OutlinedTextField(doseUnit,{doseUnit=it.take(30)},label={Text("Egység")},modifier=Modifier.weight(1f))
     }
     Row(horizontalArrangement=Arrangement.spacedBy(7.dp)){
      OutlinedTextField(quantity,{quantity=it.take(30)},label={Text("Mennyiség")},modifier=Modifier.weight(1f))
      OutlinedTextField(quantityUnit,{quantityUnit=it.take(30)},label={Text("Egység")},modifier=Modifier.weight(1f))
     }
    }
    else->{
     Text("3. Gép, végrehajtó és ellenőrzés",fontWeight=FontWeight.Bold)
     Text("${selected?.name?:"Földtábla"} · ${OperationCreateRules.types.find{it.first==type}?.second?:type} · ${huDate(date)}",fontSize=12.sp,color=OperationHint)
     OutlinedTextField(machine,{machine=it.take(150)},label={Text("Gép neve (nem kötelező)")},modifier=Modifier.fillMaxWidth())
     OutlinedTextField(operator,{operator=it.take(120)},label={Text("Végrehajtó (nem kötelező)")},modifier=Modifier.fillMaxWidth())
     OutlinedTextField(weather,{weather=it.take(180)},label={Text("Időjárás / körülmények")},modifier=Modifier.fillMaxWidth())
     OutlinedTextField(notes,{notes=it.take(1000)},label={Text("Megjegyzés")},modifier=Modifier.fillMaxWidth(),minLines=3)
     Text("A rögzítés a meglévő műveleti naplóba és – amennyiben engedélyezett – az idővonalra kerül.",color=OperationHint,fontSize=12.sp)
     if(manualHu)Text("NEM ELLENŐRZÖTT: a kézi dózis tényadat, nem hivatalos maximális dózis. A hatályos engedélyokirat és jogosultság külön ellenőrizendő.",color=OperationError,fontSize=12.sp)
    }
   }
   if(error!=null)Text(error!!,color=OperationError,fontSize=12.sp)
   if(saving)LinearProgressIndicator(Modifier.fillMaxWidth())
  }},
  confirmButton={TextButton(onClick={
   error=validate()
   if(error!=null)return@TextButton
   if(step<2){step++;return@TextButton}
   saving=true
   scope.launch{
    try{
     val result=repository.create(session,draft)
     onSaved(result.warning?:if(result.alreadyExists)"A művelet már szerepel a naplóban, nem rögzítettük újra."else null)
    }catch(e:Exception){error=e.message?:"A művelet mentése sikertelen. Ugyanazokkal az adatokkal próbáld újra."}
    finally{saving=false}
   }
  },enabled=!loading&&!saving&&fields.isNotEmpty()){
   Text(if(saving)"Mentés…"else if(step<2)"Tovább"else"Művelet mentése")
  }},
  dismissButton={TextButton(onClick={if(step>0)step-- else onDismiss()},enabled=!saving){Text(if(step>0)"Vissza"else"Mégsem")}}
 )
}
