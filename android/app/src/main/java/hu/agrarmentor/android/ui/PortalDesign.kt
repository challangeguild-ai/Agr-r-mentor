package hu.agrarmentor.android.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.agrarmentor.android.R

/** One agricultural design language for all three authenticated roles. */
internal object AgrarDesign {
 val forest=Color(0xFF073F2B)
 val green=Color(0xFF07583A)
 val gold=Color(0xFFE5B64F)
 val cream=Color(0xFFF8F7F2)
 val ink=Color(0xFF1D3026)
 val subdued=Color(0xFF68776C)
}

@Composable
internal fun PortalHero(title:String,subtitle:String,colors:PortalPalette,onClick:(()->Unit)?=null){
 val shape=RoundedCornerShape(18.dp)
 val base=Modifier.fillMaxWidth().height(154.dp).clip(shape)
 Box(if(onClick==null)base else base.clickable(onClick=onClick)){
  Image(painterResource(R.drawable.agrar_fields_sunrise),contentDescription=null,modifier=Modifier.fillMaxSize(),contentScale=ContentScale.Crop)
  Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(listOf(AgrarDesign.forest.copy(alpha=.98f),AgrarDesign.forest.copy(alpha=.72f),Color.Transparent))))
  Column(Modifier.align(Alignment.BottomStart).padding(18.dp).fillMaxWidth(.86f),verticalArrangement=Arrangement.spacedBy(6.dp)){
   Text(title,color=Color.White,fontWeight=FontWeight.ExtraBold,fontSize=21.sp,lineHeight=25.sp)
   Text(subtitle,color=Color.White.copy(alpha=.93f),fontSize=12.sp,lineHeight=17.sp)
   if(onClick!=null)Text("Megnyitás  ›",color=AgrarDesign.gold,fontSize=12.sp,fontWeight=FontWeight.Bold)
  }
 }
}

@Composable
internal fun PortalMetric(label:String,value:String,colors:PortalPalette,onClick:()->Unit){
 Card(colors,onClick=onClick){
  Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.Top){
   Text(label,color=AgrarDesign.subdued,fontSize=12.sp,maxLines=2,modifier=Modifier.weight(1f))
   Icon(Icons.Default.ChevronRight,contentDescription="${label} megnyitása",tint=colors.accent,modifier=Modifier.size(18.dp))
  }
  Text(value,color=colors.accent,fontSize=22.sp,fontWeight=FontWeight.ExtraBold,maxLines=1)
 }
}

@Composable
internal fun PortalRouteTile(title:String,description:String,colors:PortalPalette,onClick:()->Unit){
 Card(colors,onClick=onClick){
  Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically){
   Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(3.dp)){
    Text(title,color=AgrarDesign.ink,fontWeight=FontWeight.Bold,fontSize=15.sp)
    Text(description,color=AgrarDesign.subdued,fontSize=12.sp,lineHeight=16.sp)
   }
   Icon(Icons.Default.ChevronRight,contentDescription="${title} megnyitása",tint=colors.accent)
  }
 }
}
