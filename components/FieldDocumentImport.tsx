"use client";

import {useEffect,useRef,useState,type MouseEvent} from "react";
import {registerParcelOutline,traceParcelFromImage,type MapControlPoint,type MapPoint,type RasterPoint,type RasterScan} from "@/lib/fieldMapImage";

type Props={
  ready:boolean;
  onCaptureMapPoint:(callback:((lat:number,lng:number)=>void)|null)=>void;
  onShowMapAnchors:(points:MapPoint[])=>void;
  onPreview:(geometry:unknown,description:string)=>void;
};

const MAX_FILE_BYTES=10_000_000;
const MAX_DIMENSION=1800;

function canvasCoordinates(canvas:HTMLCanvasElement,event:MouseEvent<HTMLCanvasElement>):RasterPoint{
  const box=canvas.getBoundingClientRect();
  return {x:(event.clientX-box.left)*canvas.width/box.width,y:(event.clientY-box.top)*canvas.height/box.height};
}

export function FieldDocumentImport({ready,onCaptureMapPoint,onShowMapAnchors,onPreview}:Props){
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const imageDataRef=useRef<ImageData|null>(null);
  const pdfRef=useRef<any>(null);
  const[opened,setOpened]=useState(false);
  const[loading,setLoading]=useState(false);
  const[imageVersion,setImageVersion]=useState(0);
  const[fileName,setFileName]=useState("");
  const[pdfPageCount,setPdfPageCount]=useState(0);
  const[pdfPage,setPdfPage]=useState(1);
  const[scan,setScan]=useState<RasterScan|null>(null);
  const[threshold,setThreshold]=useState(165);
  const[stage,setStage]=useState<"select"|"align">("select");
  const[points,setPoints]=useState<MapControlPoint[]>([]);
  const[pending,setPending]=useState<RasterPoint|null>(null);
  const[message,setMessage]=useState("");
  const[error,setError]=useState("");

  useEffect(()=>{
    onCaptureMapPoint(opened&&stage==="align"&&pending&&points.length<4
      ?(lat,lng)=>{
        setPoints(previous=>previous.length>=4?previous:[...previous,{image:pending,map:{lat,lng}}]);
        setPending(null);setMessage("Pontpár rögzítve. Válassz egy másik, mindkét térképen felismerhető pontot.");
      }
      :null);
    return()=>onCaptureMapPoint(null);
  },[opened,stage,pending,points.length,onCaptureMapPoint]);

  useEffect(()=>{
    onShowMapAnchors(opened?points.map(point=>point.map):[]);
    return()=>onShowMapAnchors([]);
  },[opened,points,onShowMapAnchors]);

  useEffect(()=>{
    const canvas=canvasRef.current,original=imageDataRef.current;
    if(!canvas||!original||!opened)return;
    const ctx=canvas.getContext("2d");if(!ctx)return;
    ctx.putImageData(original,0,0);
    if(scan){
      ctx.save();ctx.beginPath();
      scan.outline.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
      ctx.fillStyle="rgba(47,116,48,.16)";ctx.strokeStyle="#2f7430";ctx.lineWidth=3;ctx.fill();ctx.stroke();ctx.restore();
    }
    points.forEach((point,i)=>{
      ctx.beginPath();ctx.arc(point.image.x,point.image.y,10,0,2*Math.PI);
      ctx.fillStyle="#005ecc";ctx.fill();ctx.fillStyle="white";ctx.font="bold 13px sans-serif";ctx.textAlign="center";ctx.fillText(String(i+1),point.image.x,point.image.y+4);
    });
    if(pending){ctx.beginPath();ctx.arc(pending.x,pending.y,10,0,Math.PI*2);ctx.strokeStyle="#d27400";ctx.lineWidth=3;ctx.stroke()}
  },[opened,scan,points,pending,imageVersion]);

  function resetRecognition(){setScan(null);setPoints([]);setPending(null);setStage("select");setMessage("");setError("")}

  function showCanvas(canvas:HTMLCanvasElement){
    const target=canvasRef.current;if(!target)throw new Error("Nem érhető el a képfeldolgozó.");
    target.width=canvas.width;target.height=canvas.height;
    const ctx=target.getContext("2d",{willReadFrequently:true});
    if(!ctx)throw new Error("A böngésző nem támogatja a képfeldolgozást.");
    ctx.drawImage(canvas,0,0);
    imageDataRef.current=ctx.getImageData(0,0,target.width,target.height);
    setImageVersion(i=>i+1);
  }

  function sizedCanvas(width:number,height:number){
    const scale=Math.min(1,MAX_DIMENSION/Math.max(width,height),Math.sqrt(3_000_000/(width*height)));
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    return canvas;
  }

  async function renderPdfPage(pageNumber:number){
    const pdf=pdfRef.current;
    if(!pdf)return;
    setLoading(true);setError("");resetRecognition();
    try{
      const page=await pdf.getPage(pageNumber);
      const unscaled=page.getViewport({scale:1});
      const canvas=sizedCanvas(unscaled.width,unscaled.height);
      const viewport=page.getViewport({scale:canvas.width/unscaled.width});
      const context=canvas.getContext("2d",{willReadFrequently:true});
      if(!context)throw new Error("A PDF nem jeleníthető meg ebben a böngészőben.");
      context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);
      await page.render({canvas,canvasContext:context,viewport}).promise;
      showCanvas(canvas);setPdfPage(pageNumber);
      setMessage("Kattints a felismerendő földrészlet belsejére a dokumentumon.");
    }catch(err){setError(err instanceof Error?err.message:"A PDF oldalának megnyitása sikertelen.")}
    finally{setLoading(false)}
  }

  async function loadFile(file:File){
    resetRecognition();imageDataRef.current=null;pdfRef.current=null;setPdfPageCount(0);setFileName("");setImageVersion(i=>i+1);
    if(file.size>MAX_FILE_BYTES){setError("Legfeljebb 10 MB-os képet vagy PDF-et válassz.");return}
    const isPdf=/\.pdf$/i.test(file.name)||file.type==="application/pdf";
    const isImage=/\.(png|jpe?g|webp)$/i.test(file.name)||["image/png","image/jpeg","image/webp"].includes(file.type);
    if(!isPdf&&!isImage){setError("PDF, PNG, JPG vagy WebP dokumentumot válassz.");return}
    setLoading(true);
    try{
      if(isPdf){
        const pdfjs=await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc=new URL("pdfjs-dist/build/pdf.worker.min.mjs",import.meta.url).toString();
        const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
        if(pdf.numPages>50)throw new Error("A PDF túl sok oldalt tartalmaz. Csak a térképi oldal(oka)t tartalmazó dokumentumot töltsd fel.");
        pdfRef.current=pdf;setPdfPageCount(pdf.numPages);setFileName(file.name);
        await renderPdfPageFrom(pdf,1);
      }else{
        const bitmap=await createImageBitmap(file);
        const canvas=sizedCanvas(bitmap.width,bitmap.height);
        const ctx=canvas.getContext("2d");
        if(!ctx)throw new Error("Nem sikerült megnyitni a képet.");
        ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
        showCanvas(canvas);setFileName(file.name);
      }
      setMessage("Kattints a felismerendő földrészlet belsejére a dokumentumon.");
    }catch(err){setError(err instanceof Error?err.message:"A dokumentum nem olvasható.")}
    finally{setLoading(false)}
  }

  async function renderPdfPageFrom(pdf:any,pageNumber:number){
    const page=await pdf.getPage(pageNumber);
    const viewport=page.getViewport({scale:1});
    const canvas=sizedCanvas(viewport.width,viewport.height);
    const context=canvas.getContext("2d",{willReadFrequently:true});
    if(!context)throw new Error("Nem támogatott PDF.");
    context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);
    const scaled=page.getViewport({scale:canvas.width/viewport.width});
    await page.render({canvas,canvasContext:context,viewport:scaled}).promise;
    showCanvas(canvas);setPdfPage(pageNumber);
  }

  function onImageClick(event:MouseEvent<HTMLCanvasElement>){
    const original=imageDataRef.current,canvas=canvasRef.current;
    if(!original||!canvas||loading)return;
    const selected=canvasCoordinates(canvas,event);
    if(stage==="align"){
      if(points.length>=4){setError("Négy illesztési pont már megvan. Most már megjelenítheted az előnézetet.");return}
      setPending(selected);setError("");setMessage(`Most kattints a műholdas térképen ugyanerre a pontra (${points.length+1}/4).`);
      return;
    }
    try{
      const found=traceParcelFromImage(original,selected,threshold);
      setScan(found);setPoints([]);setPending(null);setError("");
      setMessage(`${found.outline.length} töréspontos körvonal felismerve. Ellenőrizd a zöld jelölést. Ha megfelelő, indítsd az illesztést.`);
    }catch(err){setScan(null);setError(err instanceof Error?err.message:"A földrészlet nem ismerhető fel.")}
  }

  function preview(){
    if(!scan||points.length<3)return;
    try{
      const polygon=registerParcelOutline(scan.outline,points,scan.width,scan.height);
      onPreview(polygon,`Dokumentumról felismert, ${points.length} ponttal illesztett becsült határ (${fileName})`);
      setMessage("Az előnézet a nagy térképre került. Nézd át a teljes határt, szükség esetén szerkeszd, és csak utána mentsd.");setError("");
    }catch(err){setError(err instanceof Error?err.message:"A pontok alapján nem készíthető érvényes poligon.")}
  }

  return <div style={{padding:12,border:"1px solid #d7e2d6",borderRadius:10,background:"#f8faf7",display:"grid",gap:9}}>
    <button className="ghost-btn" type="button" aria-expanded={opened} onClick={()=>setOpened(open=>!open)} style={{justifyContent:"space-between",textAlign:"left",whiteSpace:"normal"}}>
      <strong>📄 Földtábla felismerése térképfotóból vagy PDF-ből (kísérleti)</strong>
      <span>{opened?"Bezárás":"Megnyitás"}</span>
    </button>
    {opened&&<>
      <small style={{color:"#526253"}}>A feldolgozás a böngésződben történik, a dokumentumot nem töltjük fel a szerverre. A program a rajzolt vonalat próbálja megtalálni; a jogi földrészlet határa nem feltétlenül azonos a ténylegesen művelt tábláéval.</small>
      <label style={{fontSize:13}}>Térképfotó vagy térképi PDF kiválasztása
        <input aria-label="Térképfotó vagy PDF kiválasztása" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" disabled={!ready||loading} onChange={async event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value="";if(file)await loadFile(file)}}/>
      </label>
      {pdfPageCount>1&&<label style={{fontSize:13}}>PDF-oldal
        <select value={pdfPage} disabled={loading} onChange={event=>void renderPdfPage(Number(event.target.value))}>{Array.from({length:pdfPageCount},(_,i)=><option key={i} value={i+1}>{i+1}. oldal</option>)}</select>
      </label>}
      {loading&&<p role="status" style={{margin:0,fontSize:12}}>Dokumentum feldolgozása a telefonodon vagy számítógépeden…</p>}
      {imageVersion>0&&imageDataRef.current&&<>
        <label style={{display:"grid",gap:4,fontSize:12}}>Vonalérzékenység: {threshold}
          <input type="range" min="80" max="220" step="5" value={threshold} disabled={loading||stage==="align"} onChange={event=>{setThreshold(Number(event.target.value));setScan(null);setPoints([]);setPending(null);setMessage("Kattints újra a földrészlet belsejére.")}}/>
        </label>
        <small style={{color:"#526253"}}>{stage==="select"?"1. Kattints a papírtérképen a kívánt földrészlet VILÁGOS belsejébe. A zöld körvonal előnézet, még nincs térképi helye.":pending?`2. Kattints a NAGY műholdas térképen a képen narancssárgával jelölt pontra (${points.length+1}/4).`:`2. Kattints a képen egy jól felismerhető sarokra, majd a műholdas térképen ugyanerre a sarokra. Legalább három különböző pontpár kell (${points.length}/4).`}</small>
        {scan&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {stage==="select"?<button className="btn btn-secondary" type="button" onClick={()=>{setStage("align");setMessage("Elsőként kattints egy jól felismerhető sarokra a dokumentumon.")}}>Körvonal megfelelő – térképre illesztés</button>:<>
            <button className="ghost-btn" type="button" disabled={!points.length&&!pending} onClick={()=>{if(pending)setPending(null);else setPoints(p=>p.slice(0,-1));setError("")}}>Utolsó pont visszavonása</button>
            <button className="ghost-btn" type="button" onClick={resetRecognition}>Körvonal újrafelismerése</button>
            <button className="btn btn-secondary" type="button" disabled={points.length<3||!!pending} onClick={preview}>Poligon előnézete a térképen ({points.length} pont)</button>
          </>}
        </div>}
      </>}
      <canvas ref={canvasRef} onClick={onImageClick} role="button" aria-label={stage==="select"?"Kattints a földrészlet belsejébe a vonalfelismeréshez":"Kattints egy illesztési pontra a dokumentumon"} style={{display:imageVersion>0&&imageDataRef.current?"block":"none",width:"100%",height:"auto",cursor:"crosshair",border:"1px solid #b6c7b6",borderRadius:8}}/>
      {message&&<p role="status" style={{margin:0,color:"#29633a",fontSize:12}}>{message}</p>}
      {error&&<p role="alert" style={{margin:0,color:"#b3342b",fontSize:12}}>{error}</p>}
      <small style={{color:"#734b12"}}>A kép alapján számított határ csak <strong>becslés</strong>, nem hiteles földhivatali adat. Hiányos, elmosódott vagy feliratokkal megszakított vonalaknál a felismerés hibázhat. Az illesztett poligont mentés előtt minden esetben ellenőrizd a műholdképen.</small>
    </>}
  </div>;
}
