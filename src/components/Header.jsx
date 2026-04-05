import React from 'react'
import useAlertStore from '../store/useAlertStore'
import useAuthStore from '../store/useAuthStore'

export default function Header({ onLoginClick, onAdminClick, isMobile }) {
  const alerts = useAlertStore((st) => st.alerts)
  const { user, profile, signOut, isAdmin } = useAuthStore()

  const s = {
    header: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingLeft: isMobile ? '12px' : '20px',
      paddingRight: isMobile ? '12px' : '20px',
      paddingBottom: 0,
      minHeight: isMobile ? '52px' : '58px',
      height: isMobile ? 'calc(52px + env(safe-area-inset-top, 0px))' : '58px',
      background: '#0f1117', borderBottom: '1px solid #2d3148',
      zIndex: 1000, flexShrink: 0,
    },
    logo: { display: 'flex', alignItems: 'center', gap: '8px' },
    logoText: { fontSize: isMobile ? '15px' : '18px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.3px' },
    logoSub: { fontSize: '10px', color: '#64748b', marginTop: '-2px' },
    right: { display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px' },
    badge: {
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: isMobile ? '3px 8px' : '4px 12px',
      borderRadius: '20px', background: '#1e2130',
      border: '1px solid #2d3148', fontSize: '11px', color: '#94a3b8',
    },
    dot: { width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', flexShrink: 0 },
    username: { fontSize: '12px', color: '#94a3b8', maxWidth: isMobile ? '80px' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    btn: (variant) => ({
      padding: isMobile ? '5px 10px' : '6px 14px',
      borderRadius: '8px', fontSize: isMobile ? '12px' : '13px', fontWeight: 600,
      cursor: 'pointer', transition: 'all 0.15s',
      background: variant === 'primary' ? '#6366f1'
        : variant === 'admin' ? '#7c3aed'
        : 'transparent',
      color: variant === 'primary' || variant === 'admin' ? 'white' : '#94a3b8',
      border: (variant === 'danger' || variant === 'ghost') ? '1px solid #2d3148' : 'none',
    }),
  }

  return (
    <header style={s.header}>
      <div style={s.logo}>
        <span style={{ fontSize: isMobile ? '18px' : '22px' }}>📡</span>
        <div>
          <div style={s.logoText}>Sokak Radar</div>
          {!isMobile && <div style={s.logoSub}>Topluluk Uyarı Sistemi</div>}
        </div>
      </div>

      <div style={s.right}>
        {!isMobile && (
          <div style={s.badge}>
            <span style={s.dot} />
            {alerts.length} aktif uyarı
          </div>
        )}

        {user ? (
          <>
            {!isMobile && (
              <span style={s.username}>
                {profile?.username || user.email?.split('@')[0]}
              </span>
            )}
            {isAdmin() && (
              <button
                style={s.btn('admin')}
                onClick={onAdminClick}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                {isMobile ? '🛡️' : '🛡️ Admin'}
              </button>
            )}
            <button
              style={s.btn('danger')}
              onClick={signOut}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
            >
              {isMobile ? '⏻' : 'Çıkış'}
            </button>
          </>
        ) : (
          <button
            style={s.btn('primary')}
            onClick={onLoginClick}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            {isMobile ? 'Giriş' : 'Giriş Yap'}
          </button>
        )}
      </div>
    </header>
  )
}
