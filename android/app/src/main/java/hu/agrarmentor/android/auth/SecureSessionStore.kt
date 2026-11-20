package hu.agrarmentor.android.auth

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Only the Supabase refresh token is stored. It is encrypted using a
 * non-exportable, device-local Android Keystore AES-GCM key. Access tokens and
 * passwords are never written to disk; Android cloud backup is disabled.
 */
class SecureSessionStore(context:Context){
 private val preferences=context.applicationContext.getSharedPreferences("auth_session_v1",Context.MODE_PRIVATE)

 @Synchronized
 fun saveRefreshToken(refreshToken:String){
  require(refreshToken.isNotBlank())
  val cipher=Cipher.getInstance("AES/GCM/NoPadding")
  cipher.init(Cipher.ENCRYPT_MODE,secretKey())
  val payload=cipher.doFinal(refreshToken.toByteArray(Charsets.UTF_8))
  preferences.edit()
   .putString("iv",Base64.encodeToString(cipher.iv,Base64.NO_WRAP))
   .putString("token",Base64.encodeToString(payload,Base64.NO_WRAP))
   .commit()
 }

 @Synchronized
 fun loadRefreshToken():String?{
  val iv=preferences.getString("iv",null)?:return null
  val ciphertext=preferences.getString("token",null)?:return null
  return try{
   val cipher=Cipher.getInstance("AES/GCM/NoPadding")
   cipher.init(Cipher.DECRYPT_MODE,secretKey(),GCMParameterSpec(128,Base64.decode(iv,Base64.NO_WRAP)))
   String(cipher.doFinal(Base64.decode(ciphertext,Base64.NO_WRAP)),Charsets.UTF_8).takeIf{it.isNotBlank()}
  }catch(_:Exception){
   clear()
   null
  }
 }

 @Synchronized
 fun clear(){preferences.edit().clear().commit()}

 private fun secretKey():SecretKey{
  val store=KeyStore.getInstance("AndroidKeyStore").apply{load(null)}
  (store.getKey(KEY_ALIAS,null) as? SecretKey)?.let{return it}
  return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore").apply{
   init(KeyGenParameterSpec.Builder(KEY_ALIAS,KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
    .setRandomizedEncryptionRequired(true)
    .build())
  }.generateKey()
 }

 private companion object{const val KEY_ALIAS="agrar_mentor_refresh_v1"}
}
