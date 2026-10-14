import {test} from 'node:test';
import assert from 'node:assert/strict';
import {issueLinkProof,verifyLinkProof} from './link-proof.ts';
import {issueProof,verifyProof} from './proof.ts';
const secret='a'.repeat(64),id='b1308088-bcbb-4d07-9bfb-4e95a33ad822';
test('linking proof binds the original local account',()=>assert.equal(verifyLinkProof(issueLinkProof(id,secret,1000),secret,1001)?.localId,id));
test('linking and login proofs cannot be substituted',()=>{
 assert.equal(verifyLinkProof(issueProof('/link/'+id,secret,1000),secret,1001),undefined);
 assert.equal(verifyProof(issueLinkProof(id,secret,1000),secret,1001),undefined);
});
test('linking rejects tampering, expiry, different keys and invalid IDs',()=>{
 const proof=issueLinkProof(id,secret,1000);
 assert.equal(verifyLinkProof('x'+proof,secret,1001),undefined);
 assert.equal(verifyLinkProof(proof,secret,301001),undefined);
 assert.equal(verifyLinkProof(proof,'b'.repeat(64),1001),undefined);
 assert.throws(()=>issueLinkProof('invalid',secret));
});
