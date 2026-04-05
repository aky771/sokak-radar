import React, { useState, useRef, useEffect, useCallback } from 'react'

// Nominatim forward geocoding (adres → koordinat)
async function searchPlace(query) {
  if (!query || query.trim().length < 2) return []
  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(query.trim())}` +
      `&format=json&addressdetails=1&limit=5&accept-language=tr&countrycodes=tr`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SokakRadar/1.0 (community-alert-app)' },
    })
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

function formatResult(r) {
  const a = r.address || {}
  const parts = [
    a.road || a.pedestrian || a.neighbourhood || a.suburb,
    a.city_district || a.district || a.town || a.city || a.county,
    a.state,
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : r.display_name?.split(',').slice(0, 3).join(', ')
}

export default function MapSearch({ onSelect, isMobile }) {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [open, setOpen]         = useState(false)
  const debounceRef             = useRef(null)
  const containerRef            = useRef(null)
  const inputRef                = useRef(null)

  // Dışarı tıklayınca kapat
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [])

  const handleChange = useCallback((e) => {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounceRef.current)
    if (val.trim().length < 2) { setResults([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const res = await searchPlace(val)
      setResults(res)
      setOpen(res.length > 0)
      setLoading(false)
    }, 500)
  }, [])

  const handleSelect = (r) => {
    setQuery(formatResult(r))
    setResults([])
    setOpen(false)
    onSelect({ lat: parseFloat(r.lat), lng: parseFloat(r.lon), label: formatResult(r) })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
    if (e.key === 'Enter' && results.length > 0) handleSelect(results[0])
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: isMobile ? 10 : 14,
        left: isMobile ? 10 : 60,
        right: isMobile ? 10 : 'auto',
        width: isMobile ? 'auto' : 280,
        zIndex: 900,
      }}
    >
      {/* Input */}
      <div style={{
        display: 'flex', alignItems: 'center',
        background: '#1e2130ee',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid #2d3148',
        borderRadius: open && results.length ? '10px 10px 0 0' : 10,
        padding: '0 10px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        transition: 'border-radius 0.15s',
      }}>
        <span style={{ fontSize: 14, marginRight: 6, opacity: 0.5 }}>🔍</span>
        <input
          ref={inputRef}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Konum ara… (İstanbul, Fatih…)"
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: '#e2e8f0', fontSize: 13, padding: '9px 0',
            fontFamily: 'inherit',
          }}
        />
        {loading && (
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            border: '2px solid #6366f133', borderTopColor: '#6366f1',
            animation: 'spin 0.7s linear infinite', flexShrink: 0,
          }} />
        )}
        {query && !loading && (
          <button
            onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
            style={{ background: 'none', border: 'none', color: '#475569', fontSize: 16, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
          >×</button>
        )}
      </div>

      {/* Sonuçlar */}
      {open && results.length > 0 && (
        <div style={{
          background: '#1e2130',
          border: '1px solid #2d3148', borderTop: 'none',
          borderRadius: '0 0 10px 10px',
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          maxHeight: 220, overflowY: 'auto',
        }}>
          {results.map((r, i) => (
            <div
              key={r.place_id || i}
              onMouseDown={() => handleSelect(r)}
              style={{
                padding: '9px 12px', cursor: 'pointer', fontSize: 12,
                borderBottom: i < results.length - 1 ? '1px solid #1a1d27' : 'none',
                display: 'flex', alignItems: 'flex-start', gap: 8,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#252836')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>📍</span>
              <div>
                <div style={{ color: '#e2e8f0', fontWeight: 600, lineHeight: 1.3 }}>
                  {formatResult(r)}
                </div>
                <div style={{ color: '#475569', fontSize: 10, marginTop: 2, lineHeight: 1.3 }}>
                  {r.display_name?.split(',').slice(-2).join(',').trim()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
