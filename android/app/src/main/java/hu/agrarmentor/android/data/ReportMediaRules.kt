package hu.agrarmentor.android.data

internal object ReportMediaRules {
 const val MAX_ITEMS=10
 const val MAX_BYTES=50L*1024*1024
 private val allowed=setOf("image/jpeg","image/png","image/webp","video/mp4","video/webm","video/quicktime")

 fun valid(mimeType:String,size:Long?):Boolean = mimeType in allowed && (size==null||size in 1..MAX_BYTES)
 fun kind(mimeType:String):String = if(mimeType.startsWith("image/"))"image"else"video"
 fun safeName(name:String):String = name.replace(Regex("[^a-zA-Z0-9._-]"),"_").take(120).ifBlank{"csatolmany"}
}
