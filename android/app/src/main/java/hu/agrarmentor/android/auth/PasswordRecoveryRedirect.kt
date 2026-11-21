package hu.agrarmentor.android.auth

import java.net.URI
import java.net.URLEncoder

/** Keep recovery tokens in the existing web reset flow until a verified app-link is deployed. */
internal fun passwordRecoveryEndpoint(webOrigin:String):String?{
 val origin=runCatching{URI(webOrigin)}.getOrNull()?:return null
 if(origin.scheme!="https"||origin.host.isNullOrBlank()||origin.port !in setOf(-1,443)||
  origin.userInfo!=null||origin.query!=null||origin.fragment!=null||
  (!origin.path.isNullOrEmpty()&&origin.path!="/"))return null
 val redirect="${webOrigin.trimEnd('/')}/reset-password"
 return "auth/v1/recover?redirect_to=${URLEncoder.encode(redirect,"UTF-8")}"
}
