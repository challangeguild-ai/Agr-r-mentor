package hu.agrarmentor.android.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.agrarmentor.android.BuildConfig
import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.data.AdvisorExtrasRepository
import hu.agrarmentor.android.data.MobileAdvisorRecord

@Composable
internal fun AdvisorExtrasScreen(route:String,session:AuthorizedSession,colors:PortalPalette){
 val repo=remember{AdvisorExtrasRepository(BuildConfig.SUPABASE_URL,BuildConfig.SUPABASE_PUBLISHABLE_KEY)}
 var entries by remember{mutableStateOf<List<MobileAdvisorRecord>>(emptyList())}
 var busy by remember{mutableStateOf(true)}
 var failed by remember{mutableStateOf(false)}
 var revision by remember{mutableIntStateOf(0)}
 LaunchedEffect(route,session.accessToken,revision){
  busy=true;failed=false
  try{entries=repo.load(route,session)}catch(_:Exception){failed=true}
  finally{busy=false}
 }
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  if(busy)CircularProgressIndicator(color=colors.accent)
  else if(failed)LoadError(colors,onRetry={revision++})
  else if(entries.isEmpty())Text("Még nincs elérhető bejegyzés.",color=Color(0xFF6C7D72))
  else entries.forEach{entry->
   Card(colors){
    Text(entry.title,fontSize=16.sp,fontWeight=FontWeight.Bold,color=Color(0xFF1D3026))
    Text(entry.subtitle,fontSize=13.sp,color=colors.accent)
    if(entry.date!=null)Text(huDate(entry.date),fontSize=12.sp,color=Color(0xFF6C7D72))
    if(entry.detail!=null)Text(entry.detail,fontSize=13.sp,color=Color(0xFF1D3026))
   }
  }
 }
}
