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
import useIsMobile from './hooks/useIsMobile'

// Safari için webkit prefix'li backdrop
const blurBg = (bg) => ({
  background: bg,
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
})

const s = {
  // height → index.css .app-root sınıfından geliyor (100dvh Safari fix)
  app: { display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  content: { display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' },
  mapWrapper: { flex: 1, position: 'relative', overflow: 'hidden' },
  fabBtn: (primary) => ({
    display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 20px', borderRadius: '30px',
    border: primary ? 'none' : '1px solid #2d3148', cursor: 'pointer', whiteSpace: 'nowrap',
    ...blurBg(primary ? '#6366f1' : '#1e2130ee'),
    color: primary ? 'white' : '#94a3b8', fontSize: '13px', fontWeight: 600,
    boxShadow: '0 4px 20px rgba(0,0,0,0.35)', transition: 'all 0.15s',
    touchAction: 'manipulation',
  }),
  setupBanner: {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
  },
  setupCard: {
    background: '#1e2130', border: '1px solid #2d3148', borderRadius: '16px',
    padding: '32px', maxWidth: '420px', width: '90%', textAlign: 'center',
  },
}

export default function App() {
  const { fetchAlerts, subscribeToAlerts, addAlert } = useAlertStore()
  const { user, profile, init: initAuth, loading: authLoading, isAdmin } = useAuthStore()
  const {
    location, ipLocation, gpsLocation, manualLocation,
    setManualLocation, gpsStatus, gpsAccuracy, permissionState, requestLocation,
  } = useGeolocation()

  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768)

  const [clickedPos, setClickedPos]         = useState(null)
  const [modalOpen, setModalOpen]           = useState(false)
  const [authModalOpen, setAuthModalOpen]   = useState(false)
  const [showAdmin, setShowAdmin]           = useState(false)
  const [pendingPos, setPendingPos]         = useState(null)
  const [flyTarget, setFlyTarget]           = useState(null)
  const [toast, setToast]                   = useState({ msg: '', visible: false })
  const [manualPickMode, setManualPickMode] = useState(false)
  const [showLocHelp, setShowLocHelp]       = useState(false)

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

  const [hasFlownToGps, setHasFlownToGps] = useState(false)
  useEffect(() => {
    if (gpsLocation && !hasFlownToGps) {
      setFlyTarget(gpsLocation)
      setHasFlownToGps(true)
    }
  }, [gpsLocation, hasFlownToGps])

  useEffect(() => {
    if (!isMobile) setSidebarOpen(true)
  }, [isMobile])

  const showToast = useCallback((msg) => {
    setToast({ msg, visible: true })
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000)
  }, [])

  const handleMapClick = useCallback((pos) => {
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
    if (isMobile) setSidebarOpen(false)
  }, [isMobile])

  const locationBadge = () => {
    if (gpsLocation) return { dot: '#10b981', text: `GPS ±${gpsAccuracy}m` }
    if (manualLocation) return { dot: '#6366f1', text: '📌 Manuel' }
    if (gpsStatus === 'unreliable') return { dot: '#f59e0b', text: `GPS zayıf ±${gpsAccuracy}m` }
    if (gpsStatus === 'denied') return { dot: '#ef4444', text: 'GPS izni yok' }
    if (gpsStatus === 'error') return { dot: '#ef4444', text: 'GPS hatası' }
    if (ipLocation) return { dot: '#f59e0b', text: `${ipLocation.city || 'IP konum'}` }
    return { dot: '#64748b', text: 'Konum bekleniyor...' }
  }
  const badge = locationBadge()

  // Gerçek kalıcı red: Permissions API 'denied' dediyse VEYA GPS kodu 1 aldıysa
  const trulyDenied = permissionState === 'denied' || gpsStatus === 'denied'
  const showManualHint = !gpsLocation && !manualLocation &&
    (trulyDenied || gpsStatus === 'unreliable' || gpsStatus === 'error' || gpsStatus === 'waiting')

  const fabBottom   = isMobile ? '72px' : '24px'
  const badgeBottom = isMobile ? '126px' : '80px'  // FAB'ların üstünde kalsın

  const btnStyle = {
    background: '#f59e0b22', border: '1px solid #f59e0b66', color: '#fbbf24',
    borderRadius: '8px', padding: '4px 12px', fontSize: '12px',
    cursor: 'pointer', fontFamily: 'inherit', touchAction: 'manipulation',
  }

  const hintText = manualPickMode
    ? '📌 Konumunuzu seçmek için haritaya tıklayın'
    : user
      ? isMobile ? '👆 Dokunun: uyarı ekle' : '🖱️ Sol tık: uyarı ekle  ·  Sağ tık: konumunu ayarla'
      : '👁️ Misafir — uyarı eklemek için giriş yapın'

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
            overflowX: 'auto',
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
      <div style={s.app} className="app-root">
        <Header
          onLoginClick={() => setAuthModalOpen(true)}
          onAdminClick={() => setShowAdmin(true)}
          isMobile={isMobile}
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
              isMobile={isMobile}
            />

            {/* Üst bilgi */}
            <div style={{
              position: 'absolute', top: '14px', left: '50%', transform: 'translateX(-50%)',
              zIndex: 800, ...blurBg('#1e2130cc'),
              border: '1px solid #2d3148', borderRadius: '20px', padding: '7px 14px',
              fontSize: isMobile ? '11px' : '12px', color: '#94a3b8',
              pointerEvents: 'none', whiteSpace: 'nowrap', maxWidth: '88%', textAlign: 'center',
            }}>
              {hintText}
            </div>

            {/* Toast */}
            <div style={{
              position: 'absolute', top: '14px', left: '50%',
              transform: `translateX(-50%) translateY(${toast.visible ? 0 : -8}px)`,
              zIndex: 900, background: '#10b981', borderRadius: '20px', padding: '8px 18px',
              fontSize: '13px', fontWeight: 600, color: 'white', pointerEvents: 'none',
              whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(16,185,129,0.4)',
              opacity: toast.visible ? 1 : 0, transition: 'all 0.3s',
            }}>
              {toast.msg}
            </div>

            {/* Konum izni yok / GPS hatası → buton göster */}
            {showManualHint && (
              <div style={{
                position: 'absolute', top: '52px', left: '50%', transform: 'translateX(-50%)',
                zIndex: 800, ...blurBg('#78350fee'),
                border: '1px solid #f59e0b44', borderRadius: '12px', padding: '10px 14px',
                fontSize: '12px', color: '#fcd34d',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                maxWidth: '92%', textAlign: 'center',
              }}>
                {trulyDenied ? (
                  // Kalıcı red → Ayarlar yolu (otomatik algılama çalışıyorsa sayfa yenilemeden açılır)
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <span>🔒 Konum izni reddedildi</span>
                    {isMobile && (
                      <div style={{ fontSize: '11px', color: '#fcd34d99', lineHeight: 1.6, textAlign: 'center' }}>
                        Ayarlar → Gizlilik → Konum Servisleri<br />
                        → Safari → İzin Ver<br />
                        <em style={{ fontSize: '10px' }}>Geri dönünce otomatik algılanır</em>
                      </div>
                    )}
                    <button onClick={() => setManualPickMode(true)} style={btnStyle}>
                      📌 Manuel Konum Seç
                    </button>
                  </div>
                ) : (
                  // Dismissed veya bekleniyor → tekrar dialog açılabilir
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <span>⚠️ {gpsStatus === 'waiting' ? 'Konum izni bekleniyor' : 'GPS sinyali zayıf'}</span>
                    <button onClick={requestLocation} style={btnStyle}>
                      📍 Tekrar İzin İste
                    </button>
                    <button
                      onClick={() => setManualPickMode(true)}
                      style={{ ...btnStyle, background: 'none', border: 'none', textDecoration: 'underline', padding: '3px 4px' }}
                    >
                      Manuel seç
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Konum rozeti */}
            <div
              onClick={(gpsStatus === 'denied' || gpsStatus === 'error') ? requestLocation : undefined}
              style={{
                position: 'absolute', bottom: badgeBottom, left: '16px', zIndex: 800,
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '5px 10px', maxWidth: 'calc(50vw - 20px)',
                ...blurBg('#1e2130ee'), border: '1px solid #2d3148',
                borderRadius: '20px', fontSize: '11px', color: '#94a3b8',
                cursor: (gpsStatus === 'denied' || gpsStatus === 'error') ? 'pointer' : 'default',
                overflow: 'hidden',
              }}
            >
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, background: badge.dot }} />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {badge.text}
              </span>
            </div>

            {/* FABs */}
            <div style={{
              position: 'absolute', bottom: fabBottom, left: '50%', transform: 'translateX(-50%)',
              zIndex: 800, display: 'flex', gap: '10px',
            }}>
              {(gpsLocation || manualLocation) && (
                <button
                  style={s.fabBtn(false)}
                  onClick={() => setFlyTarget({ ...(gpsLocation || manualLocation) })}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2d3148')}
                >
                  📍 {isMobile ? 'Konum' : 'Konumuma Git'}
                </button>
              )}
              {!gpsLocation && !manualLocation && (
                <button
                  style={s.fabBtn(false)}
                  onClick={() => setManualPickMode(true)}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2d3148')}
                >
                  📌 {isMobile ? 'Konum Seç' : 'Konumumu Seç'}
                </button>
              )}
              <button
                style={s.fabBtn(true)}
                onClick={handleAddFromLocation}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                ＋ {isMobile ? 'Uyarı' : 'Uyarı Yayınla'}
              </button>
            </div>
          </div>

          {!isMobile && (
            <AlertSidebar
              onAlertClick={handleAlertClick}
              open={sidebarOpen}
              setOpen={setSidebarOpen}
              isMobile={false}
            />
          )}
        </div>
      </div>

      {isMobile && (
        <AlertSidebar
          onAlertClick={handleAlertClick}
          open={sidebarOpen}
          setOpen={setSidebarOpen}
          isMobile={true}
        />
      )}

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
