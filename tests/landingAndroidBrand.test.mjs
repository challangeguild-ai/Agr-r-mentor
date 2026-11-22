import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

test("public homepage uses local generated imagery and preserves the real login",()=>{
 const page=read("app/page.tsx");
 const css=read("app/landing.module.css");
 assert.match(page,/<LandingLoginModal triggerLabel="Belépés"/);
 assert.match(page,/mobileSection/);
 assert.match(page,/Tesztverzió előkészítés alatt/);
 assert.match(page,/APK még nem tölthető le nyilvánosan/);
 assert.match(page,/gazdálkodói, szaktanácsadói vagy adminisztrátori/);
 assert.doesNotMatch(page,/<svg\b/i,"Decorative SVG artwork should have been replaced with the generated wheat illustration");
 assert.doesNotMatch(page,/href="[^"]*\.apk"/i,"Do not advertise an unreleased APK download");
 for(const image of ["agrar-hero-generated.webp","agrar-advisory-generated.webp","agrar-wheat-ornament.webp"]){
  const path=new URL(`../public/images/${image}`,import.meta.url);
  assert.equal(readFileSync(path).toString("ascii",0,4),"RIFF",`${image} is not WebP`);
  assert.ok(statSync(path).size<400_000,`${image} is too large for mobile visitors`);
  assert.ok((css+page).includes(`/images/${image}`),`${image} is not referenced by the website`);
 }
 assert.match(page,/Szemléltető alkalmazás-látványterv/);
});
