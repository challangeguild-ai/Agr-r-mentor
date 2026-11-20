/**
 * The UI normally requires a permit-backed product when the country's official
 * catalogue has any active products. A forged server-action FormData must not
 * circumvent those controls by omitting product_id.
 */
export function validateSprayingProductSelection(
 hasOfficialProducts:boolean,
 productId:string,
 manualProductName:string
):string|null{
 if(hasOfficialProducts&&!productId)
  return "A hivatalos növényvédőszer-katalógus elérhető. Válassz engedélyezett készítményt és felhasználást.";
 if(!productId&&!manualProductName.trim())
  return "A növényvédelmi művelethez add meg a készítményt.";
 return null;
}
