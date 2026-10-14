import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PROVIDER,verifiedLink,linkEnabled} from './link-checks.ts';
test('same local user and correct provider are required',()=>{
 assert.equal(verifiedLink('alice','alice',[{provider:PROVIDER}]),true);
 assert.equal(verifiedLink('bob','alice',[{provider:PROVIDER}]),false);
 assert.equal(verifiedLink('alice','alice',[{provider:'email'}]),false);
 assert.equal(verifiedLink('alice','alice',undefined),false);
});
test('production and disabled linking stay closed',()=>{
 assert.equal(linkEnabled('development','true'),true);
 assert.equal(linkEnabled('production','true'),false);
 assert.equal(linkEnabled('development',undefined),false);
});
