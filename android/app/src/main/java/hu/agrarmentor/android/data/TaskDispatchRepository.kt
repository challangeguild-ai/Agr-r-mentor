package hu.agrarmentor.android.data

import hu.agrarmentor.android.auth.AuthorizedSession
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate

data class DispatchFarm(val id:String,val name:String,val ownerId:String)
data class DispatchField(val id:String,val name:String,val farmId:String)
data class DispatchPerson(val id:String,val name:String,val farmId:String)
data class DispatchChoices(val farms:List<DispatchFarm>,val fields:List<DispatchField>,val people:List<DispatchPerson>)
data class DispatchDraft(val farmId:String,val fieldId:String,val assignedTo:String,val title:String,val description:String,val dueDate:String?,val priority:String)
data class DispatchResult(val alreadyExisted:Boolean,val timelineWarning:Boolean)

/**
 * The same farmer manager/assignee checks and stable UUID retry contract as the
 * web dispatch action. PostgREST policies still decide whether INSERT is legal.
 */
class TaskDispatchRepository(private val baseUrl:String,private val publishableKey:String){
 suspend fun choices(session:AuthorizedSession):DispatchChoices = withContext(Dispatchers.IO){
  val ownerFarms=read("farms?select=id,name,owner_id&order=name.asc&limit=1000",session)
  val memberships=read("farm_members?select=farm_id,member_role,active&user_id=eq.${uuid(session.userId)}&active=eq.true&limit=1000",session)
  val manageable=memberships.filter{it.optString("member_role") in listOf("manager","agronomist")}
   .map{it.optString("farm_id")}.toSet()
  val farms=ownerFarms.filter{it.optString("owner_id")==session.userId||it.optString("id") in manageable}
   .map{DispatchFarm(it.getString("id"),it.optString("name"),it.getString("owner_id"))}
  if(farms.isEmpty())return@withContext DispatchChoices(emptyList(),emptyList(),emptyList())
  val ids=farms.map{uuid(it.id)}.joinToString(",")
  val fields=read("fields?select=id,name,farm_id&farm_id=in.($ids)&order=name.asc&limit=1000",session)
   .map{DispatchField(it.getString("id"),it.optString("name"),it.getString("farm_id"))}
  val memberRows=read("farm_members?select=farm_id,user_id,active&farm_id=in.($ids)&active=eq.true&limit=1000",session)
  val memberIds=(farms.map{it.ownerId}+memberRows.map{it.optString("user_id")}).filter{it.isNotBlank()}.distinct()
  val names=if(memberIds.isEmpty())emptyMap()else runCatching{
   read("profiles?select=id,full_name&id=in.(${memberIds.joinToString(",")})",session)
    .associate{it.getString("id") to it.optString("full_name")}
  }.getOrDefault(emptyMap())
  val people=(farms.map{farm->DispatchPerson(farm.ownerId,names[farm.ownerId]?.ifBlank{"Gazdálkodó"}?:"Gazdálkodó",farm.id)}+
   memberRows.map{row->
    val id=row.getString("user_id")
    DispatchPerson(id,names[id]?.ifBlank{"Munkatárs"}?:"Munkatárs",row.getString("farm_id"))
   }).distinctBy{it.id to it.farmId}
  DispatchChoices(farms,fields,people)
 }

