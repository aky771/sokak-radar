import React, { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, ZoomControl } from 'react-leaflet'
import L from 'leaflet'
import useAlertStore, { ALERT_TYPES } from '../store/useAlertStore'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function makeAlertIcon(info) {
  return L.divIcon({
    className: '',
    html: `<div class="alert-marker alert-marker-pulse"
      style="background:${info.bg};color:${info.color};border-color:${info.color}">
      <span style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))">${info.emoji}</span>
    </div>`,
    iconSize: [42, 42], iconAnchor: [21, 21], popupAnchor: [0, -24],
  })
}

const gpsIcon = L.divIcon({
  className: '',
  html: `<div class="user-location-marker"></div>`,
  iconSize: [20, 20], iconAnchor: [10, 10],
})

const manualIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:28px;height:28px;border-radius:50%;
    background:#6366f1;border:3px solid white;
    box-shadow:0 0 0 4px rgba(99,102,241,.35),0 3px 8px rgba(0,0,0,.4);
    display:flex;align-items:center;justify-content:center;
    font-size:14px;cursor:pointer;
  ">📌</div>`,
  iconSize: [28, 28], iconAnchor: [14, 14],
})

function timeAgo(iso) {
  if (!iso) return ''
  const d = (Date.now() - new Date(iso)) / 1000
  if (d < 60) return 'Az önce'
  if (d < 3600) return `${Math.floor(d / 60)} dk önce`
  if (d < 86400) return `${Math.floor(d / 3600)} sa önce`
  return `${Math.floor(d / 86400)} gün önce`
}

function MapClickHandler({ onMapClick, onRightClick }) {
  useMapEvents({
    click:       (e) => onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng }),
    contextmenu: (e) => onRightClick && onRightClick({ lat: e.latlng.lat, lng: e.latlng.lng }),
  })
  return null
}

function MapFlyTo({ target }) {
  const map = useMapEvents({})
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 15), { animate: true, duration: 1 })
    }
  }, [target, map])
  return null
}

function AlertPopupContent({ alert, info, onVote }) {
  const expiresIn = Math.max(0, Math.floor((new Date(alert.expires_at) - Date.now()) / 3600000))
  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", minWidth: '220px', maxWidth: '280px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '12px 14px 10px',
        borderBottom: (alert.photo_url || alert.description) ? '1px solid #2d3148' : 'none',
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '3px 10px', borderRadius: '6px', background: info.bg,
          color: info.color, fontSize: '12px', fontWeight: 700,
        }}>
          {info.emoji} {info.label}
        </span>
        <span style={{ fontSize: '11px', color: '#64748b', marginLeft: 'auto' }}>
          {timeAgo(alert.created_at)}
        </span>
      </div>

      {alert.photo_url && (
        <img src={alert.photo_url} alt="uyarı"
          style={{ width: '100%', maxHeight: '140px', objectFit: 'cover', display: 'block' }} />
      )}

      {alert.description && (
        <p style={{
          margin: 0, padding: '10px 14px',
          fontSize: '13px', color: '#cbd5e1', lineHeight: 1.55,
          borderBottom: '1px solid #2d3148',
        }}>
          {alert.description}
        </p>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', gap: '8px',
      }}>
        <div>
          {alert.username && (
            <div style={{ fontSize: '11px', color: '#475569', marginBottom: '2px' }}>
              👤 {alert.username}
            </div>
          )}
          <div style={{ fontSize: '10px', color: '#334155', fontFamily: 'monospace' }}>
            {alert.lat?.toFixed(4)}, {alert.lng?.toFixed(4)}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '10px', color: '#475569' }}>⏱ {expiresIn}s</span>
          <button onClick={onVote} style={{
            background: '#252836', border: '1px solid #2d3148', borderRadius: '6px',
            padding: '4px 10px', fontSize: '12px', color: '#94a3b8',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            👍 {alert.votes}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MapView({
  onMapClick, onRightClick, flyTarget,
  gpsLocation, manualLocation, setManualLocation, initialCenter, isMobile,
}) {
  const alerts    = useAlertStore((st) => st.alerts)
  const voteAlert = useAlertStore((st) => st.voteAlert)

  const defaultCenter = initialCenter
    ? [initialCenter.lat, initialCenter.lng]
    : [39.1667, 35.6667]   // Türkiye ortası — IP gel gelene
  const defaultZoom = initialCenter ? 12 : 6

  return (
    <MapContainer
      center={defaultCenter}
      zoom={defaultZoom}
      style={{ flex: 1, height: '100%', cursor: 'crosshair' }}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        maxZoom={20}
      />
      <ZoomControl position={isMobile ? 'topright' : 'bottomright'} />
      <MapClickHandler onMapClick={onMapClick} onRightClick={onRightClick} />
      {flyTarget && <MapFlyTo target={flyTarget} />}

      {/* Doğrulanmış GPS marker (<500m doğruluk) */}
      {gpsLocation && (
        <Marker position={[gpsLocation.lat, gpsLocation.lng]} icon={gpsIcon}>
          <Popup maxWidth={220}>
            <div style={{ padding: '12px 14px', fontFamily: 'system-ui, sans-serif' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#10b981', marginBottom: '6px' }}>
                📍 GPS Konumunuz
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace', marginBottom: '6px' }}>
                {gpsLocation.lat.toFixed(6)}<br />{gpsLocation.lng.toFixed(6)}
              </div>
              <div style={{
                fontSize: '11px', padding: '3px 8px', borderRadius: '5px', display: 'inline-block',
                background: gpsLocation.accuracy < 50 ? '#064e3b' : '#78350f',
                color: gpsLocation.accuracy < 50 ? '#6ee7b7' : '#fcd34d',
              }}>
                ±{gpsLocation.accuracy}m — {gpsLocation.accuracy < 50 ? 'Mükemmel' : 'İyi'}
              </div>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Manuel konum marker */}
      {manualLocation && (
        <Marker
          position={[manualLocation.lat, manualLocation.lng]}
          icon={manualIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const { lat, lng } = e.target.getLatLng()
              setManualLocation({ lat, lng, source: 'manual' })
            },
          }}
        >
          <Popup maxWidth={220}>
            <div style={{ padding: '12px 14px', fontFamily: 'system-ui, sans-serif' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#818cf8', marginBottom: '6px' }}>
                📌 Manuel Konumunuz
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace', marginBottom: '8px' }}>
                {manualLocation.lat.toFixed(6)}<br />{manualLocation.lng.toFixed(6)}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                Markeri sürükleyerek konumunuzu güncelleyebilirsiniz.
              </div>
              <button
                onClick={() => setManualLocation(null)}
                style={{
                  fontSize: '11px', padding: '4px 10px', borderRadius: '5px',
                  border: '1px solid #ef444433', background: '#7f1d1d22', color: '#fca5a5',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Kaldır
              </button>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Uyarı markerları */}
      {alerts.map((alert) => {
        const info = ALERT_TYPES[alert.type] || ALERT_TYPES.spotted
        return (
          <Marker key={alert.id} position={[alert.lat, alert.lng]} icon={makeAlertIcon(info)}>
            <Popup maxWidth={300}>
              <AlertPopupContent alert={alert} info={info} onVote={() => voteAlert(alert.id)} />
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
