import React, { useState, useRef } from 'react'
import { ALERT_TYPES } from '../store/useAlertStore'

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3000,
    padding: '16px',
  },
  modal: {
    background: '#1e2130',
    border: '1px solid #2d3148',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '480px',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px 16px',
    borderBottom: '1px solid #2d3148',
  },
  title: {
    fontSize: '17px',
    fontWeight: 700,
    color: '#e2e8f0',
  },
  subtitle: {
    fontSize: '12px',
    color: '#64748b',
    marginTop: '2px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    fontSize: '24px',
    lineHeight: 1,
    padding: '4px',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  body: {
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#94a3b8',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    marginBottom: '8px',
  },
  typeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
  },
  typeBtn: (selected, color) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '10px 6px',
    borderRadius: '10px',
    border: selected ? `2px solid ${color}` : '2px solid #2d3148',
    background: selected ? `${color}22` : '#252836',
    cursor: 'pointer',
    transition: 'all 0.15s',
    color: '#e2e8f0',
  }),
  typeEmoji: {
    fontSize: '22px',
  },
  typeLabel: {
    fontSize: '10px',
    fontWeight: 500,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 1.2,
  },
  textarea: {
    width: '100%',
    background: '#252836',
    border: '1px solid #2d3148',
    borderRadius: '10px',
    padding: '12px',
    color: '#e2e8f0',
    fontSize: '14px',
    resize: 'vertical',
    minHeight: '80px',
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  coords: {
    display: 'flex',
    gap: '8px',
  },
  coordBox: {
    flex: 1,
    background: '#252836',
    border: '1px solid #2d3148',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '12px',
    color: '#94a3b8',
  },
  coordLabel: {
    fontSize: '10px',
    color: '#64748b',
    marginBottom: '2px',
  },
  coordValue: {
    color: '#6366f1',
    fontWeight: 600,
    fontFamily: 'monospace',
  },
  photoArea: {
    border: '2px dashed #2d3148',
    borderRadius: '10px',
    padding: '20px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s',
    background: '#252836',
  },
  photoPreview: {
    width: '100%',
    borderRadius: '8px',
    maxHeight: '160px',
    objectFit: 'cover',
  },
  footer: {
    display: 'flex',
    gap: '10px',
    padding: '16px 24px 20px',
    borderTop: '1px solid #2d3148',
  },
  cancelBtn: {
    flex: 1,
    padding: '11px',
    borderRadius: '10px',
    border: '1px solid #2d3148',
    background: 'none',
    color: '#94a3b8',
    fontSize: '14px',
    fontWeight: 600,
  },
  submitBtn: (disabled) => ({
    flex: 2,
    padding: '11px',
    borderRadius: '10px',
    border: 'none',
    background: disabled ? '#2d3148' : '#6366f1',
    color: disabled ? '#64748b' : 'white',
    fontSize: '14px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background 0.15s',
  }),
}

export default function AddAlertModal({ position, onClose, onAdd, userLocation }) {
  const [type, setType] = useState('traffic')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState(null)
  const [useGPS, setUseGPS] = useState(false)
  const fileRef = useRef()

  const effectivePos = useGPS && userLocation ? userLocation : position

  const handlePhoto = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      alert('Fotoğraf 5MB\'dan büyük olamaz.')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      // Compress image
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxW = 800
        const scale = Math.min(1, maxW / img.width)
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        setPhoto(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = () => {
    if (!effectivePos) return
    onAdd({
      type,
      description: description.trim(),
      photo,   // base64, store handles upload
      lat: effectivePos.lat,
      lng: effectivePos.lng,
    })
    onClose()
  }

  const locLabel = effectivePos
    ? `${effectivePos.lat.toFixed(5)}, ${effectivePos.lng.toFixed(5)}`
    : '—'

  return (
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <div>
            <div style={s.title}>Yeni Uyarı Ekle</div>
            <div style={s.subtitle}>
              {position ? 'Haritaya tıklanan nokta' : 'Konum seçilmedi'}
            </div>
          </div>
          <button style={s.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={s.body}>
          {/* Type selection */}
          <div>
            <div style={s.label}>Uyarı Tipi</div>
            <div style={s.typeGrid}>
              {Object.entries(ALERT_TYPES).map(([key, info]) => (
                <button
                  key={key}
                  style={s.typeBtn(type === key, info.color)}
                  onClick={() => setType(key)}
                >
                  <span style={s.typeEmoji}>{info.emoji}</span>
                  <span style={s.typeLabel}>{info.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <div style={s.label}>Açıklama (isteğe bağlı)</div>
            <textarea
              style={s.textarea}
              placeholder="Ne gördünüz? Detay ekleyin..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
              onBlur={(e) => (e.target.style.borderColor = '#2d3148')}
            />
          </div>

          {/* GPS toggle */}
          {userLocation && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <div
                style={{
                  width: '40px',
                  height: '22px',
                  borderRadius: '11px',
                  background: useGPS ? '#6366f1' : '#2d3148',
                  position: 'relative',
                  transition: 'background 0.2s',
                  flexShrink: 0,
                }}
                onClick={() => setUseGPS(!useGPS)}
              >
                <div style={{
                  position: 'absolute',
                  top: '3px',
                  left: useGPS ? '21px' : '3px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: 'white',
                  transition: 'left 0.2s',
                }} />
              </div>
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                GPS konumumu kullan
              </span>
            </label>
          )}

          {/* Coordinates */}
          <div>
            <div style={s.label}>Konum</div>
            <div style={s.coords}>
              <div style={s.coordBox}>
                <div style={s.coordLabel}>Enlem</div>
                <div style={s.coordValue}>
                  {effectivePos ? effectivePos.lat.toFixed(5) : '—'}
                </div>
              </div>
              <div style={s.coordBox}>
                <div style={s.coordLabel}>Boylam</div>
                <div style={s.coordValue}>
                  {effectivePos ? effectivePos.lng.toFixed(5) : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Photo */}
          <div>
            <div style={s.label}>Fotoğraf (isteğe bağlı)</div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handlePhoto}
            />
            {photo ? (
              <div style={{ position: 'relative' }}>
                <img src={photo} alt="preview" style={s.photoPreview} />
                <button
                  onClick={() => setPhoto(null)}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'rgba(0,0,0,0.7)',
                    border: 'none',
                    color: 'white',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ×
                </button>
              </div>
            ) : (
              <div
                style={s.photoArea}
                onClick={() => fileRef.current.click()}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2d3148')}
              >
                <div style={{ fontSize: '28px', marginBottom: '6px' }}>📷</div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>
                  Fotoğraf eklemek için tıklayın
                </div>
                <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
                  Maks. 5MB · JPG, PNG
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={s.footer}>
          <button style={s.cancelBtn} onClick={onClose}>İptal</button>
          <button
            style={s.submitBtn(!effectivePos)}
            onClick={handleSubmit}
            disabled={!effectivePos}
          >
            {ALERT_TYPES[type].emoji} Uyarı Yayınla
          </button>
        </div>
      </div>
    </div>
  )
}
