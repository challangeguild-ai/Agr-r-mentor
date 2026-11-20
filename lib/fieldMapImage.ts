/** Local, browser-only raster boundary tracing and map registration.
 * A traced paper map is an estimate, NEVER an official surveyed boundary.
 */

export type RasterPoint = {x:number;y:number};
export type MapPoint = {lat:number;lng:number};
export type MapControlPoint = {image:RasterPoint;map:MapPoint};

export type RasterScan = {
  outline:RasterPoint[];
  pixels:number;
  width:number;
  height:number;
};

function pointDistanceToSegment(point:RasterPoint,a:RasterPoint,b:RasterPoint){
  const dx=b.x-a.x,dy=b.y-a.y;
  const t=dx*dx+dy*dy?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy))):0;
  return Math.hypot(point.x-(a.x+t*dx),point.y-(a.y+t*dy));
}

function simplifyOpen(points:RasterPoint[],epsilon:number):RasterPoint[]{
  if(points.length<3)return points;
  let index=-1,max=epsilon;
  for(let i=1;i<points.length-1;i++){
    const distance=pointDistanceToSegment(points[i],points[0],points[points.length-1]);
    if(distance>max){max=distance;index=i}
  }
  if(index<0)return [points[0],points[points.length-1]];
  const left=simplifyOpen(points.slice(0,index+1),epsilon);
  const right=simplifyOpen(points.slice(index),epsilon);
  return [...left.slice(0,-1),...right];
}

function signedArea(points:RasterPoint[]){
  let area=0;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    area+=a.x*b.y-b.x*a.y;
  }
  return area/2;
}

function simplifyRing(ring:RasterPoint[],epsilon:number){
  const first=ring[0];
  let farIndex=1,far=0;
  for(let i=1;i<ring.length;i++){
    const distance=Math.hypot(ring[i].x-first.x,ring[i].y-first.y);
    if(distance>far){far=distance;farIndex=i}
  }
  const a=simplifyOpen(ring.slice(0,farIndex+1),epsilon);
  const b=simplifyOpen([...ring.slice(farIndex),first],epsilon);
  const merged=[...a.slice(0,-1),...b.slice(0,-1)];
  return merged.length>=3?merged:ring;
}

/** Flood-fill the bright area selected by the user, then trace its outer line. */
export function traceParcelFromImage(image:{width:number;height:number;data:Uint8ClampedArray},click:RasterPoint,threshold=165):RasterScan{
  const {width:w,height:h,data}=image;
  if(w<30||h<30||w*h>4_000_000||data.length!==w*h*4)throw new Error("A térképkép mérete nem megfelelő.");
  if(!Number.isFinite(threshold)||threshold<60||threshold>230)throw new Error("Érvénytelen vonalérzékenység.");
  const seedX=Math.floor(click.x),seedY=Math.floor(click.y);
  if(seedX<1||seedY<1||seedX>=w-1||seedY>=h-1)throw new Error("Kattints a földrészlet belsejébe, a képszélektől távol.");
  const count=w*h,blocked=new Uint8Array(count);
  for(let i=0;i<count;i++){
    const j=i*4;
    // Composite any transparent background over white, rather than treating it as black.
    const alpha=data[j+3]/255;
    const brightness=(.2126*data[j]+.7152*data[j+1]+.0722*data[j+2])*alpha+255*(1-alpha);
    blocked[i]=brightness<threshold?1:0;
  }
  // Bridge tiny breaks in scanned pencil/printed borders without cloud services.
  const closed=new Uint8Array(blocked);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const index=y*w+x;
    if(blocked[index]){
      closed[index-1]=1;closed[index+1]=1;closed[index-w]=1;closed[index+w]=1;
    }
  }
  const seed=seedY*w+seedX;
  if(closed[seed])throw new Error("A kijelölt pont vonalon vagy feliraton van. Kattints a világos terület belsejébe.");
  const visited=new Uint8Array(count),queue=new Int32Array(count);
  let head=0,tail=1,touchesEdge=false;
  queue[0]=seed;visited[seed]=1;
  while(head<tail){
    const i=queue[head++],x=i%w,y=(i-x)/w;
    if(x===0||y===0||x===w-1||y===h-1)touchesEdge=true;
    if(x>0&&!closed[i-1]&&!visited[i-1]){visited[i-1]=1;queue[tail++]=i-1}
    if(x<w-1&&!closed[i+1]&&!visited[i+1]){visited[i+1]=1;queue[tail++]=i+1}
    if(y>0&&!closed[i-w]&&!visited[i-w]){visited[i-w]=1;queue[tail++]=i-w}
    if(y<h-1&&!closed[i+w]&&!visited[i+w]){visited[i+w]=1;queue[tail++]=i+w}
  }
  if(touchesEdge||tail>=count*.65)throw new Error("A körvonal nem záródik, vagy a háttér lett kijelölve. Válassz tisztább képet, illetve állíts a vonalérzékenységen.");
  if(tail<Math.max(100,count*.00002))throw new Error("Túl kicsi területet érzékeltünk. Kattints a földrészlet belsejére.");

  // Clockwise pixel-cell edges, sorted into one or more rings. Keep the largest
  // outer ring; holes caused by HRSZ letters are not real parcel exclusions.
  const edges=new Map<number,number>();
  const node=(x:number,y:number)=>y*(w+1)+x;
  for(let j=0;j<tail;j++){
    const i=queue[j],x=i%w,y=(i-x)/w;
    if(y===0||!visited[i-w])edges.set(node(x,y),node(x+1,y));
    if(x===w-1||!visited[i+1])edges.set(node(x+1,y),node(x+1,y+1));
    if(y===h-1||!visited[i+w])edges.set(node(x+1,y+1),node(x,y+1));
    if(x===0||!visited[i-1])edges.set(node(x,y+1),node(x,y));
  }
  let best:RasterPoint[]=[];
  while(edges.size){
    const start=edges.keys().next().value as number;
    const ring:RasterPoint[]=[];
    let current=start;
    while(edges.has(current)&&ring.length<count*2){
      ring.push({x:current%(w+1),y:Math.floor(current/(w+1))});
      const next=edges.get(current)!;
      edges.delete(current);current=next;
      if(current===start)break;
    }
    if(current===start&&ring.length>=4&&Math.abs(signedArea(ring))>Math.abs(signedArea(best)))best=ring;
  }
  if(best.length<4)throw new Error("Nem sikerült zárt földrészlethatárt felismerni.");
  const outline=simplifyRing(best,1.25);
  if(outline.length<3||outline.length>12000)throw new Error("A felismert körvonal túl összetett vagy sérült.");
  return {outline,pixels:tail,width:w,height:h};
}

