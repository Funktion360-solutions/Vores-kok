import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyLinkingMfa} from './link-mfa.ts';
const factors=[{id:'owned',status:'verified',factor_type:'totp'}];
function api(error:unknown=null,level='aal2'){let calls=0;return {get calls(){return calls;},challengeAndVerify:async()=>{calls++;return {error};},getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:level},error:null})};}
test('MFA requires a verified owned TOTP factor and six digits',async()=>{const a=api();for(const [id,code] of [['other','123456'],['owned','12345'],['owned','abcdef']] as Array<[string,string]>)assert.equal(await verifyLinkingMfa(a,factors,id,code),false);assert.equal(a.calls,0);});
test('provider rejection or aal1 cannot authorize linking',async()=>{assert.equal(await verifyLinkingMfa(api('rejected'),factors,'owned','123456'),false);assert.equal(await verifyLinkingMfa(api(null,'aal1'),factors,'owned','123456'),false);});
test('successful fresh verification and aal2 authorize linking',async()=>{const a=api();assert.equal(await verifyLinkingMfa(a,factors,'owned','123456'),true);assert.equal(a.calls,1);});
test('unverified and unsupported factors cannot substitute for TOTP',async()=>{assert.equal(await verifyLinkingMfa(api(),[{id:'owned',status:'verified',factor_type:'phone'}],'owned','123456'),false);assert.equal(await verifyLinkingMfa(api(),undefined,'',''),true);});
