let cachedRate: number | null = null
let cacheTime = 0

export async function getUsdBrlRate(): Promise<number> {
  if (cachedRate && Date.now() - cacheTime < 3600_000) return cachedRate
  try {
    const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL')
    const data = await res.json()
    const rate = parseFloat(data.USDBRL.bid)
    cachedRate = rate
    cacheTime = Date.now()
    return rate
  } catch {
    return cachedRate ?? 5.0
  }
}
