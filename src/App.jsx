import React, { useState, useCallback, useEffect } from 'react'
import Header from './components/Header'
import MapView from './components/MapView'
import AlertSidebar from './components/AlertSidebar'
import AddAlertModal from './components/AddAlertModal'
import AuthModal from './components/AuthModal'
import AdminPanel from './components/AdminPanel'
import useAlertStore from './store/useAlertStore'
import useAuthStore from './store/useAuthStore'
import useGeolocation from './hooks/useGeolocation'

const s = {
  app: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' },
  content: { display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' },
  mapWrapper: { flex: 1, position: 'relative', overflow: 'hidden' },
  fab: {
    position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
    zIndex: 800, display: 'flex', gap: '10px',
  },
  fabBtn: (primary) => ({
    display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 20px', borderRadius: '30px',
    border: primary ? 'none' : '1px solid #2d3148', cursor: 'pointer', whiteSpace: 'nowrap',
    background: primary ? '#6366f1' : '#1e2130ee', backdropFilter: 'blur(8px)',
    color: primary ? 'white' : '#94a3b8', fontSize: '13px', fontWeight: 600,
    boxShadow: '0 4px 20px rgba(0,0,0,0.35)', transition: 'all 0.15s',
  }),
  hint: {
    position: 'absolute', top: '14px', left: '50%', transform: 'translateX(-50%)',
    zIndex: 800, background: '#1e2130cc', backdropFilter: 'blur(8px)',
    border: '1px solid #2d3148', borderRadius: '20px', padding: '7px 14px',
    fontSize: '12px', color: '#94a3b8', pointerEvents: 'none', whiteSpace: 'nowrap',
  },
  toast: (visible) => ({
    position: 'absolute', top: '14px', left: '50%',
    transform: `translateX(-50%) translateY(${visible ? 0 : '-8px'}px)`,
    zIndex: 900, background: '#10b981', borderRadius: '20px', padding: '8px 18px',
    fontSize: '13px', fontWeight: 600, color: 'white', pointerEvents: 'none',
    whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(16,185,129,0.4)',
    opacity: visible ? 1 : 0, transition: 'all 0.3s',
  }),
  locBadge: {
    position: 'absolute', bottom: '80px', left: '16px', zIndex: 800,
    display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
    background: '#1e2130ee', backdropFilter: 'blur(8px)', border: '1px solid #2d3148',
    borderRadius: '20px', fontSize: '11px', color: '#94a3b8',
  },
  locDot: (color) => ({
    width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, background: color,
  }),
  // Manuel konum seç banner (GPS yokken)
  manualBanner: {
    position: 'absolute', top: '52px', left: '50%', transform: 'translateX(-50%)',
    zIndex: 800, background: '#78350fee', backdropFilter: 'blur(8px)',
    border: '1px solid #f59e0b44', borderRadius: '12px', padding: '8px 16px',
    fontSize: '12px', color: '#fcd34d', display: 'flex', alignItems: 'center', gap: '8px',
    maxWidth: '90%', textAlign: 'center',
  },
  setupBanner: {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
  },
  setupCard: {
    background: '#1e2130', border: '1px solid #2d3148', borderRadius: '16px',
    padding: '32px', maxWidth: '420px', textAlign: 'center',
  },
}

export default function App() {
  const { fetchAlerts, subscribeToAlerts, addAlert } = useAlertStore()
  const { user, profile, init: initAuth, loading: authLoading, isAdmin } = useAuthStore()
  const {
    location,
    ipLocation,
    gpsLocation,
    manualLocation,
    setManualLocation,
    gpsStatus,
    gpsAccuracy,
  } = useGeolocation()

  const [clickedPos, setClickedPos]       = useState(null)
  const [modalOpen, setModalOpen]         = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [showAdmin, setShowAdmin]         = useState(false)
  const [pendingPos, setPendingPos]       = useState(null)
  const [flyTarget, setFlyTarget]         = useState(null)
  const [toast, setToast]                 = useState({ msg: '', visible: false })
  const [manualPickMode, setManualPickMode] = useState(false)

  const supabaseConfigured = !!(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    if (!supabaseConfigured) return
    initAuth()
    fetchAlerts()
    const unsub = subscribeToAlerts()
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000)
    return () => { unsub(); clearInterval(interval) }
  }, [supabaseConfigured])

  // GPS doğrulandığında haritaya uç
  const [hasFlownToGps, setHasFlownToGps] = useState(false)
  useEffect(() => {
    if (gpsLocation && !hasFlownToGps) {
      setFlyTarget(gpsLocation)
      setHasFlownToGps(true)
    }
  }, [gpsLocation, hasFlownToGps])

  const showToast = useCallback((msg) => {
    setToast({ msg, visible: true })
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000)
  }, [])

  const handleMapClick = useCallback((pos) => {
    // Manuel konum seçme modu
    if (manualPickMode) {
      setManualLocation({ ...pos, source: 'manual' })
      setManualPickMode(false)
      showToast('📌 Manuel konum ayarlandı')
      return
    }
    if (!user) {
      setPendingPos(pos)
      setAuthModalOpen(true)
    } else {
      setClickedPos(pos)
      setModalOpen(true)
    }
  }, [user, manualPickMode, setManualLocation, showToast])

  // Sağ tık → hızlı manuel konum ayarla
  const handleRightClick = useCallback((pos) => {
    setManualLocation({ ...pos, source: 'manual' })
    showToast('📌 Konum sağ tıkla ayarlandı')
  }, [setManualLocation, showToast])

  const handleAddFromLocation = useCallback(() => {
    const pos = location
    if (!pos) {
      setManualPickMode(true)
      showToast('Haritaya tıklayarak konumunuzu seçin')
      return
    }
    if (!user) {
      setPendingPos(pos)
      setAuthModalOpen(true)
      return
    }
    setClickedPos(pos)
    setModalOpen(true)
  }, [location, user, showToast])

  const handleAuthSuccess = useCallback(() => {
    setAuthModalOpen(false)
    if (pendingPos) {
      setClickedPos(pendingPos)
      setModalOpen(true)
      setPendingPos(null)
    }
  }, [pendingPos])

  const handleAddAlert = useCallback(async (alertData) => {
    const username = profile?.username || user?.email?.split('@')[0] || 'Kullanıcı'
    const { error } = await addAlert(alertData, user.id, username)
    if (error) showToast('❌ ' + (error.message || 'Hata'))
    else showToast('✅ Uyarı yayınlandı!')
  }, [user, profile, addAlert, showToast])

  const handleAlertClick = useCallback((alert) => {
    setFlyTarget({ lat: alert.lat, lng: alert.lng })
  }, [])

  // Konum rozeti içeriği
  const locationBadge = () => {
    if (gpsLocation) return { dot: '#10b981', text: `GPS ±${gpsAccuracy}m` }
    if (manualLocation) return { dot: '#6366f1', text: '📌 Manuel konum' }
    if (gpsStatus === 'unreliable') return { dot: '#f59e0b', text: `GPS güvenilmez (±${gpsAccuracy}m)` }
    if (gpsStatus === 'denied') return { dot: '#ef4444', text: 'GPS izni yok' }
    if (ipLocation) return { dot: '#f59e0b', text: `Şehir: ${ipLocation.city || 'Bilinmiyor'} (IP)` }
    return { dot: '#64748b', text: 'Konum bekleniyor...' }
  }
  const badge = locationBadge()

  // Masaüstü GPS yok uyarısı göster mi?
  const showManualHint = !gpsLocation && !manualLocation && (gpsStatus === 'unreliable' || gpsStatus === 'denied')

  if (!supabaseConfigured) {
    return (
      <div style={s.setupBanner}>
        <div style={s.setupCard}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚙️</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#e2e8f0', marginBottom: '8px' }}>
            Supabase Yapılandırması Gerekli
          </div>
          <pre style={{
            background: '#252836', borderRadius: '8px', padding: '16px',
            fontSize: '12px', color: '#818cf8', textAlign: 'left', marginBottom: '16px',
          }}>
{`VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...`}
          </pre>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            .env dosyasını doldurun ve <br />supabase/schema.sql'i çalıştırın.
          </div>
        </div>
      </div>
    )
  }

  if (authLoading) {
    return (
      <div style={{ ...s.setupBanner, flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontSize: '32px' }}>📡</div>
        <div style={{ fontSize: '14px', color: '#64748b' }}>Yükleniyor...</div>
      </div>
    )
  }

  if (showAdmin && isAdmin()) {
    return <AdminPanel onClose={() => setShowAdmin(false)} />
  }

  return (
    <>
      <div style={s.app}>
        <Header
          onLoginClick={() => setAuthModalOpen(true)}
          onAdminClick={() => setShowAdmin(true)}
        />
        <div style={s.content}>
          <div style={s.mapWrapper}>
            <MapView
              onMapClick={handleMapClick}
              onRightClick={handleRightClick}
              flyTarget={flyTarget}
              gpsLocation={gpsLocation}
              manualLocation={manualLocation}
              setManualLocation={setManualLocation}
              initialCenter={ipLocation}
            />

            {/* Üst bilgi */}
            <div style={s.hint}>
              {manualPickMode
                ? '📌 Konumunuzu seçmek için haritaya tıklayın'
                : user
                ? '🖱️ Sol tık: uyarı ekle  ·  Sağ tık: konumunu ayarla'
                : '👁️ Misafir — uyarı eklemek için giriş yapın'}
            </div>

            {/* Toast */}
            <div style={s.toast(toast.visible)}>{toast.msg}</div>

            {/* GPS unreliable uyarısı */}
            {showManualHint && (
              <div style={s.manualBanner}>
                ⚠️ Cihazınızda GPS yok veya sinyal zayıf — Sağ tıklayarak veya
                <button
                  onClick={() => setManualPickMode(true)}
                  style={{
                    background: 'none', border: 'none', color: '#fbbf24',
                    textDecoration: 'underline', cursor: 'pointer', fontSize: '12px',
                    fontFamily: 'inherit', padding: '0 4px',
                  }}
                >
                  buraya tıklayarak
                </button>
                konumunuzu manuel ayarlayın
              </div>
            )}

            {/* Konum rozeti */}
            <div style={s.locBadge}>
              <div style={s.locDot(badge.dot)} />
              {badge.text}
            </div>

            {/* FABs */}
            <div style={s.fab}>
              {(gpsLocation || manualLocation) && (
                <button
                  style={s.fabBtn(false)}
                  onClick={() => setFlyTarget({ ...(gpsLocation || manualLocation) })}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2d3148')}
                >
                  📍 Konumuma Git
                </button>
              )}
              {!gpsLocation && !manualLocation && (
                <button
                  style={s.fabBtn(false)}
                  onClick={() => setManualPickMode(true)}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2d3148')}
                >
                  📌 Konumumu Seç
                </button>
              )}
              <button
                style={s.fabBtn(true)}
                onClick={handleAddFromLocation}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                ＋ Uyarı Yayınla
              </button>
            </div>
          </div>

          <AlertSidebar onAlertClick={handleAlertClick} />
        </div>
      </div>

      {modalOpen && (
        <AddAlertModal
          position={clickedPos}
          userLocation={location}
          onClose={() => { setModalOpen(false); setClickedPos(null) }}
          onAdd={handleAddAlert}
        />
      )}

      {authModalOpen && (
        <AuthModal
          message={pendingPos ? 'Uyarı eklemek için giriş yapın' : undefined}
          onClose={() => { setAuthModalOpen(false); setPendingPos(null) }}
          onSuccess={handleAuthSuccess}
        />
      )}
    </>
  )
}
