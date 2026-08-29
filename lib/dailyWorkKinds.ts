import type {DailyWorkKind} from "@/lib/dailyWorkPriority";
export function dailyWorkKindLabel(kind:DailyWorkKind){return kind==="task"?"Feladat":kind==="inspection"?"Szemle":kind==="report"?"Gazdálkodói jelzés":kind==="visit"?"Látogatás":"Jóváhagyás";}
