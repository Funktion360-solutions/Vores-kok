import {test} from 'node:test';
import assert from 'node:assert/strict';
import {providerFeedback,providerMessage,linkingFailure} from './link-feedback.ts';
test('recognizes identity conflict without reflecting provider descriptions',()=>{const code=providerFeedback('#error_code=identity_already_exists&error_description=SECRET');assert.equal(code,'identity_already_exists');assert.ok(!providerMessage(code)?.includes('SECRET'));});
test('unknown and prototype property codes never become user messages',()=>{for(const code of ['unknown','toString','__proto__']){assert.equal(providerFeedback('#error_code='+code),undefined);assert.equal(providerMessage(code),undefined);}});
test('session and expired proofs get distinct recovery instructions',()=>{assert.match(linkingFailure('original_account_changed'),/session/);assert.match(linkingFailure('proof_invalid_or_expired'),/udløbet/);});
