package hu.agrarmentor.android.data

/** Only four known web workflows are linkable. Never append an auth token or untrusted route. */
internal fun safeWebModuleUrl(origin:String,path:String):String?{
 if(path !in setOf(
  "/admin/map/import",
  "/admin/plant-protection-import",
  "/system-admin/weather",
  "/system-admin/backup"
 ))return null
 val uri=runCatching{java.net.URI(origin)}.getOrNull()?:return null
 if(uri.scheme!="https"||uri.host.isNullOrBlank()||uri.port !in setOf(-1,443)||
  uri.userInfo!=null||uri.query!=null||uri.fragment!=null||
  (!uri.path.isNullOrEmpty()&&uri.path!="/"))return null
 return "${origin.trimEnd('/')}$path"
}
