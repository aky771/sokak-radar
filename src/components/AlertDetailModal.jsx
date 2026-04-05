import React, { useState } from 'react'
import useAlertStore, { ALERT_TYPES } from '../store/useAlertStore'
import useAuthStore from '../store/useAuthStore'
import useIsMobile from '../hooks/useIsMobile'
import useProfileCache from '../hooks/useProfileCache'

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
  const hrs = Math.max(0, Math.floor(remaining / 3600000))
  const mins = Math.max(0, Math.floor((remaining % 3600000) / 60000))
  return (
    <div>
      <div style={{ height: '4px', background: '#2d3148', borderRadius: '2px' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 1s' }} />
      </div>
      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', textAlign: 'right' }}>
        {hrs > 0 ? `${hrs} saat ` : ''}{mins} dakika kaldı
      </div>
    </div>
  )
}

function AvatarCircle({ username, color, size = 36 }) {
  const letter = (username || '?')[0].toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color || '#6366f1',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 700, color: 'white', flexShrink: 0,
    }}>
      {letter}
    </div>
  )
}

export default function AlertDetailModal({ alert, onClose, onUserClick }) {
  const { voteOnAlert, userVotes, removeAlert } = useAlertStore()
  const { user, profile } = useAuthStore()
  const isMobile = useIsMobile()
  const [voting, setVoting] = useState(false)
  const [imgExpanded, setImgExpanded] = useState(false)

  if (!alert) return null

  const info = ALERT_TYPES[alert.type] || ALERT_TYPES.spotted
  const myVote = userVotes[alert.id]
  const isOwn = user && alert.user_id === user.id

  const cachedProfile = useProfileCache(isOwn ? null : alert.user_id)
  const displayUsername = isOwn
    ? (profile?.username || alert.username)
    : (cachedProfile?.username || alert.username)
  const avatarColor = isOwn
    ? (profile?.avatar_color || '#6366f1')
    : (cachedProfile?.avatar_color || '#6366f1')

  const handleVote = async (type) => {
    if (!user) return
    setVoting(true)
    await voteOnAlert(alert.id, type)
    setVoting(false)
  }

  const handleDelete = async () => {
    if (!isOwn) return
    await removeAlert(alert.id)
    onClose()
  }

  const overlay = {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.82)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: isMobile ? 'flex-end' : 'center',
    justifyContent: 'center',
    zIndex: 4000,
    padding: isMobile ? '0' : '20px',
  }

  const modal = {
    background: '#1e2130',
    border: '1px solid #2d3148',
    borderRadius: isMobile ? '20px 20px 0 0' : '16px',
    width: '100%',
    maxWidth: isMobile ? '100%' : '520px',
    maxHeight: isMobile ? '92dvh' : '88dvh',
    overflow: 'auto',
    boxShadow: '0 -8px 40px rgba(0,0,0,0.7)',
    paddingBottom: isMobile ? 'env(safe-area-inset-bottom, 0px)' : '0',
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
          padding: isMobile ? '12px 16px' : '18px 20px',
          borderBottom: '1px solid #2d3148',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 44, height: 44, borderRadius: '12px',
              background: info.bg, border: `1px solid ${info.color}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>
              {info.emoji}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{info.label}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{timeAgo(alert.created_at)}</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: '#252836', border: '1px solid #2d3148',
            color: '#94a3b8', width: 32, height: 32, borderRadius: '50%',
            fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        <div style={{ padding: isMobile ? '14px 16px' : '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Fotoğraf — sadece https:// URL'leri göster (javascript: protokolü engeli) */}
          {alert.photo_url && /^https?:\/\//i.test(alert.photo_url) && (
            <div>
              <img
                src={alert.photo_url}
                alt="Uyarı fotoğrafı"
                onClick={() => setImgExpanded(!imgExpanded)}
                style={{
                  width: '100%',
                  maxHeight: imgExpanded ? 'none' : '200px',
                  objectFit: imgExpanded ? 'contain' : 'cover',
                  borderRadius: 10,
                  cursor: 'pointer',
                  display: 'block',
                  border: '1px solid #2d3148',
                }}
              />
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 4, textAlign: 'center' }}>
                {imgExpanded ? 'Küçültmek için tıkla' : 'Büyütmek için tıkla'}
              </div>
            </div>
          )}

          {/* Açıklama */}
          {alert.description && (
            <div style={{
              background: '#252836', borderRadius: 10, padding: '10px 14px',
              fontSize: 14, color: '#cbd5e1', lineHeight: 1.55,
              border: '1px solid #2d3148',
            }}>
              {alert.description}
            </div>
          )}

          {/* Konum */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>📍</span>
            <div>
              {alert.address && (
                <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{alert.address}</div>
              )}
              <div style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace', marginTop: alert.address ? 2 : 0 }}>
                {alert.lat?.toFixed(5)}, {alert.lng?.toFixed(5)}
              </div>
            </div>
          </div>

          {/* Paylaşan kullanıcı */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#252836', borderRadius: 10, padding: '8px 12px',
              border: '1px solid #2d3148',
              cursor: alert.user_id ? 'pointer' : 'default',
            }}
            onClick={() => alert.user_id && onUserClick && onUserClick(alert.user_id, displayUsername)}
          >
            <AvatarCircle username={displayUsername} color={avatarColor} size={32} />
            <div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Paylaşan</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#c7d2fe' }}>
                @{displayUsername || 'Kullanıcı'}
              </div>
            </div>
            {alert.user_id && (
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#475569' }}>›</span>
            )}
          </div>

          {/* Oy sistemi — hala var mı / geçti mi? */}
          <div style={{ background: '#252836', borderRadius: 12, padding: '12px 14px', border: '1px solid #2d3148' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Bu uyarı hâlâ geçerli mi?
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                disabled={voting || !user}
                onClick={() => handleVote('like')}
                style={{
                  flex: 1, padding: '10px 8px', borderRadius: 10, cursor: user ? 'pointer' : 'not-allowed',
                  border: myVote === 'like' ? '2px solid #10b981' : '1px solid #2d3148',
                  background: myVote === 'like' ? '#10b98122' : '#1e2130',
                  color: myVote === 'like' ? '#10b981' : '#64748b',
                  fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <span style={{ fontSize: 18 }}>👍</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, lineHeight: 1 }}>Hâlâ Var</div>
                  <div style={{ fontSize: 11, color: myVote === 'like' ? '#10b98199' : '#475569', lineHeight: 1.3 }}>
                    {alert.like_count || 0}
                  </div>
                </div>
              </button>
              <button
                disabled={voting || !user}
                onClick={() => handleVote('dislike')}
                style={{
                  flex: 1, padding: '10px 8px', borderRadius: 10, cursor: user ? 'pointer' : 'not-allowed',
                  border: myVote === 'dislike' ? '2px solid #ef4444' : '1px solid #2d3148',
                  background: myVote === 'dislike' ? '#ef444422' : '#1e2130',
                  color: myVote === 'dislike' ? '#ef4444' : '#64748b',
                  fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <span style={{ fontSize: 18 }}>👎</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, lineHeight: 1 }}>Geçti</div>
                  <div style={{ fontSize: 11, color: myVote === 'dislike' ? '#ef444499' : '#475569', lineHeight: 1.3 }}>
                    {alert.dislike_count || 0}
                  </div>
                </div>
              </button>
            </div>
            {!user && (
              <div style={{ fontSize: 11, color: '#475569', marginTop: 8, textAlign: 'center' }}>
                Oy vermek için giriş yapın
              </div>
            )}
            {(alert.dislike_count || 0) >= 5 && (
              <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 8, textAlign: 'center' }}>
                ⚠️ Çok sayıda "Geçti" oyu — uyarı yakında kaldırılabilir
              </div>
            )}
          </div>

          {/* Süre çubuğu */}
          {alert.expires_at && <ExpiryBar expiresAt={alert.expires_at} />}

          {/* Kendi uyarısını sil */}
          {isOwn && (
            <button
              onClick={handleDelete}
              style={{
                width: '100%', padding: '10px', borderRadius: 10,
                border: '1px solid #ef444444', background: '#ef444411',
                color: '#ef4444', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              🗑 Bu Uyarıyı Sil
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
