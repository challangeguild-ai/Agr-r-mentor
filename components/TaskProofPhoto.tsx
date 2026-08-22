"use client";
import {useEffect,useState} from "react";
import {createClient} from "@/lib/supabase/client";
export function TaskProofPhoto({path,name}:{path:string;name:string}){const[url,setUrl]=useState("");useEffect(()=>{let alive=true;(async()=>{const supabase=createClient();const{data}=await supabase.storage.from("farmer-report-media").createSignedUrl(path,3600);if(alive&&data?.signedUrl)setUrl(data.signedUrl)})();return()=>{alive=false}},[path]);if(!url)return <span style={{fontSize:10,color:"#7b837d"}}>Fotó betöltése…</span>;return <a className="ghost-btn" href={url} target="_blank" rel="noreferrer" title={name}>Helyszíni fotó ↗</a>}
