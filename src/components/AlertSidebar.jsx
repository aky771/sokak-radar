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
    <div style={{ height: '3px', background: '#2d3148', marginBottom: '0' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 1s' }} />
    </div>
  )
}

const s = {
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

export default function AlertSidebar({ onAlertClick }) {
  const alerts = useAlertStore((st) => st.alerts)
  const removeAlert = useAlertStore((st) => st.removeAlert)
  const voteAlert = useAlertStore((st) => st.voteAlert)
  const { user } = useAuthStore()
  const [open, setOpen] = useState(true)
  const [filter, setFilter] = useState('all')
  const [hovered, setHovered] = useState(null)

  const filtered = filter === 'all' ? alerts : alerts.filter((a) => a.type === filter)

  return (
    <div style={s.sidebar(open)}>
      <button style={s.toggle} onClick={() => setOpen(!open)}>
        {open ? '›' : '‹'}
      </button>

      <div style={s.head}>
        <div style={s.headTitle}>Uyarılar ({filtered.length})</div>
        <div style={s.filterRow}>
          <button style={s.filterBtn(filter === 'all')} onClick={() => setFilter('all')}>Tümü</button>
          {Object.entries(ALERT_TYPES).map(([key, info]) => (
            <button key={key} style={s.filterBtn(filter === key)} onClick={() => setFilter(key)}>
              {info.emoji}
            </button>
          ))}
        </div>
      </div>

      <div style={s.list}>
        {filtered.length === 0 && (
          <div style={s.empty}>
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
              style={s.card(hovered === alert.id ? info.color : '#2d3148')}
              onMouseEnter={() => setHovered(alert.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onAlertClick(alert)}
            >
              <div style={s.cardTop}>
                <span style={s.typeBadge(info.color, info.bg)}>
                  {info.emoji} {info.label}
                </span>
                <span style={s.cardTime}>{timeAgo(alert.created_at)}</span>
              </div>

              {alert.photo_url && (
                <img src={alert.photo_url} alt="" style={s.cardPhoto} />
              )}
              {alert.description && (
                <div style={s.cardDesc}>{alert.description}</div>
              )}

              <ExpiryBar expiresAt={alert.expires_at} />

              <div style={s.cardFooter}>
                <span style={s.coordText}>
                  {alert.lat?.toFixed(4)}, {alert.lng?.toFixed(4)}
                </span>
                <button
                  style={s.voteBtn}
                  onClick={(e) => { e.stopPropagation(); voteAlert(alert.id) }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#10b981' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b' }}
                >
                  👍 {alert.votes}
                </button>
                {(isOwn) && (
                  <button
                    style={s.deleteBtn}
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
    </div>
  )
}
