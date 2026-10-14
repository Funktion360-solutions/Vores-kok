import {test} from 'node:test';
import assert from 'node:assert/strict';
import {returnPath,pilotUser} from './signin-checks.ts';
test('blocks external and malformed post-login destinations',()=>{
 for(const v of ['https://evil.example','//evil.example','/\\evil.example','/\n/evil.example',undefined]) assert.equal(returnPath(v),'/recipes');
 assert.equal(returnPath('/recipes?tab=mine'),'/recipes?tab=mine');
});
test('pilot requires an explicit local UUID',()=>{
 assert.equal(pilotUser('b1308088-bcbb-4d07-9bfb-4e95a33ad822'),'b1308088-bcbb-4d07-9bfb-4e95a33ad822');
 assert.equal(pilotUser(undefined),undefined);assert.equal(pilotUser('email@example.com'),undefined);
});
