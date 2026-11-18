import test from "node:test";
import assert from "node:assert/strict";
import {getInviteRedirectUrl} from "../lib/inviteRedirect.ts";

const previous=process.env.APP_PUBLIC_ORIGIN;
test.after(()=>{if(previous===undefined)delete process.env.APP_PUBLIC_ORIGIN;else process.env.APP_PUBLIC_ORIGIN=previous});

test("invites use the configured HTTPS application origin",()=>{
 process.env.APP_PUBLIC_ORIGIN="https://agrar.example.hu";
 assert.equal(getInviteRedirectUrl(),"https://agrar.example.hu/invite");
});

test("missing domain must not silently redirect to an old application",()=>{
 delete process.env.APP_PUBLIC_ORIGIN;
 assert.throws(()=>getInviteRedirectUrl(),/APP_PUBLIC_ORIGIN/);
});

test("reject insecure, pathful or userinfo origins",()=>{
 for(const origin of ["http://agrar.example.hu","https://agrar.example.hu/old","https://user:pw@agrar.example.hu","https://agrar.example.hu/?next=evil"]){
  process.env.APP_PUBLIC_ORIGIN=origin;
  assert.throws(()=>getInviteRedirectUrl(),/APP_PUBLIC_ORIGIN/);
 }
});
