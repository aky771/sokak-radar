import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Konum stratejisi:
 *
 * 1) IP Geolocation → anında şehir merkezi, harita oraya açılır (marker YOK)
 *
 * 2) GPS — Safari için önce getCurrentPosition (user gesture ile çalışır),
 *    sonra watchPosition ile takip.
 *    - Doğruluk >= 500m → ISP/IP konumu, marker GÖSTERME
 *    - Doğruluk <  500m → gerçek GPS, marker GÖSTER
 *
 * 3) Manuel konum → kullanıcı haritaya tıklayarak seçer.
 */

const GPS_ACCURACY_THRESHOLD = 500

export default function useGeolocation() {
  const [ipLocation, setIpLocation]         = useState(null)
  const [gpsLocation, setGpsLocation]       = useState(null)
  const [manualLocation, setManualLocation] = useState(null)
  const [gpsStatus, setGpsStatus]           = useState('waiting')
  const [gpsAccuracy, setGpsAccuracy]       = useState(null)
  const bestAccRef                          = useRef(Infinity)
  const watchIdRef                          = useRef(null)

  // ── 1. IP Geolocation ────────────────────────────────────────
  useEffect(() => {
    const ctrl = new AbortController()
    ;(async () => {
      try {
        const res = await fetch('https://ipapi.co/json/', {
          signal: ctrl.signal, headers: { Accept: 'application/json' },
        })
        const d = await res.json()
        if (d.latitude && d.longitude && !d.error) {
          setIpLocation({ lat: +d.latitude, lng: +d.longitude, city: d.city || d.region || '' })
          return
        }
      } catch (_) {}
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

  // ── GPS konum işleyicileri ────────────────────────────────────
  const handlePosition = useCallback((pos) => {
    const { latitude, longitude, accuracy } = pos.coords
    setGpsAccuracy(Math.round(accuracy))
    if (accuracy >= GPS_ACCURACY_THRESHOLD) {
      setGpsStatus('unreliable')
      return
    }
    if (accuracy < bestAccRef.current) {
      bestAccRef.current = accuracy
      setGpsLocation({ lat: latitude, lng: longitude, accuracy: Math.round(accuracy) })
      setGpsStatus('good')
    }
  }, [])

  const handleError = useCallback((err) => {
    if (err.code === 1) setGpsStatus('denied')
    else setGpsStatus('error')
  }, [])

  // ── 2. Otomatik GPS (sayfa yüklenince) ───────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('error')
      return
    }

    // Önce getCurrentPosition — Safari'de ilk izin isteği için güvenilir
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handlePosition(pos)
        // İzin alındı → watchPosition ile takibe geç
        watchIdRef.current = navigator.geolocation.watchPosition(
          handlePosition, handleError,
          { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
        )
      },
      (err) => {
        handleError(err)
        // İzin alınamadı ama yine de watch dene (bazı tarayıcılarda fark yaratır)
        if (err.code !== 1) {
          watchIdRef.current = navigator.geolocation.watchPosition(
            handlePosition, handleError,
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
          )
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [handlePosition, handleError])

  // ── 3. Kullanıcı butonu ile tekrar izin iste ─────────────────
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) return
    setGpsStatus('waiting')
    bestAccRef.current = Infinity
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handlePosition(pos)
        if (watchIdRef.current === null) {
          watchIdRef.current = navigator.geolocation.watchPosition(
            handlePosition, handleError,
            { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
          )
        }
      },
      handleError,
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    )
  }, [handlePosition, handleError])

  const location = manualLocation || gpsLocation || null

  return {
    location,
    ipLocation,
    gpsLocation,
    manualLocation,
    setManualLocation,
    gpsStatus,
    gpsAccuracy,
    requestLocation,  // Safari için butonla tetikleme
  }
}
