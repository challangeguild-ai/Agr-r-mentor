/** Never let manually typed pesticide names bypass the licensed-use selection. */
export function requireOfficialPlantProtectionUse(productId:string,useId:string):string|null{
 if(!productId.trim()||!useId.trim())
  return "Növényvédelmi művelet csak hivatalos készítmény és engedélyezett felhasználás kiválasztásával rögzíthető.";
 return null;
}