const EARTH_RADIUS=6378137;
const RAD=Math.PI/180;
function mercator(point:MapPoint):[number,number]{
  if(!Number.isFinite(point.lat)||!Number.isFinite(point.lng)||Math.abs(point.lat)>85||Math.abs(point.lng)>180)throw new Error("Hibás térképi illesztési pont.");
  return [EARTH_RADIUS*point.lng*RAD,EARTH_RADIUS*Math.log(Math.tan(Math.PI/4+point.lat*RAD/2))];
}
function inverseMercator(x:number,y:number):[number,number]{
  return [x/EARTH_RADIUS/RAD,(2*Math.atan(Math.exp(y/EARTH_RADIUS))-Math.PI/2)/RAD];
}

function solveSystem(rows:number[][],values:number[]){
  const n=values.length,m=rows.map((row,i)=>[...row,values[i]]);
  for(let col=0;col<n;col++){
    let pivot=col;
    for(let row=col+1;row<n;row++)if(Math.abs(m[row][col])>Math.abs(m[pivot][col]))pivot=row;
    if(Math.abs(m[pivot][col])<1e-11)throw new Error("Az illesztési pontok túl közel vannak egymáshoz, vagy egy egyenesre esnek.");
    [m[pivot],m[col]]=[m[col],m[pivot]];
    const scale=m[col][col];for(let j=col;j<=n;j++)m[col][j]/=scale;
    for(let row=0;row<n;row++)if(row!==col){const factor=m[row][col];for(let j=col;j<=n;j++)m[row][j]-=factor*m[col][j]}
  }
  return m.map(row=>row[n]);
}

/** 3-point affine alignment or 4-point projective alignment in local Web Mercator coordinates. */
export function registerParcelOutline(outline:RasterPoint[],points:MapControlPoint[],width:number,height:number){
  if(points.length!==3&&points.length!==4)throw new Error("Legalább 3, ferde fotóhoz lehetőleg 4 illesztési pont szükséges.");
  if(width<=0||height<=0||outline.length<3)throw new Error("Hiányzik a felismert körvonal.");
  const reference=mercator(points[0].map);
  const inputs=points.map(p=>({x:p.image.x/width,y:p.image.y/height,geo:mercator(p.map)}));
  const rows:number[][]=[],values:number[]=[];
  for(const p of inputs){
    const x=p.x,y=p.y,u=(p.geo[0]-reference[0])/1000,v=(p.geo[1]-reference[1])/1000;
    if(points.length===3){rows.push([x,y,1,0,0,0],[0,0,0,x,y,1]);values.push(u,v)}
    else{rows.push([x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]);values.push(u,v)}
  }
  const params=solveSystem(rows,values);
  const ring=outline.map(p=>{
    const x=p.x/width,y=p.y/height;
    const divisor=points.length===4?params[6]*x+params[7]*y+1:1;
    if(!Number.isFinite(divisor)||Math.abs(divisor)<.03)throw new Error("Az illesztés túlzottan torzít. Válassz másik három vagy négy pontot.");
    const u=(params[0]*x+params[1]*y+params[2])/divisor;
    const v=(params[3]*x+params[4]*y+params[5])/divisor;
    if(!Number.isFinite(u)||!Number.isFinite(v)||Math.hypot(u,v)>100)throw new Error("A poligon irreálisan messzire került az illesztési pontoktól.");
    return inverseMercator(reference[0]+u*1000,reference[1]+v*1000);
  });
  ring.push([...ring[0]]);
  return {type:"Polygon" as const,coordinates:[ring]};
}
