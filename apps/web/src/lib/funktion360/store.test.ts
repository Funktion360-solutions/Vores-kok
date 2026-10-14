import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PilotStore} from './store.ts';
test('transaction consumed once and persists across connections',()=>{
 const folder=mkdtempSync(join(tmpdir(),'id-pilot-'));
 try{let db=new PilotStore(folder);const key=db.put('transaction',{state:'test'},60000);db.close();db=new PilotStore(folder);
 assert.equal(db.take(key+'wrong','transaction'),undefined);
 assert.equal(db.take(key,'identity'),undefined);
 assert.deepEqual(db.take(key,'transaction'),{state:'test'});
 assert.equal(db.take(key,'transaction'),undefined);db.close();}finally{rmSync(folder,{recursive:true,force:true});}
});
test('expired items and proof sessions cannot be used as transactions',()=>{
 const folder=mkdtempSync(join(tmpdir(),'id-pilot-'));const db=new PilotStore(folder);
 try{const expired=db.put('transaction',{},-1000);assert.equal(db.take(expired,'transaction'),undefined);
 const proof=db.put('identity',{subject:'alice'},60000);assert.equal(db.take(proof,'transaction'),undefined);assert.deepEqual(db.get(proof,'identity'),{subject:'alice'});}
 finally{db.close();rmSync(folder,{recursive:true,force:true});}
});
