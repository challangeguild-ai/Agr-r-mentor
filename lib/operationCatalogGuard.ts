/**
 * A spraying record always needs a permit-backed product and its verified use.
 * A missing/empty official catalogue is not permission to enter an arbitrary
 * manual pesticide. This also guards forged server-action FormData.
 */
export function validateSprayingProductSelection(
 hasOfficialProducts:boolean,
 productId:string,
 manualProductName:string
):string|null{
 if(!productId)return hasOfficialProducts
  ? "Válassz hivatalos növényvédő szert és engedélyezett felhasználást. Kézi készítménynévvel nem helyettesíthető az engedélyokirat."
  : "A hivatalos növényvédőszer-katalógus nem áll rendelkezésre. Engedélyezett felhasználás nélkül a művelet nem rögzíthető.";
 return null;
}
