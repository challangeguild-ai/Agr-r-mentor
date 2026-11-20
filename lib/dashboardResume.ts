export type ResumeTask={
 id:string;title:string;status:string|null;review_status:string|null;
};
export type ResumeReply={id:string;title:string};
export type ResumeCard={
 id:string;title:string;meta:string;stage:string;action:string;href:string;
};
/** One task gets one card, with "needs correction" ahead of ordinary work. */
export function selectResumeCards(tasks:readonly ResumeTask[],replies:readonly ResumeReply[],limit=3):ResumeCard[]{
 const cards:ResumeCard[]=[];
 const seen=new Set<string>();
 const add=(task:ResumeTask,prefix:string,meta:string,stage:string,action:string)=>{
  if(seen.has(task.id))return;
  seen.add(task.id);
  cards.push({id:prefix+task.id,title:task.title,meta,stage,action,href:"/tasks"});
 };
 for(const t of tasks)if(t.review_status==="rejected")
  add(t,"r-","Javításra visszaküldött végrehajtás","Javítás szükséges","Javítás megnyitása");
 for(const t of tasks)if(t.status==="submitted"||t.review_status==="pending")
  add(t,"w-","Ellenőrzésre beküldve","Ellenőrzésre vár","Státusz megnyitása");
 for(const t of tasks)if(t.status==="in_progress")
  add(t,"p-","Folyamatban lévő munka","Végrehajtás folyamatban","Megnyitás");
 for(const reply of replies){
  cards.push({id:"m-"+reply.id,title:reply.title,meta:"Új szaktanácsadói válasz",stage:"Új válasz érkezett",action:"Válasz megnyitása",href:"/messages"});
 }
 return cards.slice(0,Math.max(0,limit));
}
