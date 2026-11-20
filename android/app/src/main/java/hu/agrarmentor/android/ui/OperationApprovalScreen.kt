package hu.agrarmentor.android.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.agrarmentor.android.BuildConfig
import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.data.OperationApproval
import hu.agrarmentor.android.data.OperationApprovalRepository
import kotlinx.coroutines.launch

private val ApprovalInk=Color(0xFF1D3026)
private val ApprovalMuted=Color(0xFF6C7D72)
private val ApprovalDanger=Color(0xFFAF303A)

@Composable
internal fun LiveOperationApprovalsScreen(session:AuthorizedSession,colors:PortalPalette){
 val repo=remember{OperationApprovalRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 val scope=rememberCoroutineScope()
 var entries by remember(session.userId){mutableStateOf<List<OperationApproval>>(emptyList())}
 var loading by remember{mutableStateOf(true)}
 var error by remember{mutableStateOf<String?>(null)}
 var notice by remember{mutableStateOf<String?>(null)}
 var revision by remember{mutableIntStateOf(0)}
 var selected by remember{mutableStateOf<OperationApproval?>(null)}
 var confirmed by remember{mutableStateOf(false)}
 var saving by remember{mutableStateOf(false)}
 var approvalError by remember{mutableStateOf<String?>(null)}
 LaunchedEffect(session.accessToken,revision){
  loading=true;error=null
  try{entries=repo.approvals(session)}
  catch(_:Exception){error="A jóváhagyásra váró műveletek nem tölthetők be."}
  finally{loading=false}
 }
 val pending=entries.filter{it.status=="pending"}
 val approved=entries.filter{it.status=="approved"}
 Column(verticalArrangement=Arrangement.spacedBy(10.dp)){
  Text("Kizárólag a hozzád rendelt növényvédelmi műveleteket hagyhatod jóvá. A rendszer a személyes és gazdasági engedélyedet is ellenőrzi.",color=ApprovalMuted,fontSize=12.sp)
  if(notice!=null)Text(notice!!,color=colors.accent,fontSize=13.sp)
  if(loading)CircularProgressIndicator(color=colors.accent)
  else if(error!=null){
   Text(error!!,color=ApprovalDanger,fontSize=13.sp)
   OutlinedButton(onClick={revision++}){Text("Újrapróbálás")}
  }else{
   Text("Jóváhagyásra vár (${pending.size})",color=ApprovalInk,fontWeight=FontWeight.Bold,fontSize=17.sp)
   if(pending.isEmpty())Text("Nincs hozzád rendelt, jóváhagyásra váró művelet.",color=ApprovalMuted,fontSize=13.sp)
   pending.forEach{operation->
    Card(colors){
     Text(operation.product.ifBlank{"Növényvédelmi művelet"},color=ApprovalInk,fontWeight=FontWeight.Bold,fontSize=16.sp)
     Text("${operation.farmName} · ${operation.fieldName} · ${huDate(operation.date)}",color=ApprovalMuted,fontSize=12.sp)
     if(!operation.category.isNullOrBlank())Text("Engedélykategória: ${operation.category}",fontSize=12.sp,color=ApprovalInk)
     if(!operation.crop.isNullOrBlank())Text("Kultúra: ${operation.crop}",fontSize=13.sp,color=ApprovalInk)
     if(!operation.target.isNullOrBlank())Text("Cél: ${operation.target}",fontSize=13.sp,color=ApprovalInk)
     if(!operation.dose.isNullOrBlank())Text("Dózis: ${operation.dose} ${operation.doseUnit.orEmpty()}",fontSize=13.sp,color=ApprovalInk)
     if(!operation.operator.isNullOrBlank())Text("Végrehajtó: ${operation.operator}",fontSize=13.sp,color=ApprovalInk)
     Button(onClick={selected=operation;confirmed=false;approvalError=null},colors=ButtonDefaults.buttonColors(containerColor=colors.accent)){
      Text("Adatok ellenőrzése és jóváhagyás")
     }
    }
   }
   if(approved.isNotEmpty()){
    Text("Korábban jóváhagyva (${approved.size})",color=ApprovalInk,fontWeight=FontWeight.Bold,fontSize=17.sp)
    approved.forEach{operation->Card(colors){
     Text(operation.product.ifBlank{"Növényvédelmi művelet"},color=ApprovalInk,fontWeight=FontWeight.Bold)
     Text("${operation.fieldName} · ${huDate(operation.date)}",color=ApprovalMuted,fontSize=12.sp)
     Text("Jóváhagyva${operation.approvedAt?.let{" · ${huDate(it)}"}.orEmpty()}",color=colors.accent,fontSize=12.sp)
    }}
   }
  }
 }
 selected?.let{operation->
  AlertDialog(onDismissRequest={if(!saving)selected=null},title={Text("Művelet jóváhagyása")},
   text={Column(verticalArrangement=Arrangement.spacedBy(9.dp)){
    Text(operation.product.ifBlank{"Növényvédelmi művelet"},fontWeight=FontWeight.Bold)
    Text("${operation.fieldName} · ${huDate(operation.date)}",fontSize=13.sp)
    Text("Kategória: ${operation.category?:"Nincs megadva"} · Dózis: ${operation.dose?:"Nincs megadva"} ${operation.doseUnit.orEmpty()}",fontSize=12.sp)
    Row(verticalAlignment=Alignment.CenterVertically){
     Checkbox(checked=confirmed,onCheckedChange={confirmed=it},enabled=!saving)
     Text("Ellenőriztem a művelet és az engedély adatait; vállalom a jóváhagyást.",fontSize=12.sp)
    }
    if(approvalError!=null)Text(approvalError!!,color=ApprovalDanger,fontSize=12.sp)
    if(saving)LinearProgressIndicator(Modifier.fillMaxWidth())
   }},
   confirmButton={TextButton(onClick={
    saving=true;error=null;notice=null;approvalError=null
    scope.launch{
     try{
      val already=repo.approve(session,operation)
      notice=if(already)"A művelet már korábban jóvá lett hagyva."else"A művelet jóváhagyása sikeres."
      selected=null;revision++
     }catch(e:Exception){approvalError="A jóváhagyás sikertelen: ${e.message?:"Ellenőrizd a jogosultságot."}"}
     finally{saving=false}
    }
   },enabled=confirmed&&!saving){Text(if(saving)"Mentés…"else"Jóváhagyom")}},
   dismissButton={TextButton(onClick={selected=null},enabled=!saving){Text("Mégsem")}}
  )
 }
}
