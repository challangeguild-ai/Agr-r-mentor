export type DailyWorkRole="farmer"|"advisor"|"system-admin";
export type DailyWorkAction="view"|"assign"|"execute"|"verify"|"approve_plant_protection"|"manage_system";

const matrix:Record<DailyWorkRole,DailyWorkAction[]>={
 farmer:["view","assign","execute","approve_plant_protection"],
 advisor:["view","assign","verify"],
 "system-admin":["manage_system"]
};

export function canDailyWork(role:DailyWorkRole,action:DailyWorkAction){return matrix[role].includes(action);}
export function assertDailyWork(role:DailyWorkRole,action:DailyWorkAction){if(!canDailyWork(role,action))throw new Error(`A(z) ${role} szerepkör nem jogosult erre a műveletre: ${action}`);}
