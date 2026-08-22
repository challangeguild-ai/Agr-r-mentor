export const farmMemberRoles=[
  ["manager","Gazdaságvezető"],
  ["agronomist","Agronómus"],
  ["operator","Traktoros / gépkezelő"],
  ["harvester","Kombájnos"]
] as const;
export type FarmMemberRole=typeof farmMemberRoles[number][0];
export function farmMemberRoleLabel(role:string|null|undefined){return farmMemberRoles.find(([key])=>key===role)?.[1]||"Munkatárs"}
export function isFarmMemberRole(role:string):role is FarmMemberRole{return farmMemberRoles.some(([key])=>key===role)}