 suspend fun dispatch(session:AuthorizedSession,draft:DispatchDraft,requestId:String):DispatchResult = withContext(Dispatchers.IO){
  val valid=choices(session)
  val farm=valid.farms.firstOrNull{it.id==draft.farmId}?:error("Nincs kiosztási jogosultság a gazdasághoz.")
  val field=valid.fields.firstOrNull{it.id==draft.fieldId&&it.farmId==farm.id}?:error("A tábla nem ehhez a gazdasághoz tartozik.")
  require(valid.people.any{it.id==draft.assignedTo&&it.farmId==farm.id}){"A munkatárs nem aktív tagja a gazdaságnak."}
  val title=draft.title.trim()
  val description=draft.description.trim()
  require(title.length in 1..180&&description.length<=3000)
  require(draft.priority in listOf("normal","high","urgent"))
  val due=draft.dueDate?.takeIf{it.isNotBlank()}
  require(due==null||runCatching{LocalDate.parse(due).toString()==due}.getOrDefault(false))
  val safeId=uuid(requestId)
  val payload=JSONObject().put("id",safeId).put("farm_id",farm.id).put("field_id",field.id)
   .put("title",title).put("description",if(description.isBlank())JSONObject.NULL else description)
   .put("due_date",due?:JSONObject.NULL).put("priority",draft.priority).put("status","open")
   .put("assigned_to",uuid(draft.assignedTo)).put("created_by",uuid(session.userId))
  val existing=findTask(session,safeId)
  if(existing!=null)return@withContext DispatchResult(confirmed(existing,payload),false)

  var inserted=false
  try{
   val reply=request("POST","tasks",session,payload,"return=representation")
   inserted=JSONArray(reply).optJSONObject(0)?.optString("id")==safeId
  }catch(_:Exception){
   // Network timeout or duplicate key: the first INSERT may have succeeded.
  }
  if(!inserted){
   val recovered=findTask(session,safeId)
   if(recovered!=null)return@withContext DispatchResult(confirmed(recovered,payload),false)
   error("A mentés nem igazolható. Nézd át a teendőlistát újraküldés előtt.")
  }
  var warning=false
  val now=java.time.Instant.now().toString()
  runCatching{
   request("POST","timeline_events",session,JSONObject().put("farm_id",farm.id).put("field_id",field.id)
    .put("event_type","task").put("title","Munka kiosztva: $title").put("description",if(description.isBlank())JSONObject.NULL else description)
    .put("event_at",now).put("created_by",session.userId).put("source_id",safeId))
  }.onFailure{warning=true}
  DispatchResult(false,warning)
 }

 private fun confirmed(saved:JSONObject,payload:JSONObject):Boolean{
  for(key in listOf("id","farm_id","field_id","title","description","due_date","priority","assigned_to","created_by")){
   if(saved.optString(key).trim()!=payload.optString(key).trim() &&
    !(saved.isNull(key)&&payload.isNull(key)))error("A mentési azonosító már másik feladathoz tartozik.")
  }
  return true
 }

 private fun findTask(session:AuthorizedSession,id:String):JSONObject?=
  read("tasks?select=id,farm_id,field_id,title,description,due_date,priority,assigned_to,created_by&id=eq.${uuid(id)}&limit=1",session).firstOrNull()

 private fun read(path:String,session:AuthorizedSession):List<JSONObject>{
  val array=JSONArray(request("GET",path,session))
  return (0 until array.length()).map{array.getJSONObject(it)}
 }

 private fun request(method:String,path:String,session:AuthorizedSession,body:JSONObject?=null,prefer:String?=null):String{
  require(baseUrl.startsWith("https://")&&publishableKey.isNotBlank())
  val connection=(URL("${baseUrl.trimEnd('/')}/rest/v1/$path").openConnection() as HttpURLConnection).apply{
   requestMethod=method;connectTimeout=12000;readTimeout=12000
   setRequestProperty("apikey",publishableKey)
   setRequestProperty("Authorization","Bearer ${session.accessToken}")
   setRequestProperty("Content-Type","application/json")
   if(prefer!=null)setRequestProperty("Prefer",prefer)
   if(body!=null){doOutput=true;outputStream.use{it.write(body.toString().toByteArray(Charsets.UTF_8))}}
  }
  return try{
   if(connection.responseCode !in 200..299)error("Szerverhiba (${connection.responseCode}).")
   connection.inputStream.bufferedReader().use{it.readText()}
  }finally{connection.disconnect()}
 }

 private fun uuid(raw:String):String{
  require(raw.matches(Regex("[a-fA-F0-9-]{36}"))){"Érvénytelen azonosító."}
  return raw
 }
}
