// Nominatim reverse geocoding (OpenStreetMap)
// Rate limit: 1 req/sec — önbellekleme ile minimize ediyoruz

const cache = new Map()

export async function reverseGeocode(lat, lng) {
  // 3 ondalık basamak ~110m hassasiyet, gereksiz tekrar çağrıları azaltır
  const key = `${parseFloat(lat).toFixed(3)},${parseFloat(lng).toFixed(3)}`
  if (cache.has(key)) return cache.get(key)

  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?lat=${lat}&lon=${lng}&format=json&accept-language=tr&zoom=17`

    const res = await fetch(url, {
      headers: { 'Accept-Language': 'tr-TR,tr;q=0.9' },
    })
    if (!res.ok) return null

    const data = await res.json()
    const a = data.address || {}

    // Öncelik sırasıyla: cadde/sokak → mahalle/semt → ilçe
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
