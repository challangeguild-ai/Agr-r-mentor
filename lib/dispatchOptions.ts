export type DispatchFarm={id:string;owner_id:string};
export type DispatchScopedItem={farm_id:string};
export type DispatchMember=DispatchScopedItem&{user_id:string};

/** Keep every assignment input within the explicitly selected farm. */
export function selectDispatchOptions<
 F extends DispatchFarm,
 T extends DispatchScopedItem,
 M extends DispatchMember,
 E extends DispatchScopedItem
>(selectedId:string,farms:readonly F[],fields:readonly T[],members:readonly M[],machines:readonly E[]){
 const farm=farms.find(f=>f.id===selectedId)||null;
 if(!farm)return {farm:null,fields:[] as T[],members:[] as M[],machines:[] as E[],assigneeIds:[] as string[]};
 const farmMembers=members.filter(m=>m.farm_id===farm.id);
 return{
  farm,
  fields:fields.filter(f=>f.farm_id===farm.id),
  members:farmMembers,
  machines:machines.filter(m=>m.farm_id===farm.id),
  assigneeIds:[farm.owner_id,...new Set(farmMembers.filter(m=>m.user_id!==farm.owner_id).map(m=>m.user_id))]
 };
}
