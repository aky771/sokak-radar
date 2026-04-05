// Nominatim reverse geocoding (OpenStreetMap)
// Kullanım koşulları: max 1 req/sec, User-Agent zorunlu
// Önbellekleme ile istek sayısı minimize edilir

const cache = new Map()
let   lastReqTime = 0
const MIN_INTERVAL_MS = 1100   // Nominatim: en az 1 saniye arayla

export async function reverseGeocode(lat, lng) {
  // Koordinat doğrulama
  if (!isFinite(lat) || !isFinite(lng)) return null

  // 3 ondalık basamak ~110m hassasiyet → tekrar çağrıları azaltır
  const key = `${parseFloat(lat).toFixed(3)},${parseFloat(lng).toFixed(3)}`
  if (cache.has(key)) return cache.get(key)

  // Rate limiting: önceki istekten bu yana yeterli süre geçmediyse bekle
  const now = Date.now()
  const wait = lastReqTime + MIN_INTERVAL_MS - now
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastReqTime = Date.now()

  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}` +
      `&format=json&accept-language=tr&zoom=17`

    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'tr-TR,tr;q=0.9',
        // Nominatim kullanım koşulları: uygulamanın adını belirt
        'User-Agent': 'SokakRadar/1.0 (community-alert-app)',
      },
    })

    if (!res.ok) {
      // 429 rate-limit veya başka hata — null dön, tekrar isteme
      return null
    }

    const data = await res.json()
    const a = data.address || {}

    const road   = a.road || a.pedestrian || a.footway || a.cycleway || a.path
    const suburb = a.suburb || a.neighbourhood || a.quarter || a.village
    const dist   = a.city_district || a.district || a.county

    const parts = [road, suburb || dist].filter(Boolean)
    const result = parts.length
      ? parts.join(', ')
      : data.display_name?.split(',').slice(0, 2).join(',').trim() || null

    cache.set(key, result)
    return result
  } catch {
    return null
  }
}
