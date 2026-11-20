import test from "node:test";
import assert from "node:assert/strict";
import {matchesFieldCatalogQuery} from "../lib/fieldCatalogSearch.ts";

const field={name:"Nagyrét 03",current_crop:"Őszi káposztarepce",farmName:"Agrár Mentor Demógazdaság"};

test("field catalog search matches field, crop and farm without requiring accents",()=>{
 assert.equal(matchesFieldCatalogQuery(field,"nagyret"),true);
 assert.equal(matchesFieldCatalogQuery(field,"OSZI repce"),true);
 assert.equal(matchesFieldCatalogQuery(field,"DEMOGAZDASAG"),true);
});

test("multiple search words must all match the same field",()=>{
 assert.equal(matchesFieldCatalogQuery(field,"NAGYRET repce"),true);
 assert.equal(matchesFieldCatalogQuery(field,"NAGYRET kukorica"),false);
 assert.equal(matchesFieldCatalogQuery(field,"  "),true);
});
