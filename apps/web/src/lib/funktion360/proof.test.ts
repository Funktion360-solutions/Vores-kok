import {test} from 'node:test';
import assert from 'node:assert/strict';
import {issueProof,verifyProof} from './proof.ts';
const secret='a'.repeat(64);
test('valid proof preserves internal destination',()=>{const proof=issueProof('/recipes?tab=mine',secret,1000);assert.equal(verifyProof(proof,secret,1001)?.next,'/recipes?tab=mine');});
test('tampering and another deployment key are rejected',()=>{
 const proof=issueProof('/recipes',secret,1000);
 assert.equal(verifyProof('x'+proof,secret,1001),undefined);
 assert.equal(verifyProof(proof,'b'.repeat(64),1001),undefined);
 assert.equal(verifyProof(proof+'.extra',secret,1001),undefined);
});
test('expired, future and oversized proofs are rejected',()=>{
 const proof=issueProof('/recipes',secret,1000);
 assert.equal(verifyProof(proof,secret,301001),undefined);
 assert.equal(verifyProof(proof,secret,999),undefined);
 assert.equal(verifyProof('a'.repeat(9000),secret),undefined);
});
test('unsafe return paths and weak keys are not accepted',()=>{
 assert.equal(verifyProof(issueProof('//evil.example',secret,1000),secret,1001)?.next,'/recipes');
 assert.throws(()=>issueProof('/recipes','weak'));
});
