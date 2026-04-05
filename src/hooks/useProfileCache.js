import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Basit bellek içi profil cache — kullanıcı başına bir kez çeker
const cache = {}
const listeners = {}

/** Çıkış yapılınca tüm cache ve listener'ları temizle */
export function clearProfileCache() {
  Object.keys(cache).forEach((k) => delete cache[k])
  Object.keys(listeners).forEach((k) => delete listeners[k])
}

function notify(userId) {
  ;(listeners[userId] || []).forEach((fn) => fn(cache[userId]))
}

async function loadProfile(userId) {
  if (cache[userId] !== undefined) return
  cache[userId] = null // çekiliyor işareti
  const { data } = await supabase
    .from('profiles')
    .select('id, username, avatar_color, display_name')
    .eq('id', userId)
    .maybeSingle()
  cache[userId] = data || null
  notify(userId)
}

/**
 * Verilen userId için profil döndürür.
 * Cache'deyse anında, yoksa arka planda çeker.
 */
export default function useProfileCache(userId) {
  const [profile, setProfile] = useState(() => cache[userId] ?? null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    if (!userId) return

    // Cache'de varsa hemen güncelle
    if (cache[userId] !== undefined && cache[userId] !== null) {
      setProfile(cache[userId])
      return
    }

    // Listener ekle
    const handler = (p) => { if (mounted.current) setProfile(p) }
    if (!listeners[userId]) listeners[userId] = []
    listeners[userId].push(handler)

    // Çek
    loadProfile(userId)

    return () => {
      mounted.current = false
      if (listeners[userId]) {
        listeners[userId] = listeners[userId].filter((f) => f !== handler)
      }
    }
  }, [userId])

  return profile
}
