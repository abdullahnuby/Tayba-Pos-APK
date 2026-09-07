const badValues = [undefined, null, '', 'not-a-date']
function safeDate(value){
  if(value==null||value==='') return null
  const d=value instanceof Date?value:new Date(value)
  return Number.isNaN(d.getTime())?null:d
}
for(const value of badValues){
  const d=safeDate(value)
  if(d!==null) throw new Error(`expected null for ${String(value)}`)
}
console.log('date-resilience: PASS')
