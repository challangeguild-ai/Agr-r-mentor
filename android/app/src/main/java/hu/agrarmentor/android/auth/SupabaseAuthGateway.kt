package hu.agrarmentor.android.auth

import android.util.Base64
import hu.agrarmentor.android.model.PortalRole
import hu.agrarmentor.android.model.PortalRoleResolver
import hu.agrarmentor.android.model.RoleDecision
import hu.agrarmentor.android.model.VerifiedProfile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class AuthorizedSession(
 val role:PortalRole,
 val accessToken:String,
 val userId:String,
 val refreshToken:String,
 val expiresAtEpochSeconds:Long
)

sealed interface SignInResult {
 data class Authorized(val session:AuthorizedSession):SignInResult
 data class NeedsMfa(val accessToken:String,val factorId:String):SignInResult
 data class Failed(val message:String,val reauthenticationRequired:Boolean=false):SignInResult
}

/**
 * No local role chooser. Password sign-in -> verified user -> RLS-filtered profile
 * -> required MFA for advisor/admin. A missing factor is a hard stop.
 * Only the short-lived bearer token is sent to PostgREST. The refresh token is
 * rotated by Supabase Auth and persisted separately in Android Keystore storage.
 */
class SupabaseAuthGateway(private val baseUrl:String,private val publishableKey:String){
 val isConfigured=baseUrl.startsWith("https://")&&publishableKey.isNotBlank()

 suspend fun signIn(email:String,password:String):SignInResult = withContext(Dispatchers.IO){
  if(!isConfigured)return@withContext SignInResult.Failed("A Supabase-kapcsolat még nincs beállítva ebben a kiadásban.")
  try{
   val login=request("POST","auth/v1/token?grant_type=password",body=JSONObject().put("email",email.trim()).put("password",password))
   evaluate(login)
  }catch(_:Exception){SignInResult.Failed("A bejelentkezés sikertelen. Ellenőrizd az adataidat és a kapcsolatot.")}
 }

 suspend fun verifyMfa(token:String,factorId:String,code:String):SignInResult = withContext(Dispatchers.IO){
  try{
   if(!Regex("^[0-9]{6}$").matches(code.trim()))return@withContext SignInResult.Failed("Hatjegyű hitelesítő kódot adj meg.")
   val challenge=request("POST","auth/v1/factors/$factorId/challenge",token,JSONObject())
   val challengeId=challenge.getString("id")
   val verified=request("POST","auth/v1/factors/$factorId/verify",token,JSONObject().put("challenge_id",challengeId).put("code",code.trim()))
   evaluate(verified)
  }catch(_:Exception){SignInResult.Failed("Az ellenőrzőkódot nem sikerült elfogadni. Próbáld újra.")}
 }

 /** Always exchange the stored refresh token for a new pair before restoring a session. */
 suspend fun refresh(refreshToken:String):SignInResult = withContext(Dispatchers.IO){
  if(!isConfigured)return@withContext SignInResult.Failed("A Supabase-kapcsolat nincs beállítva.")
  try{
   val rotated=request("POST","auth/v1/token?grant_type=refresh_token",body=JSONObject().put("refresh_token",refreshToken))
   when(val evaluated=evaluate(rotated)){
    is SignInResult.Failed->evaluated.copy(reauthenticationRequired=true)
    else->evaluated
   }
  }catch(e:SupabaseHttpException){
   if(e.status in listOf(400,401,403))SignInResult.Failed("A munkamenet lejárt. Jelentkezz be újra.",true)
   else SignInResult.Failed("A kapcsolat átmenetileg nem érhető el.")
  }catch(_:Exception){SignInResult.Failed("A kapcsolat átmenetileg nem érhető el.")}
 }

 suspend fun requestPasswordReset(email:String):Boolean = withContext(Dispatchers.IO){
  if(!isConfigured||!android.util.Patterns.EMAIL_ADDRESS.matcher(email.trim()).matches())return@withContext false
  runCatching{requestText("POST","auth/v1/recover",null,JSONObject().put("email",email.trim()))}.isSuccess
 }

 suspend fun signOut(token:String)=withContext(Dispatchers.IO){
  runCatching{requestText("POST","auth/v1/logout",token,JSONObject())}
  Unit
 }

 private fun evaluate(authResponse:JSONObject):SignInResult{
  val token=authResponse.getString("access_token")
  val refreshToken=authResponse.getString("refresh_token")
  val expiresAt=authResponse.optLong("expires_at").takeIf{it>0L}
   ?: (System.currentTimeMillis()/1000L+authResponse.optLong("expires_in",3600L))
  // /user verifies the access token server-side; the JWT's aal only guides the UI.
  val user=request("GET","auth/v1/user",token)
  val userId=user.getString("id")
  val encodedId=java.net.URLEncoder.encode(userId,"UTF-8")
  val profiles=requestArray("rest/v1/profiles?select=role,system_role&id=eq.$encodedId",token)
  if(profiles.length()!=1)return SignInResult.Failed("A felhasználói profil nem hozzáférhető.")
  val row=profiles.getJSONObject(0)
  val assurance=jwtAal(token)
  val decision=PortalRoleResolver.resolve(VerifiedProfile(row.optString("role"),row.optString("system_role"),assurance))
  return when(decision){
   is RoleDecision.Granted->SignInResult.Authorized(AuthorizedSession(decision.portal,token,userId,refreshToken,expiresAt))
   RoleDecision.Denied->SignInResult.Failed("Nincs jogosultságod a portálhoz.")
   RoleDecision.MfaRequired->{
    val factors=user.optJSONArray("factors")?:JSONArray()
    val totp=sequence{for(index in 0 until factors.length())yield(factors.getJSONObject(index))}
     .firstOrNull{it.optString("factor_type")=="totp"&&it.optString("status")=="verified"}
    if(totp==null)SignInResult.Failed("A fiókban még nincs aktív hitelesítő alkalmazás. Állítsd be a webes fiókodban.")
    else SignInResult.NeedsMfa(token,totp.getString("id"))
   }
  }
 }

 private fun jwtAal(token:String):String?=runCatching{
  val payload=token.split(".")[1]
  JSONObject(String(Base64.decode(payload,Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING),Charsets.UTF_8)).optString("aal")
 }.getOrNull()

 private fun requestArray(path:String,token:String):JSONArray=JSONArray(requestText("GET",path,token,null))

 private fun request(method:String,path:String,token:String?=null,body:JSONObject?=null):JSONObject=
  JSONObject(requestText(method,path,token,body))

 private fun requestText(method:String,path:String,token:String?,body:JSONObject?):String{
  require(isConfigured)
  val endpoint="${baseUrl.trimEnd('/')}/$path"
  val connection=(URL(endpoint).openConnection() as HttpURLConnection).apply{
   requestMethod=method
   connectTimeout=12000
   readTimeout=12000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Content-Type","application/json")
   if(token!=null)setRequestProperty("Authorization","Bearer $token")
   if(body!=null){doOutput=true;outputStream.use{it.write(body.toString().toByteArray(Charsets.UTF_8))}}
  }
  return try{
   val status=connection.responseCode
   if(status !in 200..299)throw SupabaseHttpException(status)
   connection.inputStream.bufferedReader().use{it.readText()}
  }finally{connection.disconnect()}
 }
}

private class SupabaseHttpException(val status:Int):Exception("Supabase returned $status")
