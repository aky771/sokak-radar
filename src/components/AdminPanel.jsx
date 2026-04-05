import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import useAuthStore from '../store/useAuthStore'
import useIsMobile from '../hooks/useIsMobile'
import { ALERT_TYPES } from '../store/useAlertStore'

function timeAgo(iso) {
  if (!iso) return '—'
  const d = (Date.now() - new Date(iso)) / 1000
  if (d < 60) return 'Az önce'
  if (d < 3600) return `${Math.floor(d / 60)} dk önce`
  if (d < 86400) return `${Math.floor(d / 3600)} sa önce`
  if (d < 86400 * 30) return `${Math.floor(d / 86400)} gün önce`
  return new Date(iso).toLocaleDateString('tr-TR')
}

function Avatar({ username, color, size = 36 }) {
  const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#0ea5e9','#f97316']
  const bg = color || colors[(username || '?').charCodeAt(0) % colors.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.38, color: 'white', flexShrink: 0,
    }}>
      {(username || '?')[0].toUpperCase()}
    </div>
  )
}

function StatCard({ icon, label, value, sub, loading }) {
  return (
    <div style={{
      background: '#1e2130', border: '1px solid #2d3148', borderRadius: 12,
      padding: '14px 18px', minWidth: 0,
    }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#e2e8f0', lineHeight: 1 }}>
        {loading ? '—' : value}
      </div>
      <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{sub}</div>
    </div>
  )
}

// ─── Mobil kullanıcı kartı ────────────────────────────────────────────────────
function UserCard({ p, onViewAlerts, onToggleBlock, onDeleteAlerts }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{
      background: p.is_blocked ? '#7f1d1d11' : '#1e2130',
      border: `1px solid ${p.is_blocked ? '#ef444433' : '#2d3148'}`,
      borderRadius: 12, marginBottom: 8, overflow: 'hidden',
    }}>
      {/* Başlık satırı */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer' }}
      >
        <Avatar username={p.username} color={p.avatar_color} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.username}
          </div>
          <div style={{ fontSize: 11, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.email}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {p.is_blocked
            ? <span style={{ fontSize: 11, color: '#fca5a5', background: '#7f1d1d44', padding: '2px 7px', borderRadius: 6, fontWeight: 700 }}>🚫 Bloklu</span>
            : <span style={{ fontSize: 11, color: '#6ee7b7', background: '#064e3b44', padding: '2px 7px', borderRadius: 6, fontWeight: 700 }}>✅ Aktif</span>
          }
          <span style={{ fontSize: 16, color: '#475569', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>⌃</span>
        </div>
      </div>

      {/* Detaylar */}
      {expanded && (
        <div style={{ borderTop: '1px solid #2d3148', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#94a3b8' }}>
            <div>
              <div style={{ color: '#475569', fontSize: 10, marginBottom: 2 }}>UYARI</div>
              <div style={{ color: '#6366f1', fontWeight: 700, fontSize: 16 }}>{p.alert_count}</div>
            </div>
            <div>
              <div style={{ color: '#475569', fontSize: 10, marginBottom: 2 }}>KATILIM</div>
              <div style={{ fontWeight: 600 }}>{timeAgo(p.created_at)}</div>
            </div>
            <div>
              <div style={{ color: '#475569', fontSize: 10, marginBottom: 2 }}>SON GİRİŞ</div>
              <div style={{ fontWeight: 600 }}>{timeAgo(p.last_sign_in)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={btnStyle('info')} onClick={() => onViewAlerts(p)}>
              📋 Uyarıları Gör
            </button>
            <button style={btnStyle(p.is_blocked ? 'success' : 'danger')} onClick={() => onToggleBlock(p)}>
              {p.is_blocked ? '✅ Blok Kaldır' : '🚫 Blokla'}
            </button>
            {p.alert_count > 0 && (
              <button style={btnStyle('danger')} onClick={() => onDeleteAlerts(p)}>
                🗑 Uyarıları Sil
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const btnStyle = (variant) => ({
  padding: '7px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  border: 'none', touchAction: 'manipulation',
  background: variant === 'danger' ? '#7f1d1d33' : variant === 'success' ? '#064e3b33' : '#1a2744',
  color: variant === 'danger' ? '#fca5a5' : variant === 'success' ? '#6ee7b7' : '#93c5fd',
})

// ─── Ana Panel ────────────────────────────────────────────────────────────────
export default function AdminPanel({ onClose }) {
  const { signOut } = useAuthStore()
  const isMobile = useIsMobile()

  const [profiles, setProfiles]       = useState([])
  const [stats, setStats]             = useState({ users: 0, activeAlerts: 0, blocked: 0, totalAlerts: 0 })
  const [activeUsers, setActiveUsers] = useState([])
  const [search, setSearch]           = useState('')
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [viewingUser, setViewingUser] = useState(null)
  const [userAlerts, setUserAlerts]   = useState([])
  const [alertsLoading, setAlertsLoading] = useState(false)
  const refreshRef = useRef(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const now = new Date().toISOString()
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

      const [usersRes, activeAlertsRes, totalAlertsRes, recentAlertsRes] = await Promise.all([
        supabase.rpc('admin_get_all_users'),
        supabase.from('alerts').select('id', { count: 'exact', head: true }).gt('expires_at', now),
        supabase.from('alerts').select('id', { count: 'exact', head: true }),
        supabase.from('alerts')
          .select('user_id, username, type, created_at')
          .gt('created_at', oneHourAgo)
          .order('created_at', { ascending: false }),
      ])

      if (usersRes.error) throw usersRes.error

      const all = usersRes.data || []
      setProfiles(all)
      setStats({
        users:        all.length,
        activeAlerts: activeAlertsRes.count ?? 0,
        blocked:      all.filter((p) => p.is_blocked).length,
        totalAlerts:  totalAlertsRes.count ?? 0,
      })

      const recentMap = {}
      ;(recentAlertsRes.data || []).forEach((a) => {
        if (!recentMap[a.user_id]) recentMap[a.user_id] = { ...a, alertCount: 0 }
        recentMap[a.user_id].alertCount++
      })
      setActiveUsers(Object.values(recentMap))
    } catch (err) {
      console.error('Admin veri yükleme hatası:', err)
      setError(err?.message || 'Veri yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    refreshRef.current = setInterval(fetchData, 30_000)
    return () => clearInterval(refreshRef.current)
  }, [fetchData])

  const toggleBlock = async (p) => {
    const newStatus = !p.is_blocked
    const { error } = await supabase.rpc('admin_block_user', { target_id: p.id, block_status: newStatus })
    if (error) return alert('Hata: ' + error.message)
    setProfiles((prev) => prev.map((u) => u.id === p.id ? { ...u, is_blocked: newStatus } : u))
    setStats((s) => ({ ...s, blocked: s.blocked + (newStatus ? 1 : -1) }))
  }

  const deleteUserAlerts = async (p) => {
    if (!window.confirm(`${p.username} kullanıcısının tüm uyarıları silinsin mi?`)) return
    const { error } = await supabase.rpc('admin_delete_user_alerts', { target_id: p.id })
    if (error) return alert('Hata: ' + error.message)
    setProfiles((prev) => prev.map((u) => u.id === p.id ? { ...u, alert_count: 0 } : u))
    if (viewingUser?.id === p.id) setUserAlerts([])
  }

  const viewAlerts = async (p) => {
    setViewingUser(p)
    setAlertsLoading(true)
    const { data } = await supabase
      .from('alerts')
      .select('*')
      .eq('user_id', p.id)
      .order('created_at', { ascending: false })
      .limit(100)
    setUserAlerts(data || [])
    setAlertsLoading(false)
  }

  const deleteAlert = async (alertId) => {
    await supabase.from('alerts').delete().eq('id', alertId)
    setUserAlerts((prev) => prev.filter((a) => a.id !== alertId))
    setProfiles((prev) => prev.map((u) =>
      u.id === viewingUser?.id ? { ...u, alert_count: Math.max(0, u.alert_count - 1) } : u
    ))
  }

  const filtered = profiles.filter(
    (p) =>
      p.username?.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase())
  )

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0f1117',
      zIndex: 5000, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Topbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16,
        padding: isMobile ? '0 12px' : '0 24px',
        height: isMobile ? 52 : 60,
        background: '#1a1d27', borderBottom: '1px solid #2d3148', flexShrink: 0,
      }}>
        <span style={{ fontSize: isMobile ? 18 : 22 }}>🛡️</span>
        <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 700, color: '#e2e8f0' }}>
          Admin Paneli
        </div>
        {!isMobile && <span style={{ fontSize: 12, color: '#475569' }}>Sokak Radar Yönetim</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button
            style={{ padding: isMobile ? '6px 10px' : '8px 16px', borderRadius: 8, border: '1px solid #2d3148', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: isMobile ? 12 : 13, fontWeight: 600 }}
            onClick={onClose}
          >
            {isMobile ? '←' : '← Geri Dön'}
          </button>
          <button
            style={{ padding: isMobile ? '6px 10px' : '8px 16px', borderRadius: 8, border: '1px solid #2d3148', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: isMobile ? 12 : 13, fontWeight: 600 }}
            onClick={async () => { await signOut(); onClose() }}
          >
            {isMobile ? '⏻' : 'Çıkış Yap'}
          </button>
        </div>
      </div>

      {/* İçerik */}
      <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '14px 12px' : '24px' }}>

        {/* Hata durumu */}
        {error && (
          <div style={{
            background: '#7f1d1d22', border: '1px solid #ef444444', borderRadius: 12,
            padding: '16px 20px', marginBottom: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fca5a5' }}>⚠️ Veri yüklenemedi</div>
              <div style={{ fontSize: 12, color: '#ef444499', marginTop: 4 }}>{error}</div>
            </div>
            <button
              onClick={fetchData}
              style={{ ...btnStyle('danger'), flexShrink: 0 }}
            >
              Tekrar Dene
            </button>
          </div>
        )}

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: isMobile ? 10 : 16, marginBottom: isMobile ? 16 : 24,
        }}>
          <StatCard icon="👥" label="Kullanıcı"    value={stats.users}        sub="Kayıtlı hesap"  loading={loading} />
          <StatCard icon="📍" label="Aktif Uyarı"  value={stats.activeAlerts} sub="Son 12 saat"    loading={loading} />
          <StatCard icon="📊" label="Toplam Uyarı" value={stats.totalAlerts}  sub="Tüm zamanlar"   loading={loading} />
          <StatCard icon="🚫" label="Bloklu"        value={stats.blocked}      sub="Engelli hesap"  loading={loading} />
        </div>

        {/* Aktif Kullanıcılar */}
        <div style={{ marginBottom: isMobile ? 16 : 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981', flexShrink: 0 }} />
            Aktif Kullanıcılar
            <span style={{ fontSize: 11, fontWeight: 400, color: '#475569' }}>— Son 1 saat</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6366f1', background: '#6366f111', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
              {activeUsers.length} kişi
            </span>
          </div>
          {activeUsers.length === 0 ? (
            <div style={{ color: '#475569', fontSize: 13, padding: '14px 16px', background: '#1e2130', borderRadius: 10, border: '1px solid #2d3148' }}>
              Son 1 saatte aktif kullanıcı yok.
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {activeUsers.map((u) => {
                const info = ALERT_TYPES[u.type] || ALERT_TYPES.spotted
                return (
                  <div key={u.user_id} style={{
                    background: '#1e2130', border: '1px solid #10b98133',
                    borderRadius: 10, padding: '10px 14px',
                    display: 'flex', alignItems: 'center', gap: 10,
                    minWidth: isMobile ? 0 : 200, flex: isMobile ? '1 1 calc(50% - 4px)' : 'none',
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', flexShrink: 0, boxShadow: '0 0 6px #10b981' }} />
                    <Avatar username={u.username} size={26} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.username || 'Anonim'}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        {info.emoji} {u.alertCount} uyarı · {timeAgo(u.created_at)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Kullanıcı Yönetimi */}
        <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>
          Kullanıcı Yönetimi
        </div>
        <input
          style={{
            width: '100%', maxWidth: isMobile ? '100%' : '320px',
            background: '#1e2130', border: '1px solid #2d3148', borderRadius: 8,
            padding: '9px 14px', color: '#e2e8f0', fontSize: 14, outline: 'none', marginBottom: 12,
            boxSizing: 'border-box',
          }}
          placeholder="Kullanıcı adı veya e-posta ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: '#475569' }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>⏳</div>
            Kullanıcılar yükleniyor...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: '#475569', background: '#1e2130', borderRadius: 12, border: '1px solid #2d3148' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>👥</div>
            Kullanıcı bulunamadı
          </div>
        ) : isMobile ? (
          /* ── Mobil: kart listesi ── */
          <div>
            {filtered.map((p) => (
              <UserCard
                key={p.id}
                p={p}
                onViewAlerts={viewAlerts}
                onToggleBlock={toggleBlock}
                onDeleteAlerts={deleteUserAlerts}
              />
            ))}
          </div>
        ) : (
          /* ── Desktop: tablo ── */
          <div style={{ background: '#1e2130', borderRadius: 12, border: '1px solid #2d3148', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
              <thead>
                <tr>
                  {['Kullanıcı', 'E-Posta', 'Katılım / Son Giriş', 'Uyarı', 'Durum', 'İşlemler'].map((h) => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600,
                      color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px',
                      background: '#1a1d27', borderBottom: '1px solid #2d3148',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} style={{ background: p.is_blocked ? '#7f1d1d11' : '#1e2130' }}>
                    <td style={{ padding: '11px 16px', fontSize: 13, color: '#94a3b8', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar username={p.username} color={p.avatar_color} />
                        <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{p.username}</span>
                        {p.is_admin && <span style={{ fontSize: 10, color: '#fbbf24', background: '#78350f33', padding: '1px 6px', borderRadius: 5 }}>ADMIN</span>}
                      </div>
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: '#64748b', verticalAlign: 'middle' }}>{p.email}</td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: '#94a3b8', verticalAlign: 'middle' }}>
                      <div>{timeAgo(p.created_at)}</div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                        Son giriş: {timeAgo(p.last_sign_in)}
                      </div>
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 13, color: '#94a3b8', verticalAlign: 'middle' }}>
                      <span style={{ color: '#6366f1', fontWeight: 700, fontSize: 16 }}>{p.alert_count}</span>
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 13, color: '#94a3b8', verticalAlign: 'middle' }}>
                      {p.is_blocked
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6, background: '#7f1d1d44', color: '#fca5a5', fontSize: 11, fontWeight: 700 }}>🚫 Bloklu</span>
                        : <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6, background: '#064e3b44', color: '#6ee7b7', fontSize: 11, fontWeight: 700 }}>✅ Aktif</span>
                      }
                    </td>
                    <td style={{ padding: '11px 16px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button style={btnStyle('info')} onClick={() => viewAlerts(p)}>Uyarılar</button>
                        <button style={btnStyle(p.is_blocked ? 'success' : 'danger')} onClick={() => toggleBlock(p)}>
                          {p.is_blocked ? 'Blok Kaldır' : 'Blokla'}
                        </button>
                        {p.alert_count > 0 && (
                          <button style={btnStyle('danger')} onClick={() => deleteUserAlerts(p)}>Sil</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Kullanıcı uyarıları modalı */}
      {viewingUser && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
            zIndex: 6000, display: 'flex',
            alignItems: isMobile ? 'flex-end' : 'center',
            justifyContent: 'center',
            padding: isMobile ? 0 : '24px',
          }}
          onClick={(e) => e.target === e.currentTarget && setViewingUser(null)}
        >
          <div style={{
            background: '#1e2130', border: '1px solid #2d3148',
            borderRadius: isMobile ? '20px 20px 0 0' : 12,
            width: '100%', maxWidth: isMobile ? '100%' : '560px',
            maxHeight: isMobile ? '85dvh' : '80vh',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            {isMobile && (
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#3d4460', margin: '10px auto 0' }} />
            )}
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid #2d3148',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>
                  {viewingUser.username} — Uyarıları
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {alertsLoading ? 'Yükleniyor...' : `${userAlerts.length} kayıt`}
                </div>
              </div>
              <button
                style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #2d3148', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                onClick={() => setViewingUser(null)}
              >
                Kapat
              </button>
            </div>
            <div style={{ overflow: 'auto', flex: 1, WebkitOverflowScrolling: 'touch' }}>
              {alertsLoading ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#475569' }}>Yükleniyor...</div>
              ) : userAlerts.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#475569' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
                  Uyarı yok
                </div>
              ) : (
                userAlerts.map((alert) => {
                  const info = ALERT_TYPES[alert.type] || ALERT_TYPES.spotted
                  const expired = new Date(alert.expires_at) < new Date()
                  return (
                    <div key={alert.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 20px', borderBottom: '1px solid #1a1d27',
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                        background: info.bg, border: `1px solid ${info.color}44`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                      }}>
                        {info.emoji}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>
                          {info.label}
                          {alert.description && (
                            <span style={{ fontWeight: 400, color: '#94a3b8' }}> — {alert.description}</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                          {alert.lat?.toFixed(4)}, {alert.lng?.toFixed(4)} · {timeAgo(alert.created_at)}
                          {expired && <span style={{ color: '#ef4444', marginLeft: 6 }}>· Süresi doldu</span>}
                        </div>
                      </div>
                      <button style={{ ...btnStyle('danger'), flexShrink: 0 }} onClick={() => deleteAlert(alert.id)}>
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
