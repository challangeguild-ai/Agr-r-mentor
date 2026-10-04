"use client";
import {useMemo} from "react";

type Props={lat:number|null;lng:number|null;boundary:any|null;className?:string;label?:string};
type Pt=[number,number];

function polygonPoints(boundary:any):Pt[]{
 try{
  const parsed=typeof boundary==="string"?JSON.parse(boundary):boundary;
  const coords=parsed?.type==="Polygon"?parsed.coordinates?.[0]:parsed?.type==="MultiPolygon"?parsed.coordinates?.[0]?.[0]:null;
  return Array.isArray(coords)?coords.filter((p:any)=>Array.isArray(p)&&Number.isFinite(Number(p[0]))&&Number.isFinite(Number(p[1]))).map((p:any)=>[Number(p[0]),Number(p[1])] as Pt):[];
 }catch{return[]}
}
export function FieldMiniMap({lat,lng,boundary,className,label="Földtábla térkép"}:Props){
 const data=useMemo(()=>{
  const pts=polygonPoints(boundary);const all=pts.length?pts:(lat!=null&&lng!=null?[[lng,lat] as Pt]:[]);
  if(!all.length)return null;
  const xs=all.map(p=>p[0]),ys=all.map(p=>p[1]);let minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  if(minX===maxX){minX-=.006;maxX+=.006}if(minY===maxY){minY-=.004;maxY+=.004}
  const padX=(maxX-minX)*.28,padY=(maxY-minY)*.28;minX-=padX;maxX+=padX;minY-=padY;maxY+=padY;
  const centerLat=(minY+maxY)/2,centerLng=(minX+maxX)/2;
  const key=process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  let image="";
  if(key){
   const path=pts.length?`&path=${encodeURIComponent("color:0xd9b63fff|weight:3|fillcolor:0x3b7c3f38|"+pts.map(([x,y])=>`${y},${x}`).join("|"))}`:"";
   image=`https://maps.googleapis.com/maps/api/staticmap?center=${centerLat},${centerLng}&zoom=15&size=420x240&scale=1&maptype=satellite${path}&key=${encodeURIComponent(key)}`;
  }else{
   image=`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${minX},${minY},${maxX},${maxY}&bboxSR=4326&imageSR=4326&size=420,240&format=jpg&f=image`;
  }
  const svg=pts.length?pts.map(([x,y])=>`${((x-minX)/(maxX-minX))*100},${100-((y-minY)/(maxY-minY))*100}`).join(" "):"";
  return{image,svg};
 },[lat,lng,boundary]);
 return <span className={className} role="img" aria-label={label} style={{position:"relative",display:"block",overflow:"hidden",background:data?`#d9dfd2 url("${data.image}") center/cover no-repeat`:"#dfe6dc"}}>
  {data?.svg&&<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}><polygon points={data.svg} fill="rgba(62,126,68,.22)" stroke="#f0d65f" strokeWidth="2.2" vectorEffect="non-scaling-stroke"/></svg>}
 </span>
}
