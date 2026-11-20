package hu.agrarmentor.android.data

/** Matches the existing private documents Storage bucket and web uploader. */
internal object DocumentUploadRules {
 const val MAX_BYTES=20L*1024*1024
 const val MAX_TITLE=200
 const val MAX_NOTES=500
 const val MAX_NAME=255
 val categories=listOf(
  "talajvizsgalat" to "Talajvizsgálat", "permetezes" to "Permetezés",
  "szerzodes" to "Szerződés", "szamla" to "Számla",
  "foto" to "Fénykép", "egyeb" to "Egyéb"
 )
 private val allowedMimeTypes=setOf(
  "application/pdf", "image/jpeg", "image/png", "image/webp",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
 )

 fun validFile(mimeType:String,size:Long?):Boolean = mimeType in allowedMimeTypes && (size==null||size in 1..MAX_BYTES)
 fun validDetails(title:String,notes:String,category:String):Boolean =
  title.trim().length in 1..MAX_TITLE && notes.length<=MAX_NOTES && categories.any{it.first==category}
 fun safeName(name:String):String = name.replace(Regex("[^a-zA-Z0-9._-]"),"_").take(120).ifBlank{"dokumentum"}
}
