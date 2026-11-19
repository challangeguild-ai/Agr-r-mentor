import assert from "node:assert/strict";
import test from "node:test";
import {traceParcelFromImage,registerParcelOutline} from "../lib/fieldMapImage.ts";

function makeImage(width=120,height=100){
  const data=new Uint8ClampedArray(width*height*4).fill(255);
  return {width,height,data};
}
function darkPixel(image,x,y,shade=25){
  const offset=(y*image.width+x)*4;
  image.data[offset]=image.data[offset+1]=image.data[offset+2]=shade;
}
function rectangle(image,{left=20,top=15,right=90,bottom=80,gap=false,shade=25}={}){
  for(let x=left;x<=right;x++){
    if(!gap||x<50||x>58)darkPixel(image,x,top,shade);
    darkPixel(image,x,bottom,shade);
  }
  for(let y=top;y<=bottom;y++){
    darkPixel(image,left,y,shade);darkPixel(image,right,y,shade);
  }
}

test("scanned parcel traces a closed irregular number-free border without losing corners",()=>{
  const image=makeImage();rectangle(image);
  for(let y=44;y<=49;y++)for(let x=45;x<=47;x++)darkPixel(image,x,y); // HRSZ label fragment
  const result=traceParcelFromImage(image,{x:32,y:35});
  assert.ok(result.outline.length>=4&&result.outline.length<100);
  assert.ok(result.pixels>3500);
  assert.ok(Math.min(...result.outline.map(p=>p.x))>=20);
  assert.ok(Math.max(...result.outline.map(p=>p.x))<=90);
  assert.ok(Math.min(...result.outline.map(p=>p.y))>=15);
  assert.ok(Math.max(...result.outline.map(p=>p.y))<=80);
});

test("concave, non-rectangular L-shaped parcel keeps its inward corners",()=>{
  const image=makeImage(140,120);
  const vertices=[[20,20],[110,20],[110,45],[70,45],[70,95],[20,95],[20,20]];
  for(let i=0;i<vertices.length-1;i++){
    const [ax,ay]=vertices[i],[bx,by]=vertices[i+1];
    const steps=Math.max(Math.abs(bx-ax),Math.abs(by-ay));
    for(let j=0;j<=steps;j++)darkPixel(image,Math.round(ax+(bx-ax)*j/steps),Math.round(ay+(by-ay)*j/steps));
  }
  const result=traceParcelFromImage(image,{x:35,y:35});
  assert.ok(result.outline.length>=6);
  assert.ok(result.outline.some(p=>Math.abs(p.x-70)<4&&Math.abs(p.y-45)<4));
  assert.ok(result.pixels>3500&&result.pixels<5200);
});

test("adjacent printed parcels are not automatically merged",()=>{
  const image=makeImage();rectangle(image);
  for(let y=15;y<=80;y++)darkPixel(image,55,y);
  const left=traceParcelFromImage(image,{x:32,y:35});
  const right=traceParcelFromImage(image,{x:75,y:35});
  assert.ok(Math.max(...left.outline.map(p=>p.x))<=55);
  assert.ok(Math.min(...right.outline.map(p=>p.x))>=55);
});

test("open boundaries fail closed, rather than turning the page background into a parcel",()=>{
  const image=makeImage();rectangle(image,{gap:true});
  assert.throws(()=>traceParcelFromImage(image,{x:32,y:35}),/nem záródik|háttér/);
});

test("line sensitivity can recover pale ink, but does not claim a polygon otherwise",()=>{
  const image=makeImage();rectangle(image,{shade:190});
  assert.throws(()=>traceParcelFromImage(image,{x:32,y:35},165));
  assert.ok(traceParcelFromImage(image,{x:32,y:35},210).outline.length>=4);
});

test("three matched map points align all traced corners with a metric affine transform",()=>{
  const outline=[{x:20,y:20},{x:80,y:20},{x:80,y:70},{x:20,y:70}];
  const metersPerDegree=111_000;
  const map=(p)=>({lng:19.5+p.x/metersPerDegree,lat:47.2-p.y/metersPerDegree});
  const points=[outline[0],outline[1],outline[3]].map(image=>({image,map:map(image)}));
  const result=registerParcelOutline(outline,points,100,100);
  assert.equal(result.coordinates[0].length,5);
  assert.deepEqual(result.coordinates[0][0],result.coordinates[0][4]);
  const [,lat]=result.coordinates[0][2];
  assert.ok(Math.abs(lat-map(outline[2]).lat)<.000005);
});

test("four registration points handle perspective, with an independent interior point",()=>{
  const image=[{x:10,y:10},{x:90,y:10},{x:90,y:90},{x:10,y:90},{x:50,y:50}];
  const project=p=>{
    const x=p.x/100,y=p.y/100,denom=1+.17*x-.11*y;
    const east=(x*300+y*50)/denom;
    const north=(y*300-x*50)/denom;
    return {lat:47.2+north/111000,lng:19.5+east/(111000*Math.cos(47.2*Math.PI/180))};
  };
  const points=image.slice(0,4).map(p=>({image:p,map:project(p)}));
  const result=registerParcelOutline(image,points,100,100);
  const mapped=result.coordinates[0][4];
  assert.ok(Math.abs(mapped[0]-project(image[4]).lng)<.000012);
  assert.ok(Math.abs(mapped[1]-project(image[4]).lat)<.000012);
});

test("insufficient and collinear references are rejected before exposing the geometry",()=>{
  const outline=[{x:20,y:20},{x:80,y:20},{x:80,y:70}];
  assert.throws(()=>registerParcelOutline(outline,[],100,100),/3/);
  const controls=[20,40,60].map(x=>({image:{x,y:20},map:{lat:47.2,lng:19.5+x/100000}}));
  assert.throws(()=>registerParcelOutline(outline,controls,100,100),/egyenesre esnek/);
});
