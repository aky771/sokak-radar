import React, { useState, useEffect, useRef } from 'react'
import useAlertStore, { ALERT_TYPES } from '../store/useAlertStore'
import useAuthStore from '../store/useAuthStore'
import { reverseGeocode } from '../utils/geocode'

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
function AlertCard({ alert, onDetailClick, onUserClick, onMapClick }) {
  const { voteOnAlert, userVotes } = useAlertStore()
  const { user } = useAuthStore()
  const [voting, setVoting] = useState(null)
  const [hovered, setHovered] = useState(false)
  const address = useAddress(alert)

  const info = ALERT_TYPES[alert.type] || ALERT_TYPES.spotted
  const myVote = userVotes[alert.id]

  const handleVote = async (e, type) => {
    e.stopPropagation()
    if (!user || voting) return
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
      }}
    >
      {/* Kart başlığı */}
      <div
        onClick={() => onMapClick(alert)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px 6px', cursor: 'pointer' }}
      >
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: 5,
          background: info.bg, color: info.color,
          fontSize: 11, fontWeight: 700, flexShrink: 0,
        }}>
          {info.emoji} {info.label}
        </span>
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
        <AvatarMini username={alert.username} color="#6366f188" />
        <span style={{ fontSize: 11, color: '#6366f1aa', fontWeight: 500 }}>
          @{alert.username || 'kullanıcı'}
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

// ---- Mobile styles ----
const ms = {
  sheet: (open) => ({
    position: 'fixed', bottom: 0, left: 0, right: 0,
    height: open ? '65dvh' : 'var(--sheet-closed-h)',
    background: '#1a1d27',
    borderTop: '1px solid #2d3148',
    borderRadius: '16px 16px 0 0',
    display: 'flex', flexDirection: 'column',
    transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 700, overflow: 'hidden',
    WebkitOverflowScrolling: 'touch',
  }),
  handle: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 0, paddingLeft: 16, paddingRight: 16, paddingBottom: 0,
    minHeight: 52, flexShrink: 0, cursor: 'pointer',
    position: 'relative', userSelect: 'none',
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
    flex: 1, overflowY: 'auto', padding: '8px 10px',
    display: 'flex', flexDirection: 'column', gap: '6px',
  },
  empty: { textAlign: 'center', padding: '40px 16px', color: '#64748b', fontSize: '13px' },
}

export default function AlertSidebar({ onAlertClick, onDetailClick, onUserClick, open, setOpen, isMobile }) {
  const alerts = useAlertStore((st) => st.alerts)
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' ? alerts : alerts.filter((a) => a.type === filter)

  const alertList = (
    <>
      <div style={sh.head}>
        <div style={sh.headTitle}>Uyarılar ({filtered.length})</div>
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
        {filtered.length === 0 && (
          <div style={sh.empty}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>🗺️</div>
            Henüz uyarı yok.
            <br /><span style={{ fontSize: '11px' }}>Haritaya tıklayarak ekleyin.</span>
          </div>
        )}
        {filtered.map((alert) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            onMapClick={onAlertClick}
            onDetailClick={onDetailClick}
            onUserClick={onUserClick}
          />
        ))}
      </div>
    </>
  )

  if (isMobile) {
    return (
      <div style={ms.sheet(open)}>
        <div style={ms.handle} onClick={() => setOpen(!open)}>
          <div style={{
            position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
            width: 36, height: 4, borderRadius: 2, background: '#3d4460',
          }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
            {open ? 'Uyarılar' : `Uyarılar (${filtered.length})`}
          </span>
          <span style={{
            fontSize: 18, color: '#64748b',
            transition: 'transform 0.3s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>⌃</span>
        </div>
        {alertList}
      </div>
    )
  }

  return (
    <div style={ds.sidebar(open)}>
      <button style={ds.toggle} onClick={() => setOpen(!open)}>
        {open ? '›' : '‹'}
      </button>
      {alertList}
    </div>
  )
}
