/** Supabase Data API limits page sizes: financial totals must account for every record. */
export async function fetchAllPages<Row>(
 loadPage:(from:number,to:number)=>PromiseLike<{data:Row[]|null;error:{message:string}|null}>,
 subject:string,pageSize=500
):Promise<Row[]>{
 if(!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>1000)throw new Error("Érvénytelen lapméret.");
 const result:Row[]=[];
 for(let from=0;;from+=pageSize){
  const{data,error}=await loadPage(from,from+pageSize-1);
  if(error)throw new Error(`${subject}: ${error.message}`);
  if(!data)throw new Error(`${subject}: nincs ellenőrizhető válasz.`);
  result.push(...data);
  if(data.length<pageSize)return result;
 }
}
export function chunkIds<T>(ids:readonly T[],size=80):T[][]{
 if(!Number.isSafeInteger(size)||size<1)throw new Error("Érvénytelen csoportméret.");
 const groups:T[][]=[];
 for(let index=0;index<ids.length;index+=size)groups.push(ids.slice(index,index+size));
 return groups;
}
