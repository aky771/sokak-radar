import React, { useState } from 'react'
import useAlertStore, { ALERT_TYPES } from '../store/useAlertStore'
import useAuthStore from '../store/useAuthStore'

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
    <div style={{ height: '3px', background: '#2d3148' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 1s' }} />
    </div>
  )
}

// ---------- Desktop styles ----------
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

// ---------- Mobile styles ----------
const ms = {
  sheet: (open) => ({
    position: 'fixed', bottom: 0, left: 0, right: 0,
    height: open ? '65vh' : '52px',
    background: '#1a1d27',
    borderTop: '1px solid #2d3148',
    borderRadius: '16px 16px 0 0',
    display: 'flex', flexDirection: 'column',
    transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 700, overflow: 'hidden',
  }),
  handle: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 16px', height: '52px', flexShrink: 0, cursor: 'pointer',
    position: 'relative', userSelect: 'none',
  },
  handleBar: {
    position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)',
    width: '36px', height: '4px', borderRadius: '2px', background: '#3d4460',
  },
  handleTitle: { fontSize: '13px', fontWeight: 700, color: '#e2e8f0' },
  handleArrow: (open) => ({
    fontSize: '18px', color: '#64748b',
    transition: 'transform 0.3s',
    transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
  }),
}

// ---------- Shared styles ----------
const sh = {
  head: { padding: '14px 16px', borderBottom: '1px solid #2d3148', flexShrink: 0 },
  headTitle: { fontSize: '14px', fontWeight: 700, color: '#e2e8f0', marginBottom: '10px' },
  filterRow: { display: 'flex', gap: '5px', flexWrap: 'wrap' },
  filterBtn: (active) => ({
    padding: '3px 9px', borderRadius: '20px', cursor: 'pointer', fontSize: '11px', fontWeight: 500,
    border: active ? '1px solid #6366f1' : '1px solid #2d3148',
    background: active ? '#6366f122' : 'transparent',
    color: active ? '#818cf8' : '#64748b', transition: 'all 0.15s',
  }),
  list: { flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px' },
  empty: { textAlign: 'center', padding: '40px 16px', color: '#475569', fontSize: '13px' },
  card: (borderColor) => ({
    background: '#1e2130', border: `1px solid ${borderColor || '#2d3148'}`,
    borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.15s',
  }),
  cardTop: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px 8px' },
  typeBadge: (color, bg) => ({
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '2px 8px', borderRadius: '5px', background: bg, color,
    fontSize: '11px', fontWeight: 700, flexShrink: 0,
  }),
  cardTime: { fontSize: '10px', color: '#475569', marginLeft: 'auto', flexShrink: 0 },
  cardDesc: {
    padding: '0 12px 8px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.45,
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
  },
  cardPhoto: { width: '100%', height: '80px', objectFit: 'cover', display: 'block' },
  cardFooter: {
    display: 'flex', alignItems: 'center', padding: '6px 12px', borderTop: '1px solid #1a1d27', gap: '6px',
  },
  voteBtn: {
    display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '5px',
    border: '1px solid #2d3148', background: 'none', color: '#64748b', fontSize: '11px', cursor: 'pointer',
  },
  coordText: { fontSize: '10px', color: '#334155', fontFamily: 'monospace' },
  deleteBtn: {
    marginLeft: 'auto', padding: '3px 8px', borderRadius: '5px', border: '1px solid #2d3148',
    background: 'none', color: '#475569', fontSize: '11px', cursor: 'pointer',
  },
}

export default function AlertSidebar({ onAlertClick, open, setOpen, isMobile }) {
  const alerts = useAlertStore((st) => st.alerts)
  const removeAlert = useAlertStore((st) => st.removeAlert)
  const voteAlert = useAlertStore((st) => st.voteAlert)
  const { user } = useAuthStore()
  const [filter, setFilter] = useState('all')
  const [hovered, setHovered] = useState(null)

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
        {filtered.map((alert) => {
          const info = ALERT_TYPES[alert.type] || ALERT_TYPES.spotted
          const isOwn = user && alert.user_id === user.id
          return (
            <div
              key={alert.id}
              style={sh.card(hovered === alert.id ? info.color : '#2d3148')}
              onMouseEnter={() => setHovered(alert.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onAlertClick(alert)}
            >
              <div style={sh.cardTop}>
                <span style={sh.typeBadge(info.color, info.bg)}>
                  {info.emoji} {info.label}
                </span>
                <span style={sh.cardTime}>{timeAgo(alert.created_at)}</span>
              </div>
              {alert.photo_url && <img src={alert.photo_url} alt="" style={sh.cardPhoto} />}
              {alert.description && <div style={sh.cardDesc}>{alert.description}</div>}
              <ExpiryBar expiresAt={alert.expires_at} />
              <div style={sh.cardFooter}>
                <span style={sh.coordText}>
                  {alert.lat?.toFixed(4)}, {alert.lng?.toFixed(4)}
                </span>
                <button
                  style={sh.voteBtn}
                  onClick={(e) => { e.stopPropagation(); voteAlert(alert.id) }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#10b981' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b' }}
                >
                  👍 {alert.votes}
                </button>
                {isOwn && (
                  <button
                    style={sh.deleteBtn}
                    onClick={(e) => { e.stopPropagation(); removeAlert(alert.id) }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}
                  >
                    Sil
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )

  // ---------- MOBİL: Alt çekmece ----------
  if (isMobile) {
    return (
      <div style={ms.sheet(open)}>
        {/* Sürükleme tutacağı */}
        <div style={ms.handle} onClick={() => setOpen(!open)}>
          <div style={ms.handleBar} />
          <span style={ms.handleTitle}>
            {open ? 'Uyarılar' : `Uyarılar (${filtered.length})`}
          </span>
          <span style={ms.handleArrow(open)}>⌃</span>
        </div>
        {alertList}
      </div>
    )
  }

  // ---------- MASAÜSTÜ: Sağ panel ----------
  return (
    <div style={ds.sidebar(open)}>
      <button style={ds.toggle} onClick={() => setOpen(!open)}>
        {open ? '›' : '‹'}
      </button>
      {alertList}
    </div>
  )
}
