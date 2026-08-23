"use client";

import {deleteFarm,deleteField} from "@/app/admin/delete-actions";

type Props={
 type:"farm"|"field";
 id:string;
 name:string;
};

export function AdminDeleteButton({type,id,name}:Props){
 const action=type==="farm"?deleteFarm:deleteField;
 const label=type==="farm"?"Gazdaság törlése":"Földtábla törlése";
 const warning=type==="farm"
  ?`Biztosan törlöd a(z) „${name}” gazdaságot?\n\nA gazdaság összes földtáblája és a hozzájuk kapcsolódó szakmai adatok is törlődnek. Ez a művelet nem vonható vissza.`
  :`Biztosan törlöd a(z) „${name}” földtáblát?\n\nA táblához kapcsolódó szemlék, feladatok, bejelentések, dokumentumkapcsolatok és idővonal-események is törlődnek. Ez a művelet nem vonható vissza.`;
 return <form action={action} onSubmit={e=>{if(!window.confirm(warning))e.preventDefault();}} style={{display:"inline"}}>
  <input type="hidden" name={type==="farm"?"farm_id":"field_id"} value={id}/>
  <button type="submit" className="ghost-btn" style={{color:"#a4382f",borderColor:"#e5bbb6",background:"#fff8f7"}}>{label}</button>
 </form>;
}
