export function toCents(value:number|string|null|undefined): number {
  const n=Number(value)
  if(!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 100)
}

export function fromCents(cents:number): number {
  return Math.round(Number(cents)||0) / 100
}
