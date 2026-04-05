import React, { useState, useEffect, useRef, useMemo } from 'react'
import useAlertStore, { ALERT_TYPES } from '../store/useAlertStore'
import useAuthStore from '../store/useAuthStore'
import { reverseGeocode } from '../utils/geocode'

function distKm(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function distLabel(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

function timeAgo(iso) {
  if (!iso) return ''
  const d = (Date.now() - new Date(iso)) / 1000
  if (d < 60) return 'Az önce'
  if (d < 3600) return `${Math.floor(d / 60)} dk önce`
  if (d < 86400) return `${Math.floor(d / 3600)} sa önce`
  return `${Math.floor(d / 86400)} gün önce`
}

function ExpiryBar({ expiresAt }) {
  const total = 12 * 3600 * 1000
  const remaining = new Date(expiresAt) - Date.now()
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100))
  const color = pct > 50 ? '#10b981' : pct > 20 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ height: '3px', background: '#1a1d27' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 1s' }} />
    </div>
  )
}

function AvatarMini({ username, color }) {
  return (
    <div style={{
      width: 18, height: 18, borderRadius: '50%', background: color || '#6366f1',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 9, fontWeight: 700, color: 'white', flexShrink: 0,
    }}>
      {(username || '?')[0].toUpperCase()}
    </div>
  )
}

// Adres lazy-geocode hook'u
function useAddress(alert) {
  const [address, setAddress] = useState(alert.address || null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (address || fetchedRef.current) return
    fetchedRef.current = true
    reverseGeocode(alert.lat, alert.lng).then((a) => { if (a) setAddress(a) })
  }, [alert.id])

  return address
}

// Tek kart bileşeni
function AlertCard({ alert, onDetailClick, onUserClick, onMapClick, userLocation }) {
  const { voteOnAlert, userVotes } = useAlertStore()
  const { user, profile } = useAuthStore()
  const [voting, setVoting] = useState(null)
  const [hovered, setHovered] = useState(false)
  const address = useAddress(alert)

  // Kendi uyarılarında canlı profil verisi kullan (renk/kullanıcı adı değişince anında yansısın)
  const isOwn = alert.user_id === user?.id
  const displayUsername = isOwn && profile?.username ? profile.username : alert.username
  const avatarColor = isOwn && profile?.avatar_color ? profile.avatar_color : '#6366f188'

  const info = ALERT_TYPES[alert.type] || ALERT_TYPES.spotted
  const myVote = userVotes[alert.id]

  const handleVote = async (e, type) => {
    e.stopPropagation()
    if (voting) return
    if (!user) {
      // Giriş yapılmamış — butona tıklanınca görsel feedback
      e.currentTarget.style.borderColor = '#ef4444'
      setTimeout(() => { if (e.currentTarget) e.currentTarget.style.borderColor = '' }, 600)
      return
    }
    setVoting(type)
    await voteOnAlert(alert.id, type)
    setVoting(null)
  }

  const voteBtn = (type) => {
    const isLike = type === 'like'
    const active = myVote === type
    const count = isLike ? (alert.like_count || 0) : (alert.dislike_count || 0)
    return (
      <button
        onClick={(e) => handleVote(e, type)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 3,
          padding: '3px 8px', height: 26, borderRadius: 6, cursor: user ? 'pointer' : 'default',
          border: active ? `1px solid ${isLike ? '#10b98166' : '#ef444466'}` : '1px solid #2d3148',
          background: active ? (isLike ? '#10b98118' : '#ef444418') : 'transparent',
          color: active ? (isLike ? '#10b981' : '#ef4444') : '#64748b',
          fontSize: 11, fontWeight: 600, lineHeight: '26px', transition: 'all 0.15s',
          opacity: voting && voting !== type ? 0.5 : 1,
          flexShrink: 0,
        }}
      >
        {isLike ? '👍' : '👎'} {count}
      </button>
    )
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#1e2130',
        border: `1px solid ${hovered ? info.color + '55' : '#2d3148'}`,
        borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.15s',
        marginBottom: 6,
      }}
    >
      {/* Kart başlığı */}
      <div
        onClick={() => onMapClick(alert)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px 6px', cursor: 'pointer' }}
      >
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: 5,
          background: info.bg, color: info.color,
          fontSize: 11, fontWeight: 700, flexShrink: 0,
        }}>
          {info.emoji} {info.label}
        </span>
        {userLocation && (
          <span style={{
            fontSize: 10, color: '#6366f1aa', fontWeight: 600, flexShrink: 0,
            background: '#6366f111', padding: '1px 6px', borderRadius: 4,
          }}>
            📍 {distLabel(distKm(userLocation.lat, userLocation.lng, alert.lat, alert.lng))}
          </span>
        )}
        <span style={{ fontSize: 10, color: '#475569', marginLeft: 'auto', flexShrink: 0 }}>
          {timeAgo(alert.created_at)}
        </span>
      </div>

      {/* Adres */}
      {address && (
        <div style={{ padding: '0 12px 4px', fontSize: 12, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11 }}>📍</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{address}</span>
        </div>
      )}

      {/* Açıklama */}
      {alert.description && (
        <div style={{
          padding: '0 12px 6px', fontSize: 12, color: '#94a3b8', lineHeight: 1.45,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {alert.description}
        </div>
      )}

      {/* Paylaşan kullanıcı */}
      <div
        onClick={() => onUserClick && onUserClick(alert.user_id, alert.username)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '0 12px 8px', cursor: alert.user_id ? 'pointer' : 'default',
        }}
      >
        <AvatarMini username={displayUsername} color={avatarColor} />
        <span style={{ fontSize: 11, color: '#6366f1aa', fontWeight: 500 }}>
          @{displayUsername || 'kullanıcı'}
        </span>
      </div>

      {/* Footer: oy + ayrıntı */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
        borderTop: '1px solid #1a1d27',
      }}>
        {voteBtn('like')}
        {voteBtn('dislike')}
        <button
          onClick={() => onDetailClick(alert)}
          style={{
            marginLeft: 'auto', padding: '4px 9px', borderRadius: 6,
            border: '1px solid #2d3148', background: 'none',
            color: '#64748b', fontSize: 11, cursor: 'pointer',
            flexShrink: 0, lineHeight: 1,
          }}
        >
          Ayrıntı ›
        </button>
      </div>

      <ExpiryBar expiresAt={alert.expires_at} />
    </div>
  )
}

