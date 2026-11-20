package hu.agrarmentor.android.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import hu.agrarmentor.android.R
import hu.agrarmentor.android.auth.AuthorizedSession
import hu.agrarmentor.android.auth.SignInResult
import hu.agrarmentor.android.auth.SupabaseAuthGateway
import kotlinx.coroutines.launch

@Composable
fun SignInScreen(gateway:SupabaseAuthGateway,onAuthenticated:(AuthorizedSession)->Unit){
 var email by remember{mutableStateOf("")}
 var password by remember{mutableStateOf("")}
 var code by remember{mutableStateOf("")}
 var challenge by remember{mutableStateOf<SignInResult.NeedsMfa?>(null)}
 var waiting by remember{mutableStateOf(false)}
 var error by remember{mutableStateOf<String?>(null)}
 val scope=rememberCoroutineScope()

 fun handle(result:SignInResult){
  when(result){
   is SignInResult.Authorized->{password="";code="";onAuthenticated(result.session)}
   is SignInResult.NeedsMfa->{password="";challenge=result;error=null}
   is SignInResult.Failed->{error=result.message}
  }
 }

 Column(Modifier.fillMaxSize().background(Color(0xFFF7F5EE)).windowInsetsPadding(WindowInsets.safeDrawing).verticalScroll(rememberScrollState()).padding(horizontal=24.dp,vertical=34.dp),verticalArrangement=Arrangement.Center,horizontalAlignment=Alignment.CenterHorizontally){
  Image(painterResource(R.drawable.agrar_mentor_logo_on_light),"Agrár Mentor",Modifier.fillMaxWidth().height(92.dp),contentScale=ContentScale.Fit)
  Spacer(Modifier.height(25.dp))
  Card(colors=CardDefaults.cardColors(containerColor=Color.White),shape=RoundedCornerShape(20.dp),modifier=Modifier.fillMaxWidth()){
   Column(Modifier.padding(20.dp),verticalArrangement=Arrangement.spacedBy(14.dp)){
    Text(if(challenge==null)"Belépés" else "Kétlépcsős hitelesítés",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold,color=Color(0xFF163E2A))
    Text(if(challenge==null)"Egy alkalmazás, a jogosultságodnak megfelelő felülettel." else "Írd be a hitelesítő alkalmazásod hatjegyű kódját.",color=Color(0xFF64746B))
    if(challenge==null){
     OutlinedTextField(value=email,onValueChange={email=it},label={Text("E-mail-cím")},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Email),singleLine=true,modifier=Modifier.fillMaxWidth())
     OutlinedTextField(value=password,onValueChange={password=it},label={Text("Jelszó")},singleLine=true,visualTransformation=PasswordVisualTransformation(),keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Password),modifier=Modifier.fillMaxWidth())
    }else{
     OutlinedTextField(value=code,onValueChange={code=it.filter(Char::isDigit).take(6)},label={Text("Hitelesítőkód")},singleLine=true,keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.NumberPassword),modifier=Modifier.fillMaxWidth(),leadingIcon={Icon(Icons.Default.Lock,null)})
    }
    if(error!=null)Text(error!!,color=Color(0xFFB1303E),style=MaterialTheme.typography.bodyMedium)
    Button(
     onClick={
      waiting=true;error=null
      scope.launch{
       try{
        handle(if(challenge==null)gateway.signIn(email,password)else gateway.verifyMfa(challenge!!.accessToken,challenge!!.factorId,code))
       }finally{waiting=false}
      }
     },
     enabled=!waiting&&gateway.isConfigured&&(if(challenge==null)email.isNotBlank()&&password.isNotBlank()else code.length==6),
     colors=ButtonDefaults.buttonColors(containerColor=Color(0xFF0A613C)),
     shape=RoundedCornerShape(12.dp),modifier=Modifier.fillMaxWidth().heightIn(min=52.dp)
    ){Text(if(waiting)"Ellenőrzés…" else if(challenge==null)"Belépés" else "Kód ellenőrzése")}
    if(challenge!=null)TextButton(onClick={challenge=null;code="";error=null}){Text("Vissza a belépéshez")}
    if(!gateway.isConfigured)Text("A kiadáshoz a Supabase nyilvános kapcsolati adatait még be kell állítani.",color=Color(0xFF866B30),style=MaterialTheme.typography.bodySmall)
   }
  }
 }
}
