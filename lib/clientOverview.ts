type LatestInspection={issue_status?:string|null;next_check_at?:string|null};

/** Count affected fields, not historical inspection rows for the same field. */
export function countDueFieldChecks(fieldIds:readonly string[],latest:ReadonlyMap<string,LatestInspection>,today:string){
 return [...new Set(fieldIds)].filter(id=>{
  const inspection=latest.get(id);
  return !!inspection&&inspection.issue_status!=="resolved"&&!!inspection.next_check_at&&inspection.next_check_at<=today;
 }).length;
}
