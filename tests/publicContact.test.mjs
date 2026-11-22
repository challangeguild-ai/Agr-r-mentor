import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {publicContactHref} from "../lib/publicContact.ts";

test("a configured Agrár Mentor contact address opens a prefilled email",()=>{
 const href=publicContactHref(" agrar@example.org ");
 assert.ok(href?.startsWith("mailto:agrar@example.org?"));
 const url=new URL(href);
 assert.match(url.searchParams.get("subject")??"",/Agrár Mentor/);
 assert.match(url.searchParams.get("body")??"",/Telefonszám/);
});

test("missing or malformed contact configuration does not create a fake CTA",()=>{
 for(const address of [undefined,"", "not-an-email", "x@example.org?cc=someone@other.org"]){
  assert.equal(publicContactHref(address),null);
 }
 const source=readFileSync(resolve(import.meta.dirname,"../app/page.tsx"),"utf8");
 assert.doesNotMatch(source,/href="#kapcsolat">Kapcsolatfelvétel/);
 assert.match(source,/contactHref\?<a/);
});
