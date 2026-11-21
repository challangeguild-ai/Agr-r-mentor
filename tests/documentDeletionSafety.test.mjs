import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const actions=readFileSync(new URL("../app/documents/actions.ts",import.meta.url),"utf8");
const deleteSection=actions.slice(actions.indexOf("export async function deleteDocument("));
const page=readFileSync(new URL("../app/documents/page.tsx",import.meta.url),"utf8");
const library=readFileSync(new URL("../components/DocumentLibrary.tsx",import.meta.url),"utf8");

test("document deletion never treats a hidden or unchanged row as deleted",()=>{
 assert.match(deleteSection,/\.eq\("uploaded_by",doc\.uploaded_by\)\.eq\("storage_path",doc\.storage_path\)\.select\("id"\)\.maybeSingle\(\)/);
 assert.match(deleteSection,/if\(error\|\|!deleted\)throw/);
 const verified=deleteSection.indexOf("if(error||!deleted)");
 const storage=deleteSection.indexOf('storage.from("documents").remove');
 assert.ok(verified>=0&&storage>verified,"Storage cleanup must start only after a confirmed database delete");
});

test("document deletion excludes system admins and enforces original uploader for farmers",()=>{
 assert.match(deleteSection,/profile\?\.system_role!=="admin"/);
 assert.match(deleteSection,/doc\.uploaded_by!==user\.id/);
 assert.match(deleteSection,/\.eq\("owner_id",user\.id\)/);
 assert.match(deleteSection,/doc\.storage_path\.split\("\/"\)\.some/);
});

test("document list only offers deletion of own uploads and surfaces partial cleanup",()=>{
 assert.match(page,/uploaded_by,farms\(name\)/);
 assert.match(page,/currentUserId=\{user\.id\}/);
 assert.match(library,/d\.uploaded_by===currentUserId/);
 assert.match(library,/if\(result\.warning\)alert\(result\.warning\)/);
 assert.match(deleteSection,/warning="A dokumentum törölve, de a tárolt fájl/);
});
