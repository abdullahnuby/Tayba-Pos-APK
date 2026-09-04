export * from './queue'
export * from './engine'
export * from './google'
export * from './mapper'

import { getSyncStats } from './queue'
import { syncPending } from './google'
export { getSyncStats }
export { syncPending }
export function startAutoSync(intervalMs = 30000){
  let running = false
  const tick = async () => { if(running || !navigator.onLine) return; running=true; try{await syncPending()}catch{} finally{running=false} }
  void tick(); const timer=window.setInterval(()=>void tick(), intervalMs)
  window.addEventListener('online', tick)
  return ()=>{window.clearInterval(timer);window.removeEventListener('online',tick)}
}
