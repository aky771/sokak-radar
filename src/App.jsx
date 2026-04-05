import React, { useState, useCallback, useEffect, useRef } from 'react'
import Header from './components/Header'
import MapView from './components/MapView'
import AlertSidebar from './components/AlertSidebar'
import AddAlertModal from './components/AddAlertModal'
import AuthModal from './components/AuthModal'
import AdminPanel from './components/AdminPanel'
import AlertDetailModal from './components/AlertDetailModal'
import UserProfileModal from './components/UserProfileModal'
import useAlertStore, { ALERT_TYPES } from './store/useAlertStore'
import useAuthStore from './store/useAuthStore'
import useGeolocation from './hooks/useGeolocation'
import useIsMobile from './hooks/useIsMobile'

// Safari için webkit prefix'li backdrop
const blurBg = (bg) => ({
  background: bg,
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
})

// Haversine mesafe (km)
function distKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const s = {
  app: { display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  content: { display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' },
  mapWrapper: { flex: 1, position: 'relative', overflow: 'hidden' },
  fabBtn: (primary) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '6px', padding: '0 18px', borderRadius: '30px',
    height: '44px', minHeight: '44px',
    border: primary ? 'none' : '1px solid #2d3148', cursor: 'pointer', whiteSpace: 'nowrap',
    ...blurBg(primary ? '#6366f1' : '#1e2130ee'),
    color: primary ? 'white' : '#94a3b8', fontSize: '13px', fontWeight: 600,
    lineHeight: '1', boxShadow: '0 4px 20px rgba(0,0,0,0.35)', transition: 'all 0.15s',
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
  const { fetchAlerts, subscribeToAlerts, addAlert, alerts } = useAlertStore()
  const { user, profile, init: initAuth, loading: authLoading, isAdmin } = useAuthStore()
  const {
    location, ipLocation, gpsLocation, manualLocation,
    setManualLocation, gpsStatus, gpsAccuracy, permissionState, requestLocation,
  } = useGeolocation()

  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768)

  const [clickedPos, setClickedPos]             = useState(null)
  const [modalOpen, setModalOpen]               = useState(false)
  const [authModalOpen, setAuthModalOpen]       = useState(false)
  const [showAdmin, setShowAdmin]               = useState(false)
  const [pendingPos, setPendingPos]             = useState(null)
  const [flyTarget, setFlyTarget]               = useState(null)
  const [toast, setToast]                       = useState({ msg: '', visible: false })
  const [manualPickMode, setManualPickMode]     = useState(false)
  const [detailAlert, setDetailAlert]           = useState(null)   // AlertDetailModal
  const [profileUser, setProfileUser]            = useState(null)   // { id, username } for UserProfileModal

  // Yakın uyarı bildirimi
  const [nearbyAlert, setNearbyAlert]   = useState(null)
  const [alertQueue, setAlertQueue]     = useState([])   // birden fazla yakın uyarı sırası
  const locationRef                     = useRef(null)
  const notifiedAlertsRef               = useRef(new Set()) // bu oturumda zaten bildirilen alert id'leri
  const nearbyTimerRef                  = useRef(null)

  useEffect(() => { locationRef.current = location }, [location])

  // Sıradaki uyarıyı göster
  const showNextInQueue = useCallback((queue) => {
    if (queue.length === 0) return
    const [next, ...rest] = queue
    setNearbyAlert(next)
    setAlertQueue(rest)
    clearTimeout(nearbyTimerRef.current)
    nearbyTimerRef.current = setTimeout(() => {
      setNearbyAlert(null)
      if (rest.length > 0) showNextInQueue(rest)
    }, 8000)
  }, [])

  // GPS konumu değişince mevcut uyarılara yakınlık kontrolü (500 m)
  useEffect(() => {
    if (!location) return
    const NOTIFY_M = 500   // bildirim eşiği (metre)
    const RESET_M  = 1500  // bu kadar uzaklaşınca tekrar bildirilebilir hale gelir

    // Uzaklaşılan uyarıları notifiedRef'den temizle
    notifiedAlertsRef.current.forEach((id) => {
      const a = alerts.find((x) => x.id === id)
      if (!a) { notifiedAlertsRef.current.delete(id); return }
      const m = distKm(location.lat, location.lng, a.lat, a.lng) * 1000
      if (m > RESET_M) notifiedAlertsRef.current.delete(id)
    })

    // Yeni yakın uyarıları bul
    const newNearby = alerts.filter((a) => {
      if (notifiedAlertsRef.current.has(a.id)) return false
      return distKm(location.lat, location.lng, a.lat, a.lng) * 1000 <= NOTIFY_M
    })

    if (newNearby.length === 0) return

    newNearby.forEach((a) => notifiedAlertsRef.current.add(a.id))

    setAlertQueue((prev) => {
      const combined = [...prev, ...newNearby]
      if (!nearbyAlert) showNextInQueue(combined)
      return nearbyAlert ? combined : []
    })
  }, [location, alerts])

  const supabaseConfigured = !!(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  )

  const showToast = useCallback((msg, duration = 3000) => {
    setToast({ msg, visible: true })
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), duration)
  }, [])

  // Yeni uyarı gelince bildirim göster (realtime)
  const handleNewAlert = useCallback((alert) => {
    const loc = locationRef.current
    if (!loc) return
    const km = distKm(loc.lat, loc.lng, alert.lat, alert.lng)
    if (km <= 1) {
      notifiedAlertsRef.current.add(alert.id)
      setNearbyAlert(alert)
      clearTimeout(nearbyTimerRef.current)
      nearbyTimerRef.current = setTimeout(() => setNearbyAlert(null), 8000)
    }
  }, [])

  useEffect(() => {
    if (!supabaseConfigured) return
    initAuth()
    fetchAlerts()
    const unsub = subscribeToAlerts(handleNewAlert)
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000)
    return () => { unsub(); clearInterval(interval); clearTimeout(nearbyTimerRef.current) }
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

  const handleDetailClick = useCallback((alert) => {
    setDetailAlert(alert)
  }, [])

  const handleUserClick = useCallback((userId, username) => {
    if (userId) setProfileUser({ id: userId, username })
  }, [])

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

  const trulyDenied = permissionState === 'denied' || gpsStatus === 'denied'
  const showManualHint = !gpsLocation && !manualLocation &&
    (trulyDenied || gpsStatus === 'unreliable' || gpsStatus === 'error' || gpsStatus === 'waiting')

  const fabBottom   = isMobile ? 'var(--fab-bottom)' : '24px'
  const badgeBottom = isMobile ? 'var(--badge-bottom)' : '80px'

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

  const sidebarProps = {
    onAlertClick: handleAlertClick,
    onDetailClick: handleDetailClick,
    onUserClick: handleUserClick,
    open: sidebarOpen,
    setOpen: setSidebarOpen,
    userLocation: location,
  }

  return (
    <>
      <div style={s.app} className="app-root">
        <Header
          onLoginClick={() => setAuthModalOpen(true)}
          onAdminClick={() => setShowAdmin(true)}
          onProfileClick={() => user && setProfileUser({ id: user.id, username: profile?.username })}
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
              onAlertDetail={handleDetailClick}
              sidebarOpen={sidebarOpen}
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

            {/* Yakın uyarı bildirimi */}
            {nearbyAlert && (
              <div style={{
                position: 'absolute', top: '52px', left: '50%', transform: 'translateX(-50%)',
                zIndex: 850, maxWidth: '92%', minWidth: '260px',
                ...blurBg('#1e3a5fee'),
                border: '1px solid #3b82f666', borderRadius: '14px', padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: '10px',
                boxShadow: '0 4px 20px rgba(59,130,246,0.3)',
                animation: 'slideDown 0.3s ease',
              }}>
                <span style={{ fontSize: 22 }}>
                  {(ALERT_TYPES[nearbyAlert.type] || {}).emoji || '📡'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#93c5fd' }}>
                    📍 Yakınınızda uyarı var!
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(ALERT_TYPES[nearbyAlert.type] || {}).label} — {nearbyAlert.address || nearbyAlert.description || 'Detay için tıklayın'}
                  </div>
                  {alertQueue.length > 0 && (
                    <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
                      +{alertQueue.length} uyarı daha var
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { setDetailAlert(nearbyAlert); setNearbyAlert(null); showNextInQueue(alertQueue) }}
                  style={{
                    background: '#3b82f6', border: 'none', color: 'white',
                    padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  Gör
                </button>
                <button
                  onClick={() => { setNearbyAlert(null); showNextInQueue(alertQueue) }}
                  style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 16, cursor: 'pointer', padding: '2px 4px' }}
                >
                  ×
                </button>
              </div>
            )}

            {/* Konum izni yok / GPS hatası */}
            {showManualHint && !(isMobile && sidebarOpen) && (
              <div style={{
                position: 'absolute', top: nearbyAlert ? '108px' : '52px',
                left: '50%', transform: 'translateX(-50%)',
                zIndex: 800, ...blurBg('#78350fee'),
                border: '1px solid #f59e0b44', borderRadius: '12px', padding: '10px 14px',
                fontSize: '12px', color: '#fcd34d',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                maxWidth: '92%', textAlign: 'center',
              }}>
                {trulyDenied ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px' }}>🔒 Konum izni reddedildi</span>
                    {isMobile && (
                      <div style={{
                        background: 'rgba(0,0,0,0.35)', borderRadius: '10px', padding: '10px 12px',
                        width: '100%', textAlign: 'left',
                      }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#fbbf24', marginBottom: '8px' }}>
                          Safari için konum izni nasıl açılır:
                        </div>
                        {[
                          ['1', 'Ayarlar', 'iPhone Ana Ekranından açın'],
                          ['2', 'Gizlilik ve Güvenlik', 'Aşağı kaydırın'],
                          ['3', 'Konum Servisleri', 'Açık olduğunu kontrol edin'],
                          ['4', 'Safari Siteleri', 'Listede bulun'],
                          ['5', 'İzin Ver (Kullanırken)', 'Seçeneği işaretleyin'],
                        ].map(([num, title, sub]) => (
                          <div key={num} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                            <div style={{
                              width: '20px', height: '20px', borderRadius: '50%',
                              background: '#f59e0b33', border: '1px solid #f59e0b66',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '10px', fontWeight: 700, color: '#fbbf24', flexShrink: 0,
                            }}>{num}</div>
                            <div>
                              <div style={{ fontSize: '11px', fontWeight: 600, color: '#fcd34d' }}>{title}</div>
                              <div style={{ fontSize: '10px', color: '#fcd34d88' }}>{sub}</div>
                            </div>
                          </div>
                        ))}
                        <div style={{ fontSize: '10px', color: '#fcd34d77', marginTop: '4px', fontStyle: 'italic' }}>
                          Ayarlardan döndüğünüzde konum otomatik algılanır.
                        </div>
                      </div>
                    )}
                    <button onClick={() => setManualPickMode(true)} style={btnStyle}>
                      📌 Manuel Konum Seç
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <span>⚠️ {gpsStatus === 'waiting' ? 'Konum izni bekleniyor' : 'GPS sinyali zayıf'}</span>
                    <button onClick={requestLocation} style={btnStyle}>📍 Tekrar İzin İste</button>
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
            {!(isMobile && sidebarOpen) && <div
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
            </div>}

            {/* FABs */}
            {!(isMobile && sidebarOpen) && <div style={{
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
                <span style={{ fontSize: '17px', lineHeight: 1 }}>+</span>
                {isMobile ? 'Uyarı' : 'Uyarı Yayınla'}
              </button>
            </div>}
          </div>

          {!isMobile && <AlertSidebar {...sidebarProps} isMobile={false} />}
        </div>
      </div>

      {isMobile && <AlertSidebar {...sidebarProps} isMobile={true} />}

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

      {detailAlert && (
        <AlertDetailModal
          alert={detailAlert}
          onClose={() => setDetailAlert(null)}
          onUserClick={(uid, uname) => { setDetailAlert(null); setProfileUser({ id: uid, username: uname }) }}
        />
      )}

      {profileUser && (
        <UserProfileModal
          userId={profileUser.id}
          username={profileUser.username}
          onClose={() => setProfileUser(null)}
          onAlertFocus={(alert) => {
            handleAlertClick(alert)
            setDetailAlert(alert)
          }}
        />
      )}
    </>
  )
}
