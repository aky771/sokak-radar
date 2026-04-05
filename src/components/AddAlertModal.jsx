import React, { useState, useRef, useEffect } from 'react'
import { ALERT_TYPES } from '../store/useAlertStore'
import useIsMobile from '../hooks/useIsMobile'
import { reverseGeocode } from '../utils/geocode'

// Harita bu zoom seviyesinden küçükse uyarı veriyoruz
const MIN_ZOOM_FOR_ALERT = 13

export default function AddAlertModal({ position, onClose, onAdd, userLocation, currentZoom }) {
  const isMobile = useIsMobile()
  const [type, setType]               = useState('traffic')
  const [description, setDescription] = useState('')
  const [photo, setPhoto]             = useState(null)
  const [useGPS, setUseGPS]           = useState(false)
  const [address, setAddress]         = useState(null)
  const [addrLoading, setAddrLoading] = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const fileRef = useRef()

  const effectivePos = useGPS && userLocation ? userLocation : position

  // Konum değişince adresi çek
  useEffect(() => {
    if (!effectivePos) return
    setAddrLoading(true)
    reverseGeocode(effectivePos.lat, effectivePos.lng).then((a) => {
      setAddress(a)
      setAddrLoading(false)
    })
  }, [effectivePos?.lat, effectivePos?.lng])

  const zoomTooLow = currentZoom != null && currentZoom < MIN_ZOOM_FOR_ALERT

  const handlePhoto = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('Fotoğraf 5MB\'dan büyük olamaz.'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxW = 800, scale = Math.min(1, maxW / img.width)
        canvas.width = img.width * scale; canvas.height = img.height * scale
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        setPhoto(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    if (!effectivePos || zoomTooLow || submitting) return
    setSubmitting(true)
    await onAdd({
      type,
      description: description.trim(),
      photo,
      lat: effectivePos.lat,
      lng: effectivePos.lng,
    })
    setSubmitting(false)
    onClose()
  }

  const canSubmit = !!effectivePos && !zoomTooLow && !submitting

  const s = {
    overlay: {
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: isMobile ? 'flex-end' : 'center',
      justifyContent: 'center',
      zIndex: 3000,
      padding: isMobile ? '0' : '16px',
    },
    modal: {
      background: '#1e2130', border: '1px solid #2d3148',
      borderRadius: isMobile ? '20px 20px 0 0' : '16px',
      width: '100%', maxWidth: isMobile ? '100%' : '480px',
      maxHeight: isMobile ? '92dvh' : '90dvh',
      overflow: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
      paddingBottom: isMobile ? 'env(safe-area-inset-bottom, 0px)' : '0',
    },
    label: {
      fontSize: '11px', fontWeight: 600, color: '#94a3b8',
      letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px',
    },
    typeBtn: (selected, color) => ({
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
      padding: isMobile ? '8px 4px' : '10px 6px', borderRadius: '10px',
      border: selected ? `2px solid ${color}` : '2px solid #2d3148',
      background: selected ? `${color}22` : '#252836',
      cursor: 'pointer', transition: 'all 0.15s', color: '#e2e8f0',
    }),
    textarea: {
      width: '100%', background: '#252836', border: '1px solid #2d3148',
      borderRadius: '10px', padding: '10px 12px', color: '#e2e8f0',
      fontSize: '14px', resize: 'vertical', minHeight: isMobile ? '60px' : '76px',
      outline: 'none', transition: 'border-color 0.15s', boxSizing: 'border-box',
    },
  }

  return (
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        {isMobile && (
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#3d4460', margin: '12px auto 0' }} />
        )}

        {/* Başlık */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isMobile ? '12px 16px' : '18px 24px 14px',
          borderBottom: '1px solid #2d3148',
        }}>
          <div>
            <div style={{ fontSize: isMobile ? 15 : 17, fontWeight: 700, color: '#f1f5f9' }}>
              Yeni Uyarı Ekle
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              {position ? 'Haritaya tıklanan nokta' : 'Konum seçilmedi'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 24, lineHeight: 1, padding: '4px 8px', borderRadius: 6, cursor: 'pointer' }}
          >×</button>
        </div>

        <div style={{ padding: isMobile ? '14px 16px' : '18px 24px', display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 18 }}>

          {/* Zoom uyarısı */}
          {zoomTooLow && (
            <div style={{
              background: '#78350f22', border: '1px solid #f59e0b55',
              borderRadius: 10, padding: '12px 14px',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>🔍</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>
                  Haritayı yakınlaştırın
                </div>
                <div style={{ fontSize: 12, color: '#fbbf2488', marginTop: 3 }}>
                  Konumu daha kesin belirtmek için haritayı biraz yakınlaştırıp tekrar tıklayın.
                </div>
              </div>
            </div>
          )}

          {/* Konum & adres onay kutusu */}
          <div>
            <div style={s.label}>Seçilen Konum</div>
            <div style={{
              background: '#252836', border: '1px solid #2d3148',
              borderRadius: 10, padding: '10px 14px',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>📍</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {addrLoading ? (
                  <div style={{ fontSize: 13, color: '#475569' }}>Adres alınıyor…</div>
                ) : address ? (
                  <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600, lineHeight: 1.4 }}>{address}</div>
                ) : effectivePos ? (
                  <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>
                    {effectivePos.lat.toFixed(5)}, {effectivePos.lng.toFixed(5)}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: '#475569' }}>Konum seçilmedi</div>
                )}
                {effectivePos && address && (
                  <div style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', marginTop: 3 }}>
                    {effectivePos.lat.toFixed(5)}, {effectivePos.lng.toFixed(5)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* GPS toggle */}
          {userLocation && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <div
                style={{
                  width: 40, height: 22, borderRadius: 11,
                  background: useGPS ? '#6366f1' : '#2d3148',
                  position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                }}
                onClick={() => setUseGPS(!useGPS)}
              >
                <div style={{
                  position: 'absolute', top: 3, left: useGPS ? 21 : 3,
                  width: 16, height: 16, borderRadius: '50%',
                  background: 'white', transition: 'left 0.2s',
                }} />
              </div>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>GPS konumumu kullan</span>
            </label>
          )}

          {/* Uyarı Tipi */}
          <div>
            <div style={s.label}>Uyarı Tipi</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: isMobile ? 6 : 8 }}>
              {Object.entries(ALERT_TYPES).map(([key, info]) => (
                <button key={key} style={s.typeBtn(type === key, info.color)} onClick={() => setType(key)}>
                  <span style={{ fontSize: isMobile ? 20 : 22, lineHeight: 1 }}>{info.emoji}</span>
                  <span style={{ fontSize: 10, fontWeight: 500, color: '#94a3b8', textAlign: 'center', lineHeight: 1.2 }}>{info.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Açıklama */}
          <div>
            <div style={s.label}>Açıklama (isteğe bağlı)</div>
            <textarea
              style={s.textarea}
              placeholder="Ne gördünüz? Kısa detay ekleyin…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
              onBlur={(e) => (e.target.style.borderColor = '#2d3148')}
            />
          </div>

          {/* Fotoğraf */}
          <div>
            <div style={s.label}>Fotoğraf (isteğe bağlı)</div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePhoto} />
            {photo ? (
              <div style={{ position: 'relative' }}>
                <img src={photo} alt="preview" style={{ width: '100%', borderRadius: 8, maxHeight: 140, objectFit: 'cover', display: 'block' }} />
                <button
                  onClick={() => setPhoto(null)}
                  style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', border: 'none', color: 'white', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >×</button>
              </div>
            ) : (
              <div
                onClick={() => fileRef.current.click()}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2d3148')}
                style={{
                  border: '2px dashed #2d3148', borderRadius: 10,
                  padding: isMobile ? '14px' : '18px', textAlign: 'center',
                  cursor: 'pointer', transition: 'all 0.15s', background: '#252836',
                }}
              >
                <div style={{ fontSize: 26, marginBottom: 4 }}>📷</div>
                <div style={{ fontSize: 13, color: '#64748b' }}>Fotoğraf eklemek için dokunun</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>Maks. 5MB · JPG, PNG</div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 10,
          padding: isMobile ? '12px 16px 16px' : '14px 24px 20px',
          borderTop: '1px solid #2d3148',
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: 12, borderRadius: 10,
              border: '1px solid #2d3148', background: 'none',
              color: '#94a3b8', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >İptal</button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              flex: 2, padding: 12, borderRadius: 10, border: 'none',
              background: canSubmit ? '#6366f1' : '#2d3148',
              color: canSubmit ? 'white' : '#64748b',
              fontSize: 14, fontWeight: 600,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            {submitting ? (
              <>
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #ffffff44', borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }} />
                Yayınlanıyor…
              </>
            ) : (
              <>{ALERT_TYPES[type].emoji} Uyarı Yayınla</>
            )}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
