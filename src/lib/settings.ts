import { getDb, query, run, withTransaction } from './db/client'
export async function getSetting(key:string){const db=await getDb();return query<{value:string}>(db,'SELECT value FROM settings WHERE key=?',[key])[0]?.value??null}
export async function setSetting(key:string,value:string){await withTransaction(db=>run(db,`INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,[key,value]))}
