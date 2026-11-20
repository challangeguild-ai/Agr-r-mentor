package hu.agrarmentor.android.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.agrarmentor.android.BuildConfig
import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.data.*
import kotlinx.coroutines.launch

internal data class PlantSelectionState(
 val productId:String?=null,val productName:String="",val useId:String?=null,
 val dose:String="",val doseUnit:String="",val doseMode:String="custom",val approverId:String?=null
)

@Composable
internal fun PlantProtectionSelector(
 session:AuthorizedSession,field:OperationField,date:String,current:PlantSelectionState,
 onChange:(PlantSelectionState)->Unit
){
 val repo=remember{PlantProtectionCatalogRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 val scope=rememberCoroutineScope()
 var searchText by remember{mutableStateOf("")}
 var results by remember{mutableStateOf<List<PlantProduct>>(emptyList())}
 var selectedProduct by remember{mutableStateOf<PlantProduct?>(null)}
 var uses by remember{mutableStateOf<List<PlantUse>>(emptyList())}
 var approvers by remember{mutableStateOf<List<PlantApprover>>(emptyList())}
 var loading by remember{mutableStateOf(false)}
 var detailLoading by remember{mutableStateOf(false)}
 var loadError by remember{mutableStateOf<String?>(null)}
 var useMenu by remember{mutableStateOf(false)}
 var approverMenu by remember{mutableStateOf(false)}
 LaunchedEffect(session.accessToken,field.countryCode,current.productId){
  selectedProduct=null;uses=emptyList()
  if(current.productId!=null){
   detailLoading=true;loadError=null
   try{
    selectedProduct=repo.productById(session,field.countryCode,current.productId)
    uses=repo.uses(session,current.productId)
   }catch(_:Exception){loadError="A kiválasztott készítmény felhasználási adatai nem ellenőrizhetők."}
   finally{detailLoading=false}
  }
 }
 LaunchedEffect(session.accessToken,field.farmId){
  try{approvers=repo.approvers(session,field.farmId)}
  catch(_:Exception){approvers=emptyList();loadError="A gazdasági jóváhagyók nem ellenőrizhetők."}
 }
 val selectedUse=uses.find{it.id==current.useId}
 val required=selectedProduct?.let{PlantProtectionRules.requiresApprover(field.countryCode,it.regulatoryCategory,it.approvalRequired,it.professionalOnly,it.prescriptionRequired)}==true
 val qualified=approvers.filter{OperationApprovalRules.levelAllows(it.level,selectedProduct?.regulatoryCategory)}
 Column(verticalArrangement=Arrangement.spacedBy(8.dp)){
  Text("Hivatalos növényvédőszer-katalógus · ${field.countryCode}",fontWeight=FontWeight.Bold,fontSize=13.sp)
  OutlinedTextField(searchText,{searchText=it.take(70)},label={Text("Készítmény neve (legalább 2 betű)")},modifier=Modifier.fillMaxWidth(),singleLine=true)
  OutlinedButton(onClick={
   loading=true;loadError=null;results=emptyList()
   scope.launch{
    try{results=repo.searchProducts(session,field.countryCode,searchText)}
    catch(e:Exception){loadError=e.message?:"A katalógus nem tölthető be."}
    finally{loading=false}
   }
  },enabled=!loading&&searchText.trim().length>=2){Text(if(loading)"Keresés…"else"Készítmény keresése")}
  if(results.isNotEmpty()){
   Text("Találatok: ${results.size}${if(results.size>=50)" · pontosítsd a keresést"else""}",fontSize=11.sp,color=Color.Gray)
   Column(Modifier.heightIn(max=170.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(2.dp)){
    results.forEach{item->
     TextButton(onClick={
      onChange(PlantSelectionState(productId=item.id,productName=item.name))
      selectedProduct=item;results=emptyList();loadError=null
     },modifier=Modifier.fillMaxWidth()){
      Text("${item.name}${item.authorizationNumber?.let{" · $it"}.orEmpty()}",fontSize=12.sp)
     }
    }
   }
  }
  if(detailLoading)LinearProgressIndicator(Modifier.fillMaxWidth())
  selectedProduct?.let{item->
   Text("Kiválasztott: ${item.name}",fontWeight=FontWeight.Bold,fontSize=13.sp)
   item.authorizationNumber?.let{Text("Engedélyszám: $it",fontSize=11.sp)}
   PlantProtectionRules.blockedStatus(field.countryCode,date,item.active,item.validFrom,item.validUntil,item.regulatoryStatus,item.graceUntil)?.let{
    Text(it,color=Color(0xFFB12B36),fontSize=12.sp)
   }
   if(uses.isEmpty()&&!detailLoading)Text("Ehhez a készítményhez nincs igazolt felhasználás; a beküldés blokkolva lesz.",color=Color(0xFFB12B36),fontSize=12.sp)
   Box{
    OutlinedButton(onClick={useMenu=true},enabled=uses.isNotEmpty()&&!detailLoading){
     Text("Kultúra / felhasználás: ${selectedUse?.let{"${it.crop}${it.target?.let{t->" · $t"}.orEmpty()}"}?:"Válassz"}")
    }
    DropdownMenu(expanded=useMenu,onDismissRequest={useMenu=false}){
     uses.forEach{use->DropdownMenuItem(text={Text("${use.crop}${use.target?.let{" · $it"}.orEmpty()}${use.doseMax?.let{" · max. $it ${use.doseUnit.orEmpty()}"}.orEmpty()}",fontSize=12.sp)},onClick={
      onChange(current.copy(useId=use.id,doseMode=if(use.doseMax!=null)"official_max"else"custom",
       dose=use.doseMax?.toString()?:"",doseUnit=use.doseUnit.orEmpty(),approverId=null))
      useMenu=false
     })}
    }
   }
   selectedUse?.let{use->
    Text("Engedélyezett dózis: ${use.doseMin?:"–"} – ${use.doseMax?:"–"} ${use.doseUnit.orEmpty()}",fontSize=12.sp)
    if(!use.method.isNullOrBlank())Text("Alkalmazás: ${use.method}",fontSize=11.sp)
    if(!use.restrictions.isNullOrBlank())Text("Korlátozások: ${use.restrictions}",fontSize=11.sp,color=Color(0xFF94601D))
    if(use.doseMax!=null)Row(horizontalArrangement=Arrangement.spacedBy(6.dp)){
     FilterChip(current.doseMode=="official_max",onClick={onChange(current.copy(doseMode="official_max",dose=use.doseMax.toString()))},label={Text("Hivatalos maximum")})
     FilterChip(current.doseMode=="custom",onClick={onChange(current.copy(doseMode="custom",dose=""))},label={Text("Saját dózis")})
    }
    OutlinedTextField(current.dose,{onChange(current.copy(dose=it.take(30)))},label={Text("Dózis")},
     enabled=current.doseMode=="custom",modifier=Modifier.fillMaxWidth(),singleLine=true)
    Text("Mértékegység: ${current.doseUnit.ifBlank{"Nem szerepel a katalógusban"}}",fontSize=11.sp)
   }
   if(required){
    Text("Jóváhagyás kötelező · kategória: ${item.regulatoryCategory?:"nincs megadva"}",color=Color(0xFF99611B),fontSize=12.sp,fontWeight=FontWeight.Bold)
    Box{
     OutlinedButton(onClick={approverMenu=true},enabled=qualified.isNotEmpty()){
      Text("Jóváhagyó: ${qualified.find{it.id==current.approverId}?.name?:"Válassz"}")
     }
     DropdownMenu(expanded=approverMenu,onDismissRequest={approverMenu=false}){
      qualified.forEach{person->DropdownMenuItem(text={Text("${person.name} · ${person.level}. kategória · ${person.validUntil}")},onClick={
       onChange(current.copy(approverId=person.id));approverMenu=false
      })}
     }
    }
    if(qualified.isEmpty())Text("Nincs ellenőrizhető, megfelelő engedélyű gazdasági jóváhagyó.",color=Color(0xFFB12B36),fontSize=12.sp)
   }
  }
  if(loadError!=null)Text(loadError!!,color=Color(0xFFB12B36),fontSize=12.sp)
 }
}
