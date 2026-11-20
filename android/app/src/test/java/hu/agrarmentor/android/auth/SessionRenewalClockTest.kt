package hu.agrarmentor.android.auth

import org.junit.Assert.assertEquals
import org.junit.Test

class SessionRenewalClockTest{
 @Test fun schedulesOneMinuteBeforeExpiry(){
  assertEquals(540_000L,SessionRenewalClock.delayMillis(expiresAtEpochSeconds=600L,nowMillis=0L))
 }

 @Test fun doesNotBusyLoopAfterExpiry(){
  assertEquals(1_000L,SessionRenewalClock.delayMillis(expiresAtEpochSeconds=100L,nowMillis=120_000L))
 }

 @Test fun capsLongLivedSessions(){
  assertEquals(3_600_000L,SessionRenewalClock.delayMillis(expiresAtEpochSeconds=86_400L,nowMillis=0L))
 }
}
