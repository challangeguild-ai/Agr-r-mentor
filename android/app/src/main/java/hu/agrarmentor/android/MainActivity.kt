package hu.agrarmentor.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import hu.agrarmentor.android.ui.AgrarMentorApp

class MainActivity : ComponentActivity() {
 override fun onCreate(savedInstanceState: Bundle?) {
  super.onCreate(savedInstanceState)
  enableEdgeToEdge()
  setContent {
   MaterialTheme {
    Surface {
     // Real login in all configured builds; demo exists only in unconfigured debug previews.
     val previewOnly = BuildConfig.DEBUG &&
      (BuildConfig.SUPABASE_URL.isBlank() || BuildConfig.SUPABASE_PUBLISHABLE_KEY.isBlank())
     AgrarMentorApp(demoMode = previewOnly)
    }
   }
  }
 }
}
