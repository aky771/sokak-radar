import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import useAuthStore from '../store/useAuthStore'
import useAlertStore, { ALERT_TYPES } from '../store/useAlertStore'
import useIsMobile from '../hooks/useIsMobile'

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#a855f7','#ec4899','#14b8a6']

function AvatarCircle({ username, color, size = 64 }) {
  const letter = (username || '?')[0].toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color || '#6366f1',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 700, color: 'white', flexShrink: 0,
    }}>
      {letter}
    </div>
  )
}

function timeAgo(iso) {
  if (!iso) return ''
  const d = (Date.now() - new Date(iso)) / 1000
  if (d < 60) return 'Az önce'
  if (d < 3600) return `${Math.floor(d / 60)} dk önce`
  if (d < 86400) return `${Math.floor(d / 3600)} sa önce`
  return `${Math.floor(d / 86400)} gün önce`
}

export default function UserProfileModal({ userId, username: fallbackUsername, onClose, onAlertFocus }) {
  const { user, profile: myProfile, updateProfile } = useAuthStore()
  const { alerts } = useAlertStore()
  const isMobile = useIsMobile()
  const isOwn = user?.id === userId

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [editForm, setEditForm] = useState({})

  useEffect(() => {
    if (!userId) return
    if (isOwn && myProfile) {
      setProfile(myProfile)
      setLoading(false)
      return
    }
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error('Profil yüklenemedi:', error)
        if (data) {
          setProfile(data)
        } else {
          const nameHint = fallbackUsername || (isOwn ? user?.email?.split('@')[0] : null)
          setProfile(nameHint ? {
            id: userId, username: nameHint,
            display_name: null, bio: null, avatar_color: '#6366f1',
            alert_count: 0, created_at: null,
          } : null)
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error('Profil isteği başarısız:', err)
        setProfile(null)
        setLoading(false)
      })
  }, [userId, myProfile, isOwn])

  useEffect(() => {
    if (profile && editing) {
      setEditForm({
        username:     profile.username || '',
        display_name: profile.display_name || '',
        bio:          profile.bio || '',
        avatar_color: profile.avatar_color || '#6366f1',
      })
    }
  }, [editing, profile])

  // Bu kullanıcının aktif uyarıları
  const userAlerts = alerts.filter((a) => a.user_id === userId)

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    const { error } = await updateProfile(editForm)
    setSaving(false)
    if (!error) {
      setEditing(false)
    } else {
      setSaveError(error.message || 'Kaydetme başarısız, tekrar deneyin.')
    }
  }

  const overlay = {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.82)',
    backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: isMobile ? 'flex-end' : 'center',
    justifyContent: 'center',
    zIndex: 4500,
    padding: isMobile ? '0' : '20px',
  }

  const modal = {
    background: '#1e2130', border: '1px solid #2d3148',
    borderRadius: isMobile ? '20px 20px 0 0' : '16px',
    width: '100%', maxWidth: isMobile ? '100%' : '480px',
    maxHeight: isMobile ? '90dvh' : '85dvh',
    overflow: 'auto',
    boxShadow: '0 -8px 40px rgba(0,0,0,0.7)',
    paddingBottom: isMobile ? 'env(safe-area-inset-bottom, 0px)' : '0',
  }

  const input = {
    width: '100%', background: '#252836', border: '1px solid #2d3148',
    borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 14,
    outline: 'none',
  }

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        {isMobile && (
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#3d4460', margin: '12px auto 0' }} />
        )}

        {/* Başlık */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isMobile ? '12px 16px' : '16px 20px',
          borderBottom: '1px solid #2d3148',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>
            {isOwn ? 'Profilim' : 'Kullanıcı Profili'}
          </div>
          <button onClick={onClose} style={{
            background: '#252836', border: '1px solid #2d3148',
            color: '#94a3b8', width: 32, height: 32, borderRadius: '50%',
            fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Yükleniyor...</div>
        ) : !profile ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Profil bulunamadı.</div>
        ) : (
          <div style={{ padding: isMobile ? '16px' : '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Avatar + isim */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {editing ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <AvatarCircle username={editForm.username} color={editForm.avatar_color} size={56} />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {COLORS.map((c) => (
                      <div key={c} onClick={() => setEditForm((f) => ({ ...f, avatar_color: c }))}
                        style={{
                          width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer',
                          border: editForm.avatar_color === c ? '3px solid white' : '2px solid transparent',
                          transition: 'transform 0.1s', transform: editForm.avatar_color === c ? 'scale(1.2)' : 'scale(1)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <AvatarCircle username={profile.username} color={profile.avatar_color} size={56} />
              )}
              <div style={{ flex: 1 }}>
                {editing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                      style={input} value={editForm.display_name}
                      placeholder="Görünen ad (isteğe bağlı)"
                      onChange={(e) => setEditForm((f) => ({ ...f, display_name: e.target.value }))}
                    />
                    <input
                      style={input} value={editForm.username}
                      placeholder="Kullanıcı adı (harf, rakam, alt çizgi)"
                      maxLength={30}
                      onChange={(e) => {
                        // Sadece harf, rakam, alt çizgi — XSS / injection engeli
                        const safe = e.target.value.replace(/[^a-zA-Z0-9_çğıöşüÇĞİÖŞÜ]/g, '').slice(0, 30)
                        setEditForm((f) => ({ ...f, username: safe }))
                      }}
                    />
                  </div>
                ) : (
                  <>
                    {profile.display_name && (
                      <div style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9' }}>{profile.display_name}</div>
                    )}
                    <div style={{ fontSize: profile.display_name ? 13 : 17, fontWeight: profile.display_name ? 400 : 700, color: profile.display_name ? '#94a3b8' : '#f1f5f9' }}>
                      @{profile.username}
                    </div>
                    {profile.created_at && (
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>
                        {new Date(profile.created_at).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' })} üyesi
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Bio */}
            {editing ? (
              <textarea
                style={{ ...input, minHeight: 72, resize: 'vertical' }}
                value={editForm.bio}
                placeholder="Hakkında (isteğe bağlı)"
                onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
                maxLength={200}
              />
            ) : profile.bio ? (
              <div style={{
                background: '#252836', borderRadius: 10, padding: '10px 14px',
                fontSize: 13, color: '#94a3b8', lineHeight: 1.5, border: '1px solid #2d3148',
              }}>
                {profile.bio}
              </div>
            ) : null}

            {/* İstatistikler */}
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { label: 'Uyarı', value: profile.alert_count || 0, icon: '📡' },
                { label: 'Aktif', value: userAlerts.length, icon: '🔴' },
              ].map(({ label, value, icon }) => (
                <div key={label} style={{
                  flex: 1, background: '#252836', borderRadius: 10, padding: '12px',
                  border: '1px solid #2d3148', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 20 }}>{icon}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 }}>{value}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Aktif uyarılar */}
            {userAlerts.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                  Aktif Uyarıları
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {userAlerts.slice(0, 5).map((a) => {
                    const inf = ALERT_TYPES[a.type] || ALERT_TYPES.spotted
                    return (
                      <div key={a.id}
                        onClick={() => { if (onAlertFocus) { onAlertFocus(a); onClose() } }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          background: '#252836', borderRadius: 8, padding: '8px 12px',
                          border: '1px solid #2d3148', cursor: 'pointer',
                        }}
                      >
                        <span style={{ fontSize: 18 }}>{inf.emoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: inf.color }}>{inf.label}</div>
                          <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {a.address || `${a.lat?.toFixed(4)}, ${a.lng?.toFixed(4)}`}
                          </div>
                        </div>
                        <span style={{ fontSize: 10, color: '#475569', flexShrink: 0 }}>{timeAgo(a.created_at)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Butonlar */}
            {isOwn && (
              editing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {saveError && (
                  <div style={{
                    background: '#7f1d1d33', border: '1px solid #ef444466',
                    borderRadius: 8, padding: '8px 12px',
                    fontSize: 12, color: '#fca5a5',
                  }}>
                    ❌ {saveError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setEditing(false)} style={{
                    flex: 1, padding: '11px', borderRadius: 10,
                    border: '1px solid #2d3148', background: 'none', color: '#94a3b8',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}>İptal</button>
                  <button onClick={handleSave} disabled={saving} style={{
                    flex: 2, padding: '11px', borderRadius: 10,
                    border: 'none', background: saving ? '#2d3148' : '#6366f1',
                    color: saving ? '#64748b' : 'white',
                    fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                  }}>
                    {saving ? 'Kaydediliyor...' : '✓ Kaydet'}
                  </button>
                </div>
                </div>
              ) : (
                <button onClick={() => setEditing(true)} style={{
                  width: '100%', padding: '11px', borderRadius: 10,
                  border: '1px solid #2d3148', background: '#252836',
                  color: '#94a3b8', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>
                  ✏️ Profili Düzenle
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