// ---- Desktop styles ----
const ds = {
  sidebar: (open) => ({
    width: open ? '360px' : '0', minWidth: open ? '360px' : '0',
    overflow: 'hidden', background: '#1a1d27', borderLeft: '1px solid #2d3148',
    display: 'flex', flexDirection: 'column', transition: 'width 0.25s, min-width 0.25s',
    position: 'relative',
  }),
  toggle: {
    position: 'absolute', left: '-36px', top: '50%', transform: 'translateY(-50%)',
    width: '34px', height: '76px', background: '#1a1d27', border: '1px solid #2d3148',
    borderRight: 'none', borderRadius: '8px 0 0 8px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 500, color: '#64748b', fontSize: '16px',
  },
}

const HANDLE_H = 52   // sabit handle yüksekliği (px)
const HEAD_H   = 68   // sabit filtre başlığı yüksekliği (px)

// ---- Mobile styles ----
const ms = {
  sheet: (open) => ({
    position: 'fixed', bottom: 0, left: 0, right: 0,
    height: open ? '72dvh' : 'var(--sheet-closed-h)',
    background: '#1a1d27',
    borderTop: '1px solid #2d3148',
    borderRadius: '16px 16px 0 0',
    transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 700,
    // overflow: hidden SADECE border-radius clip için — scroll list ayrı absolute
    overflow: 'hidden',
  }),
  handle: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: HANDLE_H,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    paddingLeft: 16, paddingRight: 16,
    cursor: 'pointer', userSelect: 'none', zIndex: 2,
    background: '#1a1d27',
  },
  head: {
    position: 'absolute', top: HANDLE_H, left: 0, right: 0,
    height: HEAD_H,
    padding: '8px 12px',
    borderBottom: '1px solid #2d3148',
    borderTop: '1px solid #2d3148',
    background: '#1a1d27', zIndex: 2,
  },
  list: {
    position: 'absolute',
    top: HANDLE_H + HEAD_H,
    bottom: 0, left: 0, right: 0,
    overflowY: 'scroll',
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain',
    padding: '8px 10px 24px',
  },
}

