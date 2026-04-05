import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { reverseGeocode } from '../utils/geocode'

export const ALERT_TYPES = {
  accident: { label: 'Kaza',          emoji: '🚨', color: '#ef4444', bg: '#7f1d1d22' },
  hazard:   { label: 'Tehlike',       emoji: '⚠️', color: '#f97316', bg: '#7c2d1222' },
  police:   { label: 'Polis',         emoji: '🚔', color: '#3b82f6', bg: '#1e3a5f22' },
  roadwork: { label: 'Yol Çalışması', emoji: '🚧', color: '#a855f7', bg: '#4a1d9622' },
  closure:  { label: 'Yol Kapanışı',  emoji: '🚫', color: '#6b7280', bg: '#1f293722' },
  spotted:  { label: 'Görüldü',       emoji: '👁️', color: '#10b981', bg: '#064e3b22' },
}

const LEGACY_TYPES = ['traffic', 'flood']
const FALLBACK_TYPES = Object.keys(ALERT_TYPES)
function remapLegacyType(type) {
  if (!LEGACY_TYPES.includes(type)) return type
  return FALLBACK_TYPES[Math.floor(Math.random() * FALLBACK_TYPES.length)]
}

const useAlertStore = create((set, get) => ({
  alerts: [],
  userVotes: {},   // { [alertId]: 'like' | 'dislike' }
  loading: false,
  channel: null,

  fetchAlerts: async () => {
    set({ loading: true })
    const { data } = await supabase
      .from('alerts')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(200)
    if (data) {
      const normalized = data.map((a) =>
        LEGACY_TYPES.includes(a.type) ? { ...a, type: remapLegacyType(a.type) } : a
      )
      set({ alerts: normalized, loading: false })
      // Kullanıcı oylarını getir
      const { data: { user } } = await supabase.auth.getUser()
      if (user && data.length > 0) {
        get().fetchUserVotes(data.map((a) => a.id))
      }
    } else {
      set({ loading: false })
    }
  },

  fetchUserVotes: async (alertIds) => {
    if (!alertIds.length) return
    const { data } = await supabase.rpc('get_user_votes', { p_alert_ids: alertIds })
    if (data) {
      const votes = {}
      data.forEach((row) => { votes[row.alert_id] = row.vote_type })
      set({ userVotes: votes })
    }
  },

  subscribeToAlerts: (onNewAlert) => {
    const existing = get().channel
    if (existing) supabase.removeChannel(existing)

    const channel = supabase
      .channel('public:alerts:v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, (payload) => {
        const incoming = LEGACY_TYPES.includes(payload.new.type)
          ? { ...payload.new, type: remapLegacyType(payload.new.type) }
          : payload.new
        set((state) => ({ alerts: [incoming, ...state.alerts] }))
        if (onNewAlert) onNewAlert(payload.new)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'alerts' }, (payload) => {
        set((state) => ({ alerts: state.alerts.filter((a) => a.id !== payload.old.id) }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'alerts' }, (payload) => {
        set((state) => ({
          alerts: state.alerts.map((a) => (a.id === payload.new.id ? payload.new : a)),
        }))
      })
      .subscribe()

    set({ channel })
    return () => supabase.removeChannel(channel)
  },

  addAlert: async (alertData, userId, username) => {
    // --- Koordinat doğrulama ---
    const lat = Number(alertData.lat)
    const lng = Number(alertData.lng)
    if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return { data: null, error: new Error('Geçersiz konum koordinatları') }
    }

    // --- İzin verilen türler ---
    const VALID_TYPES = Object.keys(ALERT_TYPES)
    if (!VALID_TYPES.includes(alertData.type)) {
      return { data: null, error: new Error('Geçersiz uyarı türü') }
    }

    // --- İstemci taraflı rate limit: 60 saniyede en fazla 3 uyarı ---
    const now = Date.now()
    const recent = (get()._recentAlertTimes || []).filter((t) => now - t < 60_000)
    if (recent.length >= 3) {
      return { data: null, error: new Error('Çok fazla uyarı. Lütfen 1 dakika bekleyin.') }
    }
    get()._recentAlertTimes = [...recent, now]

    // --- Açıklama uzunluğu ---
    const description = alertData.description
      ? String(alertData.description).slice(0, 500).trim() || null
      : null

    // --- Fotoğraf yükleme ---
    let photoUrl = null
    if (alertData.photo) {
      try {
        const res = await fetch(alertData.photo)
        if (!res.ok) throw new Error('Fotoğraf alınamadı')
        const blob = await res.blob()
        // Maksimum 5MB
        if (blob.size > 5 * 1024 * 1024) throw new Error('Fotoğraf çok büyük')
        const filename = `${userId}/${Date.now()}.jpg`
        const { error: uploadErr } = await supabase.storage
          .from('alert-photos')
          .upload(filename, blob, { contentType: 'image/jpeg' })
        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage
            .from('alert-photos')
            .getPublicUrl(filename)
          photoUrl = publicUrl
        }
      } catch (_) { /* Fotoğraf yüklenemezse uyarı yine de eklenir */ }
    }

    // --- Adres ---
    let address = null
    try { address = await reverseGeocode(lat, lng) } catch (_) {}

    const { data, error } = await supabase
      .from('alerts')
      .insert({
        type:        alertData.type,
        description,
        photo_url:   photoUrl,
        lat,
        lng,
        user_id:     userId,
        username:    String(username || 'Kullanıcı').slice(0, 30),
        address,
        expires_at:  new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()

    return { data, error }
  },

  removeAlert: async (id) => {
    await supabase.from('alerts').delete().eq('id', id)
    set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) }))
  },

  // Profil güncellenince kullanıcının uyarılarındaki username'i güncelle
  updateUsernameInAlerts: (userId, username) => {
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.user_id === userId ? { ...a, username } : a
      ),
    }))
  },

  // like veya dislike at — toggle, 8+ dislike = otomatik silme
  voteOnAlert: async (alertId, voteType) => {
    // --- Optimistik güncelleme: sunucu yanıtı beklemeden UI'ı hemen güncelle ---
    const prevState = get()
    const prevVote  = prevState.userVotes[alertId]
    const alert     = prevState.alerts.find((a) => a.id === alertId)
    if (alert) {
      const isToggle    = prevVote === voteType          // aynı oya tekrar tıklandı → geri çek
      const newVote     = isToggle ? null : voteType
      const likeAdj     = voteType === 'like'    ? (isToggle ? -1 : prevVote === 'dislike' ? 1 : 1) : (prevVote === 'like'    ? -1 : 0)
      const dislikeAdj  = voteType === 'dislike' ? (isToggle ? -1 : prevVote === 'like'    ? 1 : 1) : (prevVote === 'dislike' ? -1 : 0)
      set((state) => {
        const newVotes = { ...state.userVotes }
        if (newVote) newVotes[alertId] = newVote
        else delete newVotes[alertId]
        return {
          userVotes: newVotes,
          alerts: state.alerts.map((a) =>
            a.id === alertId
              ? { ...a, like_count: Math.max(0, (a.like_count||0) + likeAdj), dislike_count: Math.max(0, (a.dislike_count||0) + dislikeAdj) }
              : a
          ),
        }
      })
    }

    // --- Sunucu çağrısı ---
    const { data, error } = await supabase.rpc('vote_on_alert', {
      p_alert_id: alertId,
      p_vote_type: voteType,
    })

    if (error) {
      // Hata varsa optimistik değişikliği geri al
      set({ alerts: prevState.alerts, userVotes: prevState.userVotes })
      return { data: null, error }
    }

    // Sunucudan gelen gerçek sayılarla güncelle (array veya obje olabilir)
    const result = Array.isArray(data) ? data[0] : data
    const parsed = typeof result === 'string' ? JSON.parse(result) : result
    if (parsed) {
      set((state) => {
        const newVotes = { ...state.userVotes }
        if (parsed.user_vote) newVotes[alertId] = parsed.user_vote
        else delete newVotes[alertId]
        const newAlerts = parsed.deleted
          ? state.alerts.filter((a) => a.id !== alertId)
          : state.alerts.map((a) =>
              a.id === alertId
                ? { ...a, like_count: parsed.like_count ?? a.like_count, dislike_count: parsed.dislike_count ?? a.dislike_count }
                : a
            )
        return { alerts: newAlerts, userVotes: newVotes }
      })
    }
    return { data: parsed, error: null }
  },
}))

export default useAlertStore
