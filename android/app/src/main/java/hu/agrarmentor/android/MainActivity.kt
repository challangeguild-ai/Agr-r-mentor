package hu.agrarmentor.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color
import hu.agrarmentor.android.ui.AgrarMentorApp

class MainActivity : ComponentActivity() {
 override fun onCreate(savedInstanceState: Bundle?) {
  super.onCreate(savedInstanceState)
  enableEdgeToEdge()
  setContent {
   MaterialTheme(colorScheme=lightColorScheme(
    primary=Color(0xFF0A613C),onPrimary=Color.White,
    primaryContainer=Color(0xFFE6F3E7),onPrimaryContainer=Color(0xFF073F2B)
   )) {
    Surface {
     AgrarMentorApp()
    }
   }
  }
 }
}
