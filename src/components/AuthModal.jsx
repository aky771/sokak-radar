import React, { useState } from 'react'
import useAuthStore from '../store/useAuthStore'

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', zIndex: 4000, padding: '16px',
  },
  modal: {
    background: '#1e2130', border: '1px solid #2d3148', borderRadius: '16px',
    width: '100%', maxWidth: '420px', boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
    overflow: 'hidden',
  },
  header: { padding: '24px 24px 0', textAlign: 'center' },
  logo: { fontSize: '36px', marginBottom: '8px' },
  title: { fontSize: '20px', fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' },
  subtitle: { fontSize: '13px', color: '#64748b', marginBottom: '20px' },
  tabs: { display: 'flex', borderBottom: '1px solid #2d3148', margin: '0 24px' },
  tab: (active) => ({
    flex: 1, padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: 600,
    cursor: 'pointer', border: 'none', background: 'none',
    color: active ? '#6366f1' : '#64748b',
    borderBottom: active ? '2px solid #6366f1' : '2px solid transparent',
    transition: 'all 0.15s', touchAction: 'manipulation',
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
    padding: '10px 14px', fontSize: '13px', color: '#fca5a5', lineHeight: 1.5,
  },
  successBox: {
    background: '#064e3b22', border: '1px solid #10b98133', borderRadius: '8px',
    padding: '10px 14px', fontSize: '13px', color: '#6ee7b7', lineHeight: 1.5,
  },
  submitBtn: (loading) => ({
    padding: '12px', borderRadius: '10px', border: 'none',
    background: loading ? '#2d3148' : '#6366f1', color: loading ? '#64748b' : 'white',
    fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
    transition: 'background 0.15s', marginTop: '4px', touchAction: 'manipulation',
  }),
  divider: { display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' },
  dividerLine: { flex: 1, height: '1px', background: '#2d3148' },
  dividerText: { fontSize: '12px', color: '#475569' },
  guestBtn: {
    padding: '11px', borderRadius: '10px', border: '1px solid #2d3148',
    background: 'none', color: '#64748b', fontSize: '14px', fontWeight: 500,
    cursor: 'pointer', transition: 'all 0.15s', marginBottom: '4px',
    touchAction: 'manipulation',
  },
  footer: { padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: '8px' },
}

function friendlyError(msg) {
  if (!msg) return 'Bilinmeyen hata. Lütfen tekrar deneyin.'
  if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials'))
    return 'E-posta veya şifre hatalı.'
  if (msg.includes('User already registered') || msg.includes('already registered'))
    return 'Bu e-posta zaten kayıtlı. Giriş yapmayı deneyin.'
  if (msg.includes('Email not confirmed'))
    return 'E-postanızı doğrulamadan giriş yapamazsınız. Gelen kutunuzu kontrol edin.'
  if (msg.includes('Password should be at least'))
    return 'Şifre en az 6 karakter olmalı.'
  if (msg.includes('Unable to validate email'))
    return 'Geçersiz e-posta adresi.'
  if (msg.includes('Signups not allowed') || msg.includes('signup'))
    return 'Kayıt şu an kapalı. Lütfen daha sonra tekrar deneyin.'
  if (msg.includes('rate limit') || msg.includes('too many'))
    return 'Çok fazla deneme. Lütfen birkaç dakika bekleyin.'
  if (msg.includes('network') || msg.includes('fetch'))
    return 'Bağlantı hatası. İnternet bağlantınızı kontrol edin.'
  return msg
}

export default function AuthModal({ onClose, onSuccess, message }) {
  const [tab, setTab]           = useState('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')
  const [loading, setLoading]   = useState(false)

  const { signIn, signUp } = useAuthStore()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (tab === 'login') {
        const { user, error: err } = await signIn(email, password)
        if (err) {
          setError(friendlyError(err.message))
        } else if (user) {
          onSuccess?.()
          onClose()
        } else {
          setError('Giriş yapılamadı. Lütfen tekrar deneyin.')
        }
      } else {
        // Kayıt ol
        if (!username.trim()) { setError('Kullanıcı adı gerekli.'); setLoading(false); return }
        if (username.trim().length < 3) { setError('Kullanıcı adı en az 3 karakter olmalı.'); setLoading(false); return }
        if (password.length < 6) { setError('Şifre en az 6 karakter olmalı.'); setLoading(false); return }
        if (!email.includes('@')) { setError('Geçerli bir e-posta adresi girin.'); setLoading(false); return }

        const { user, session, error: err } = await signUp(email, password, username.trim())

        if (err) {
          setError(friendlyError(err.message))
        } else if (session) {
          // E-posta doğrulama kapalı → anında giriş yapıldı
          onSuccess?.()
          onClose()
        } else if (user) {
          if (user.identities?.length === 0) {
            // Supabase: e-posta zaten kayıtlı ama doğrulanmamış
            setError('Bu e-posta zaten kayıtlı. Giriş yapmayı ya da doğrulama e-postasını kontrol edin.')
          } else {
            // Normal kayıt — e-posta doğrulama gerekiyor
            setSuccess('✅ Kayıt başarılı! E-postanıza doğrulama bağlantısı gönderildi. Doğruladıktan sonra giriş yapabilirsiniz.')
            setTimeout(() => { setTab('login'); setSuccess(''); setEmail(''); setPassword('') }, 5000)
          }
        } else {
          // user null, error null → e-posta doğrulama gerekiyor (eski SDK davranışı)
          setSuccess('✅ Kayıt alındı! E-postanızı kontrol edin ve doğrulama bağlantısına tıklayın.')
          setTimeout(() => { setTab('login'); setSuccess('') }, 5000)
        }
      }
    } catch (unexpected) {
      setError('Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.')
    }

    setLoading(false)
  }

  const switchTab = (t) => { setTab(t); setError(''); setSuccess('') }
  const focusStyle = (e) => (e.target.style.borderColor = '#6366f1')
  const blurStyle  = (e) => (e.target.style.borderColor = '#2d3148')

  return (
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <div style={s.logo}>📡</div>
          <div style={s.title}>Sokak Radar</div>
          <div style={s.subtitle}>{message || 'Uyarı eklemek için giriş yapın'}</div>
        </div>

        <div style={s.tabs}>
          <button style={s.tab(tab === 'login')} onClick={() => switchTab('login')}>Giriş Yap</button>
          <button style={s.tab(tab === 'register')} onClick={() => switchTab('register')}>Kayıt Ol</button>
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

            {error   && <div style={s.errorBox}>⚠️ {error}</div>}
            {success && <div style={s.successBox}>{success}</div>}

            <button style={s.submitBtn(loading)} type="submit" disabled={loading}>
              {loading
                ? 'Lütfen bekleyin...'
                : tab === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
            </button>
          </div>
        </form>

        <div style={s.footer}>
          <div style={s.divider}>
            <div style={s.dividerLine} />
            <span style={s.dividerText}>veya</span>
            <div style={s.dividerLine} />
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
