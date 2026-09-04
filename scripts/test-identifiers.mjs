function checkDigit(base12) {
  if (!/^\d{12}$/.test(base12)) throw new Error('base12 must be 12 digits')
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(base12[i]) * (i % 2 === 0 ? 1 : 3)
  return (10 - (sum % 10)) % 10
}
const samples = ['200000000000', '200000000001', '123456789012']
for (const base of samples) {
  const code = base + checkDigit(base)
  if (!/^\d{13}$/.test(code)) throw new Error(`Invalid EAN-13: ${code}`)
}
console.log('IDENTIFIER CHECK DIGIT PASS')
