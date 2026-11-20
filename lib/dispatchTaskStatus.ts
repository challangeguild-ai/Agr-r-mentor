/** Display a truthful status on the farm-dispatch list.
 * "submitted" is awaiting review, never a completed operation.
 */
export function dispatchTaskStatusLabel(
 status:string|null|undefined,
 reviewStatus:string|null|undefined
):string{
 if(reviewStatus==="rejected")return "Javításra visszaküldve";
 if(status==="done")return "Elvégezve";
 if(status==="submitted"||reviewStatus==="pending")return "Ellenőrzésre vár";
 if(status==="in_progress")return "Folyamatban";
 if(status==="open")return "Kiosztva";
 return "Állapot ellenőrizendő";
}
