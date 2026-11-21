package hu.agrarmentor.android.auth

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PasswordRecoveryRedirectTest{
 @Test fun resetEmailReturnsToTheWorkingWebResetScreen(){
  assertEquals(
   "auth/v1/recover?redirect_to=https%3A%2F%2Fagr-r-mentor.vercel.app%2Freset-password",
   passwordRecoveryEndpoint("https://agr-r-mentor.vercel.app/")
  )
 }

 @Test fun recoveryRejectsUntrustedRedirectOrigins(){
  listOf(
   "", "http://agr-r-mentor.vercel.app", "javascript:alert(1)",
   "https://user:password@agr-r-mentor.vercel.app",
   "https://agr-r-mentor.vercel.app/other",
   "https://agr-r-mentor.vercel.app?access_token=secret",
   "https://agr-r-mentor.vercel.app#access_token=secret",
   "https://agr-r-mentor.vercel.app:8443"
  ).forEach{assertNull(passwordRecoveryEndpoint(it))}
 }
}
