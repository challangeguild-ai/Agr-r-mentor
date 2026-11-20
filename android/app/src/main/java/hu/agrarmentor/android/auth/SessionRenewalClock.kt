package hu.agrarmentor.android.auth

/** Renew shortly before the token expires, never hammer the server in a tight loop. */
object SessionRenewalClock{
 fun delayMillis(expiresAtEpochSeconds:Long,nowMillis:Long=System.currentTimeMillis()):Long =
  (expiresAtEpochSeconds*1000L-nowMillis-60_000L).coerceIn(1_000L,3_600_000L)
}