// ---- Shared styles ----
const sh = {
  head: { padding: '10px 12px 8px', borderBottom: '1px solid #2d3148', flexShrink: 0 },
  headTitle: { fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '8px' },
  filterRow: { display: 'flex', gap: '4px', flexWrap: 'wrap' },
  filterBtn: (active) => ({
    padding: '3px 9px', borderRadius: '20px', cursor: 'pointer', fontSize: '11px', fontWeight: 500,
    border: active ? '1px solid #6366f1' : '1px solid #2d3148',
    background: active ? '#6366f122' : 'transparent',
    color: active ? '#818cf8' : '#64748b', transition: 'all 0.15s',
  }),
  list: {
    flex: 1, minHeight: 0, overflowY: 'auto',
    padding: '8px 10px 16px',
    WebkitOverflowScrolling: 'touch',
  },
  empty: { textAlign: 'center', padding: '40px 16px', color: '#64748b', fontSize: '13px' },
}

export default function AlertSidebar({ onAlertClick, onDetailClick, onUserClick, open, setOpen, isMobile, userLocation }) {
  const alerts = useAlertStore((st) => st.alerts)
  const [filter, setFilter] = useState('all')

  // Yakınlığa göre sırala (konum varsa), yoksa en yeni önce
  const sorted = useMemo(() => {
    const base = filter === 'all' ? alerts : alerts.filter((a) => a.type === filter)
    if (!userLocation) return base
    return [...base].sort((a, b) => {
      const da = distKm(userLocation.lat, userLocation.lng, a.lat, a.lng)
      const db = distKm(userLocation.lat, userLocation.lng, b.lat, b.lng)
      return da - db
    })
  }, [alerts, filter, userLocation])

  if (isMobile) {
    return (
      <div style={ms.sheet(open)}>

        {/* Handle — her zaman görünür, tıklanabilir */}
        <div style={ms.handle} onClick={() => setOpen(!open)}>
          <div style={{
            position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
            width: 36, height: 4, borderRadius: 2, background: '#3d4460',
          }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
            {open ? 'Uyarılar' : `Uyarılar (${sorted.length})`}
          </span>
          <span style={{
            fontSize: 18, color: '#64748b',
            transition: 'transform 0.3s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>⌃</span>
        </div>

        {/* Filtre başlığı — absolute, sabit yükseklik */}
        {open && (
          <div style={ms.head}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>
              {sorted.length} uyarı
              {userLocation && <span style={{ fontSize: 10, color: '#6366f166', fontWeight: 400, marginLeft: 6 }}>• yakına göre</span>}
            </div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap', overflowX: 'auto' }}>
              <button style={sh.filterBtn(filter === 'all')} onClick={() => setFilter('all')}>Tümü</button>
              {Object.entries(ALERT_TYPES).map(([key, info]) => (
                <button key={key} style={sh.filterBtn(filter === key)} onClick={() => setFilter(key)}>
                  {info.emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Kart listesi — absolute, top = handle + head, scroll */}
        {open && (
          <div style={ms.list}>
            {sorted.length === 0 && (
              <div style={sh.empty}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🗺️</div>
                Henüz uyarı yok.<br />
                <span style={{ fontSize: '11px' }}>Haritaya tıklayarak ekleyin.</span>
              </div>
            )}
            {sorted.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onMapClick={onAlertClick}
                onDetailClick={onDetailClick}
                onUserClick={onUserClick}
                userLocation={userLocation}
              />
            ))}
          </div>
        )}

      </div>
    )
  }

  // Desktop
  return (
    <div style={ds.sidebar(open)}>
      <button style={ds.toggle} onClick={() => setOpen(!open)}>
        {open ? '›' : '‹'}
      </button>
      <div style={sh.head}>
        <div style={sh.headTitle}>
          Uyarılar ({sorted.length})
          {userLocation && <span style={{ fontSize: 10, color: '#6366f188', fontWeight: 400, marginLeft: 6 }}>• yakına göre</span>}
        </div>
        <div style={sh.filterRow}>
          <button style={sh.filterBtn(filter === 'all')} onClick={() => setFilter('all')}>Tümü</button>
          {Object.entries(ALERT_TYPES).map(([key, info]) => (
            <button key={key} style={sh.filterBtn(filter === key)} onClick={() => setFilter(key)}>
              {info.emoji}
            </button>
          ))}
        </div>
      </div>
      <div style={sh.list}>
        {sorted.length === 0 && (
          <div style={sh.empty}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>🗺️</div>
            Henüz uyarı yok.<br />
            <span style={{ fontSize: '11px' }}>Haritaya tıklayarak ekleyin.</span>
          </div>
        )}
        {sorted.map((alert) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            onMapClick={onAlertClick}
            onDetailClick={onDetailClick}
            onUserClick={onUserClick}
            userLocation={userLocation}
          />
        ))}
      </div>
    </div>
  )
}
