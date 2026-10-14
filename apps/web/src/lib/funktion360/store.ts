import { DatabaseSync } from 'node:sqlite';
import { createHash,randomBytes } from 'node:crypto';
import {mkdirSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
function hash(value:string){return createHash('sha256').update(value).digest('hex');}
export class PilotStore {
  private db: DatabaseSync;
  constructor(folder:string) {
    mkdirSync(folder,{recursive:true,mode:0o700});
    this.db=new DatabaseSync(join(folder,'pilot.sqlite'));
    chmodSync(join(folder,'pilot.sqlite'),0o600);
    this.db.exec('CREATE TABLE IF NOT EXISTS items (key TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL, expires INTEGER NOT NULL)');
    this.db.prepare('DELETE FROM items WHERE expires < ?').run(Date.now());
  }
  put(kind:string,value:unknown,ttl:number) {
    const key=randomBytes(32).toString('base64url');
    this.db.prepare('INSERT INTO items VALUES (?,?,?,?)').run(hash(key),kind,JSON.stringify(value),Date.now()+ttl);
    return key;
  }
  take<T>(key:string,kind:string):T|undefined {
    const row=this.db.prepare('DELETE FROM items WHERE key=? AND kind=? RETURNING payload,expires').get(hash(key),kind);
    return row && Number(row.expires)>Date.now() ? JSON.parse(String(row.payload)) as T:undefined;
  }
  get<T>(key:string,kind:string):T|undefined {
    const row=this.db.prepare('SELECT payload,expires FROM items WHERE key=? AND kind=?').get(hash(key),kind);
    return row && Number(row.expires)>Date.now() ? JSON.parse(String(row.payload)) as T:undefined;
  }
  close(){this.db.close();}
}
