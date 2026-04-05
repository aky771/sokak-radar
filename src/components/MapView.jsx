import React, { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, ZoomControl, useMap } from 'react-leaflet'
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
    if (!target) return
    try {
      map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 15), { animate: true, duration: 1 })
    } catch (_) {}
  }, [target]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

// Harita container boyutu değişince (sidebar aç/kapat, ekran döndürme) tile'ları düzelt
function MapResizeHandler({ sidebarOpen }) {
  const map = useMap()
  useMapEvents({
    resize: () => { setTimeout(() => map.invalidateSize(), 50) },
  })
  // Sidebar genişliği değişince de invalidate et
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 300)
    return () => clearTimeout(t)
  }, [sidebarOpen, map])
  return null
}


export default function MapView({
  onMapClick, onRightClick, flyTarget,
  gpsLocation, manualLocation, setManualLocation, initialCenter, isMobile,
  onAlertDetail, sidebarOpen,
}) {
  const alerts = useAlertStore((st) => st.alerts)

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
        keepBuffer={4}
        updateWhenIdle={false}
        updateWhenZooming={false}
      />
      <ZoomControl position={isMobile ? 'topright' : 'bottomright'} />
      <MapClickHandler onMapClick={onMapClick} onRightClick={onRightClick} />
      <MapResizeHandler sidebarOpen={sidebarOpen} />
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

      {/* Uyarı markerları — tıklanınca detay modalı açılır, map click tetiklenmez */}
      {alerts.map((alert) => {
        const info = ALERT_TYPES[alert.type] || ALERT_TYPES.spotted
        return (
          <Marker
            key={alert.id}
            position={[alert.lat, alert.lng]}
            icon={makeAlertIcon(info)}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e)
                onAlertDetail && onAlertDetail(alert)
              },
            }}
          />
        )
      })}
    </MapContainer>
  )
}
