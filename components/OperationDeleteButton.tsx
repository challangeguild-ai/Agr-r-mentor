"use client";
import {useState} from "react";
import {deleteFieldOperation} from "@/app/operations/actions";
export function OperationDeleteButton({id}:{id:string}){const[busy,setBusy]=useState(false);async function remove(){if(!confirm("Biztosan törlöd ezt a műveleti bejegyzést?"))return;setBusy(true);try{await deleteFieldOperation(id);window.location.reload()}catch(e){alert(e instanceof Error?e.message:"A törlés sikertelen.");setBusy(false)}}return <button type="button" className="ghost-btn" onClick={remove} disabled={busy}>{busy?"Törlés…":"Törlés"}</button>}
