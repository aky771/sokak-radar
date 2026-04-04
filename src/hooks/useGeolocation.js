import { useState, useEffect, useRef } from 'react'

/**
 * Konum stratejisi:
 *
 * 1) IP Geolocation → anında şehir merkezi, harita oraya açılır (marker YOK)
 *
 * 2) GPS watchPosition → gerçek konum
 *    - Doğruluk >= 500m ise IP/ISP konumu demektir, marker GÖSTERME
 *    - Doğruluk <  500m ise gerçek GPS, marker GÖSTER
 *    - Masaüstü/laptop'ta GPS chip olmadığı için çoğunlukla unreliable gelir
 *
 * 3) Manuel konum → kullanıcı haritaya sağ tıklayarak veya butonla seçer
 *    Bu her zaman en güvenilir kaynaktır.
 */

const GPS_ACCURACY_THRESHOLD = 500 // metreden büyükse güvenilmez

export default function useGeolocation() {
  const [ipLocation, setIpLocation]       = useState(null)
  const [gpsLocation, setGpsLocation]     = useState(null) // yalnızca güvenilir GPS
  const [manualLocation, setManualLocation] = useState(null)
  const [gpsStatus, setGpsStatus]         = useState('waiting') // waiting | good | unreliable | denied | error
  const [gpsAccuracy, setGpsAccuracy]     = useState(null)
  const bestAccRef                        = useRef(Infinity)

  // ── 1. IP Geolocation (harita merkezi için, marker yok) ──────
  useEffect(() => {
    const ctrl = new AbortController()
    ;(async () => {
      try {
        const res = await fetch('https://ipapi.co/json/', {
          signal: ctrl.signal,
          headers: { Accept: 'application/json' },
        })
        const d = await res.json()
        if (d.latitude && d.longitude && !d.error) {
          setIpLocation({ lat: +d.latitude, lng: +d.longitude, city: d.city || d.region || '' })
          return
        }
      } catch (_) {}
      // Fallback: ipwho.is
      try {
        const res2 = await fetch('https://ipwho.is/', { signal: ctrl.signal })
        const d2 = await res2.json()
        if (d2.success && d2.latitude) {
          setIpLocation({ lat: +d2.latitude, lng: +d2.longitude, city: d2.city || '' })
        }
      } catch (_) {}
    })()
    return () => ctrl.abort()
  }, [])

  // ── 2. GPS watchPosition ──────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('error')
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        setGpsAccuracy(Math.round(accuracy))

        if (accuracy >= GPS_ACCURACY_THRESHOLD) {
          // ISP / IP tabanlı düşük doğruluk — harita için kullanılmaz
          setGpsStatus('unreliable')
          return
        }

        // Gerçek GPS sinyali — sadece öncekinden iyiyse güncelle
        if (accuracy < bestAccRef.current) {
          bestAccRef.current = accuracy
          setGpsLocation({ lat: latitude, lng: longitude, accuracy: Math.round(accuracy) })
          setGpsStatus('good')
        }
      },
      (err) => {
        if (err.code === 1) setGpsStatus('denied')
        else setGpsStatus('error')
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,      // asla önbellek kullanma
        timeout: 15000,
      }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // En iyi konum: manuel > GPS > (IP sadece harita için)
  const location = manualLocation || gpsLocation || null

  return {
    location,           // uyarı eklemek için kullanılacak konum
    ipLocation,         // haritanın ilk açılış merkezi
    gpsLocation,        // sadece doğrulanmış GPS (<500m)
    manualLocation,
    setManualLocation,  // kullanıcı haritadan seçer
    gpsStatus,          // 'waiting' | 'good' | 'unreliable' | 'denied' | 'error'
    gpsAccuracy,
  }
}
