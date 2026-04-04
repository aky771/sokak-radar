import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import useAuthStore from '../store/useAuthStore'
import { ALERT_TYPES } from '../store/useAlertStore'

function timeAgo(iso) {
  if (!iso) return '—'
  const d = (Date.now() - new Date(iso)) / 1000
  if (d < 60) return 'Az önce'
  if (d < 3600) return `${Math.floor(d / 60)} dk önce`
  if (d < 86400) return `${Math.floor(d / 3600)} sa önce`
  return new Date(iso).toLocaleDateString('tr-TR')
}

function Avatar({ username, size = 36 }) {
  const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#0ea5e9','#f97316']
  const color = colors[(username || '?').charCodeAt(0) % colors.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.38, color: 'white', flexShrink: 0,
      textTransform: 'uppercase',
    }}>
      {(username || '?')[0]}
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: '#0f1117',
    zIndex: 5000, display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  topbar: {
    display: 'flex', alignItems: 'center', gap: '16px', padding: '0 24px',
    height: '60px', background: '#1a1d27', borderBottom: '1px solid #2d3148', flexShrink: 0,
  },
  topbarTitle: { fontSize: '18px', fontWeight: 700, color: '#e2e8f0' },
  closeBtn: {
    marginLeft: 'auto', padding: '8px 16px', borderRadius: '8px',
    border: '1px solid #2d3148', background: 'none', color: '#94a3b8',
    cursor: 'pointer', fontSize: '13px', fontWeight: 600,
  },
  content: { flex: 1, overflow: 'auto', padding: '24px' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' },
  statCard: {
    background: '#1e2130', border: '1px solid #2d3148', borderRadius: '12px', padding: '16px 20px',
  },
  statLabel: { fontSize: '12px', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  statValue: { fontSize: '28px', fontWeight: 700, color: '#e2e8f0', lineHeight: 1 },
  statSub: { fontSize: '11px', color: '#475569', marginTop: '4px' },
  sectionTitle: { fontSize: '16px', fontWeight: 700, color: '#e2e8f0', marginBottom: '16px' },
  searchInput: {
    width: '100%', maxWidth: '320px', background: '#1e2130', border: '1px solid #2d3148',
    borderRadius: '8px', padding: '9px 14px', color: '#e2e8f0', fontSize: '14px', outline: 'none',
    marginBottom: '16px',
  },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' },
  th: {
    padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600,
    color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px',
    background: '#1a1d27', borderBottom: '1px solid #2d3148',
  },
  tr: (blocked) => ({
    background: blocked ? '#7f1d1d11' : '#1e2130',
    transition: 'background 0.15s',
  }),
  td: { padding: '12px 16px', fontSize: '13px', color: '#94a3b8', verticalAlign: 'middle' },
  badge: (color, bg) => ({
    display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
    borderRadius: '6px', background: bg, color, fontSize: '11px', fontWeight: 700,
  }),
  actionBtn: (variant) => ({
    padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
    border: 'none',
    background: variant === 'danger' ? '#7f1d1d33' : variant === 'success' ? '#064e3b33' : '#1a2744',
    color: variant === 'danger' ? '#fca5a5' : variant === 'success' ? '#6ee7b7' : '#93c5fd',
  }),
  alertsModal: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 6000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
  },
  alertsCard: {
    background: '#1e2130', border: '1px solid #2d3148', borderRadius: '12px',
    width: '100%', maxWidth: '560px', maxHeight: '80vh', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
  },
  alertsCardHead: {
    padding: '16px 20px', borderBottom: '1px solid #2d3148',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  alertRow: {
    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px',
    borderBottom: '1px solid #1a1d27',
  },
}

export default function AdminPanel({ onClose }) {
  const { signOut } = useAuthStore()
  const [profiles, setProfiles] = useState([])
  const [stats, setStats] = useState({ users: 0, activeAlerts: 0, blocked: 0, totalAlerts: 0 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [viewingUser, setViewingUser] = useState(null)
  const [userAlerts, setUserAlerts] = useState([])
  const [alertsLoading, setAlertsLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [profilesRes, activeAlertsRes, totalAlertsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('alerts').select('id', { count: 'exact' }).gt('expires_at', new Date().toISOString()),
      supabase.from('alerts').select('id', { count: 'exact' }),
    ])

    const all = profilesRes.data || []
    setProfiles(all)
    setStats({
      users: all.length,
      activeAlerts: activeAlertsRes.count || 0,
      blocked: all.filter((p) => p.is_blocked).length,
      totalAlerts: totalAlertsRes.count || 0,
    })
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleBlock = async (profile) => {
    const newStatus = !profile.is_blocked
    await supabase.rpc('admin_block_user', { target_id: profile.id, block_status: newStatus })
    setProfiles((prev) =>
      prev.map((p) => (p.id === profile.id ? { ...p, is_blocked: newStatus } : p))
    )
    setStats((s) => ({ ...s, blocked: s.blocked + (newStatus ? 1 : -1) }))
  }

  const deleteUserAlerts = async (profile) => {
    if (!window.confirm(`${profile.username} kullanıcısının tüm uyarıları silinsin mi?`)) return
    await supabase.rpc('admin_delete_user_alerts', { target_id: profile.id })
    setProfiles((prev) =>
      prev.map((p) => (p.id === profile.id ? { ...p, alert_count: 0 } : p))
    )
    if (viewingUser?.id === profile.id) setUserAlerts([])
  }

  const viewAlerts = async (profile) => {
    setViewingUser(profile)
    setAlertsLoading(true)
    const { data } = await supabase
      .from('alerts')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
    setUserAlerts(data || [])
    setAlertsLoading(false)
  }

  const deleteAlert = async (alertId) => {
    await supabase.from('alerts').delete().eq('id', alertId)
    setUserAlerts((prev) => prev.filter((a) => a.id !== alertId))
  }

  const filtered = profiles.filter(
    (p) =>
      p.username?.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={s.overlay}>
      <div style={s.topbar}>
        <span style={{ fontSize: '22px' }}>🛡️</span>
        <div style={s.topbarTitle}>Admin Paneli</div>
        <span style={{ fontSize: '12px', color: '#475569' }}>Sokak Radar Yönetim</span>
        <button
          style={s.closeBtn}
          onClick={async () => { await signOut(); onClose() }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#ef4444')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2d3148')}
        >
          Çıkış Yap & Kapat
        </button>
      </div>

      <div style={s.content}>
        {/* Stats */}
        <div style={s.statsRow}>
          {[
            { label: 'Toplam Kullanıcı', value: stats.users, sub: 'Kayıtlı hesap', icon: '👥' },
            { label: 'Aktif Uyarı', value: stats.activeAlerts, sub: 'Son 12 saat', icon: '📍' },
            { label: 'Toplam Uyarı', value: stats.totalAlerts, sub: 'Tüm zamanlar', icon: '📊' },
            { label: 'Bloklu Kullanıcı', value: stats.blocked, sub: 'Engelli hesap', icon: '🚫' },
          ].map((st) => (
            <div key={st.label} style={s.statCard}>
              <div style={s.statLabel}>{st.icon} {st.label}</div>
              <div style={s.statValue}>{loading ? '—' : st.value}</div>
              <div style={s.statSub}>{st.sub}</div>
            </div>
          ))}
        </div>

        {/* Users table */}
        <div style={s.sectionTitle}>Kullanıcı Yönetimi</div>
        <input
          style={s.searchInput}
          placeholder="Kullanıcı adı veya e-posta ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
          onBlur={(e) => (e.target.style.borderColor = '#2d3148')}
        />

        <div style={{ background: '#1e2130', borderRadius: '12px', border: '1px solid #2d3148', overflow: 'hidden' }}>
          <table style={s.table}>
            <thead>
              <tr>
                {['Kullanıcı', 'E-Posta', 'Katılım', 'Uyarı', 'Durum', 'İşlemler'].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ ...s.td, textAlign: 'center', padding: '40px', color: '#475569' }}>
                    Yükleniyor...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ ...s.td, textAlign: 'center', padding: '40px', color: '#475569' }}>
                    Kullanıcı bulunamadı
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} style={s.tr(p.is_blocked)}>
                    <td style={s.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Avatar username={p.username} />
                        <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{p.username}</span>
                      </div>
                    </td>
                    <td style={s.td}>{p.email}</td>
                    <td style={s.td}>{timeAgo(p.created_at)}</td>
                    <td style={s.td}>
                      <span style={{ color: '#6366f1', fontWeight: 700 }}>{p.alert_count}</span>
                    </td>
                    <td style={s.td}>
                      {p.is_blocked
                        ? <span style={s.badge('#fca5a5', '#7f1d1d44')}>🚫 Bloklu</span>
                        : <span style={s.badge('#6ee7b7', '#064e3b44')}>✅ Aktif</span>
                      }
                    </td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button style={s.actionBtn('info')} onClick={() => viewAlerts(p)}>
                          Uyarılar
                        </button>
                        <button
                          style={s.actionBtn(p.is_blocked ? 'success' : 'danger')}
                          onClick={() => toggleBlock(p)}
                        >
                          {p.is_blocked ? 'Blok Kaldır' : 'Blokla'}
                        </button>
                        {p.alert_count > 0 && (
                          <button style={s.actionBtn('danger')} onClick={() => deleteUserAlerts(p)}>
                            Sil
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User alerts modal */}
      {viewingUser && (
        <div style={s.alertsModal} onClick={(e) => e.target === e.currentTarget && setViewingUser(null)}>
          <div style={s.alertsCard}>
            <div style={s.alertsCardHead}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#e2e8f0' }}>
                  {viewingUser.username} — Uyarıları
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  {userAlerts.length} uyarı
                </div>
              </div>
              <button
                style={{ ...s.closeBtn, marginLeft: 0 }}
                onClick={() => setViewingUser(null)}
              >
                Kapat
              </button>
            </div>
            <div style={{ overflow: 'auto', flex: 1 }}>
              {alertsLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#475569' }}>Yükleniyor...</div>
              ) : userAlerts.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#475569' }}>Uyarı yok</div>
              ) : (
                userAlerts.map((alert) => {
                  const info = ALERT_TYPES[alert.type] || ALERT_TYPES.spotted
                  return (
                    <div key={alert.id} style={s.alertRow}>
                      <span style={{ fontSize: '22px' }}>{info.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 600 }}>
                          {info.label}
                          {alert.description && (
                            <span style={{ fontWeight: 400, color: '#94a3b8' }}> — {alert.description}</span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: '#475569', fontFamily: 'monospace', marginTop: '2px' }}>
                          {alert.lat?.toFixed(4)}, {alert.lng?.toFixed(4)} · {timeAgo(alert.created_at)}
                          {new Date(alert.expires_at) < new Date() && (
                            <span style={{ color: '#ef4444', marginLeft: '6px' }}>Süresi doldu</span>
                          )}
                        </div>
                      </div>
                      <button
                        style={s.actionBtn('danger')}
                        onClick={() => deleteAlert(alert.id)}
                      >
                        Sil
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
