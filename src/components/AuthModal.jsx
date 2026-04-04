import React, { useState } from 'react'
import useAuthStore from '../store/useAuthStore'

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', zIndex: 4000, padding: '16px',
  },
  modal: {
    background: '#1e2130', border: '1px solid #2d3148', borderRadius: '16px',
    width: '100%', maxWidth: '420px', boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
    overflow: 'hidden',
  },
  header: {
    padding: '24px 24px 0', textAlign: 'center',
  },
  logo: { fontSize: '36px', marginBottom: '8px' },
  title: { fontSize: '20px', fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' },
  subtitle: { fontSize: '13px', color: '#64748b', marginBottom: '20px' },
  tabs: {
    display: 'flex', borderBottom: '1px solid #2d3148', margin: '0 24px',
  },
  tab: (active) => ({
    flex: 1, padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: 600,
    cursor: 'pointer', border: 'none', background: 'none',
    color: active ? '#6366f1' : '#64748b',
    borderBottom: active ? '2px solid #6366f1' : '2px solid transparent',
    transition: 'all 0.15s',
  }),
  body: { padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' },
  label: { fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' },
  input: {
    width: '100%', background: '#252836', border: '1px solid #2d3148',
    borderRadius: '8px', padding: '11px 14px', color: '#e2e8f0', fontSize: '14px',
    outline: 'none', transition: 'border-color 0.15s',
  },
  errorBox: {
    background: '#7f1d1d22', border: '1px solid #ef444433', borderRadius: '8px',
    padding: '10px 14px', fontSize: '13px', color: '#fca5a5',
  },
  successBox: {
    background: '#064e3b22', border: '1px solid #10b98133', borderRadius: '8px',
    padding: '10px 14px', fontSize: '13px', color: '#6ee7b7',
  },
  submitBtn: (loading) => ({
    padding: '12px', borderRadius: '10px', border: 'none',
    background: loading ? '#2d3148' : '#6366f1', color: loading ? '#64748b' : 'white',
    fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
    transition: 'background 0.15s', marginTop: '4px',
  }),
  divider: {
    display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0',
  },
  dividerLine: { flex: 1, height: '1px', background: '#2d3148' },
  dividerText: { fontSize: '12px', color: '#475569' },
  guestBtn: {
    padding: '11px', borderRadius: '10px', border: '1px solid #2d3148',
    background: 'none', color: '#64748b', fontSize: '14px', fontWeight: 500,
    cursor: 'pointer', transition: 'all 0.15s', marginBottom: '4px',
  },
  footer: { padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: '8px' },
}

export default function AuthModal({ onClose, onSuccess, message }) {
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const { signIn, signUp } = useAuthStore()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    if (tab === 'login') {
      const { user, error: err } = await signIn(email, password)
      if (err) {
        setError(err.message === 'Invalid login credentials'
          ? 'E-posta veya şifre hatalı.'
          : err.message)
      } else if (user) {
        onSuccess?.()
        onClose()
      }
    } else {
      if (!username.trim()) { setError('Kullanıcı adı gerekli.'); setLoading(false); return }
      if (password.length < 6) { setError('Şifre en az 6 karakter olmalı.'); setLoading(false); return }
      const { user, error: err } = await signUp(email, password, username.trim())
      if (err) {
        setError(err.message === 'User already registered'
          ? 'Bu e-posta zaten kayıtlı.'
          : err.message)
      } else if (user) {
        if (user.identities?.length === 0) {
          setError('Bu e-posta zaten kayıtlı.')
        } else {
          setSuccess('Kayıt başarılı! E-postanızı doğruladıktan sonra giriş yapabilirsiniz.')
          setTimeout(() => { setTab('login'); setSuccess('') }, 3000)
        }
      }
    }
    setLoading(false)
  }

  const focusStyle = (e) => (e.target.style.borderColor = '#6366f1')
  const blurStyle  = (e) => (e.target.style.borderColor = '#2d3148')

  return (
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <div style={s.logo}>📡</div>
          <div style={s.title}>Sokak Radar</div>
          <div style={s.subtitle}>
            {message || 'Uyarı eklemek için giriş yapın'}
          </div>
        </div>

        <div style={s.tabs}>
          <button style={s.tab(tab === 'login')} onClick={() => { setTab('login'); setError(''); setSuccess('') }}>
            Giriş Yap
          </button>
          <button style={s.tab(tab === 'register')} onClick={() => { setTab('register'); setError(''); setSuccess('') }}>
            Kayıt Ol
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={s.body}>
            {tab === 'register' && (
              <div>
                <div style={s.label}>KULLANICI ADI</div>
                <input
                  style={s.input} type="text" placeholder="sokak_kahraman"
                  value={username} onChange={(e) => setUsername(e.target.value)}
                  onFocus={focusStyle} onBlur={blurStyle} autoComplete="username"
                />
              </div>
            )}
            <div>
              <div style={s.label}>E-POSTA</div>
              <input
                style={s.input} type="email" placeholder="ornek@email.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                onFocus={focusStyle} onBlur={blurStyle} autoComplete="email"
              />
            </div>
            <div>
              <div style={s.label}>ŞİFRE</div>
              <input
                style={s.input} type="password" placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)}
                onFocus={focusStyle} onBlur={blurStyle}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
            {error && <div style={s.errorBox}>⚠️ {error}</div>}
            {success && <div style={s.successBox}>✅ {success}</div>}
            <button style={s.submitBtn(loading)} type="submit" disabled={loading}>
              {loading ? 'Lütfen bekleyin...' : tab === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
            </button>
          </div>
        </form>

        <div style={s.footer}>
          <div style={s.divider}>
            <div style={s.dividerLine} /><span style={s.dividerText}>veya</span><div style={s.dividerLine} />
          </div>
          <button
            style={s.guestBtn}
            onClick={onClose}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#252836'; e.currentTarget.style.color = '#94a3b8' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#64748b' }}
          >
            👁️ Misafir olarak devam et
          </button>
        </div>
      </div>
    </div>
  )
}
