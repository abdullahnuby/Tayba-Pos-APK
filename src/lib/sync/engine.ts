import { getSetting } from '../settings'
import { getSyncStats } from './queue'
import { syncPending } from './google'

let running = false
export async function runSyncNow(){
  if(running || !navigator.onLine) return {sent:0,synced:0,failed:0,message:'غير متاح حاليًا'}
  if(!(await getSetting('appsScriptUrl')) || !(await getSetting('appsScriptToken'))) return {sent:0,synced:0,failed:0,message:'المزامنة غير مهيأة'}
  running=true
  try{return await syncPending(25)}finally{running=false}
}
export async function getSyncStatus(){const stats=await getSyncStats();return {pending:(stats.pending||0)+(stats.failed||0),processing:stats.processing||0,synced:stats.synced||0}}
export function startAutoSync(){
  const tick=()=>{void runSyncNow()}
  window.addEventListener('online',tick)
  const timer=window.setInterval(tick,30000)
  void tick()
  return ()=>{window.removeEventListener('online',tick);window.clearInterval(timer)}
}
