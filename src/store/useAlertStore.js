import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { reverseGeocode } from '../utils/geocode'

export const ALERT_TYPES = {
  traffic:  { label: 'Trafik',        emoji: '🚗', color: '#f59e0b', bg: '#78350f22' },
  accident: { label: 'Kaza',          emoji: '🚨', color: '#ef4444', bg: '#7f1d1d22' },
  hazard:   { label: 'Tehlike',       emoji: '⚠️', color: '#f97316', bg: '#7c2d1222' },
  police:   { label: 'Polis',         emoji: '🚔', color: '#3b82f6', bg: '#1e3a5f22' },
  roadwork: { label: 'Yol Çalışması', emoji: '🚧', color: '#a855f7', bg: '#4a1d9622' },
  closure:  { label: 'Yol Kapanışı',  emoji: '🚫', color: '#6b7280', bg: '#1f293722' },
  spotted:  { label: 'Görüldü',       emoji: '👁️', color: '#10b981', bg: '#064e3b22' },
  flood:    { label: 'Su Baskını',    emoji: '🌊', color: '#0ea5e9', bg: '#0c4a6e22' },
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
    if (data) {
      set({ alerts: data, loading: false })
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
        set((state) => ({ alerts: [payload.new, ...state.alerts] }))
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
    let photoUrl = null

    if (alertData.photo) {
      try {
        const res = await fetch(alertData.photo)
        const blob = await res.blob()
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
      } catch (_) {}
    }

    // Oluşturulurken adresi al ve kaydet
    let address = null
    try {
      address = await reverseGeocode(alertData.lat, alertData.lng)
    } catch (_) {}

    const { data, error } = await supabase
      .from('alerts')
      .insert({
        type: alertData.type,
        description: alertData.description || null,
        photo_url: photoUrl,
        lat: alertData.lat,
        lng: alertData.lng,
        user_id: userId,
        username: username || 'Kullanıcı',
        address: address,
        expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()

    return { data, error }
  },

  removeAlert: async (id) => {
    await supabase.from('alerts').delete().eq('id', id)
    set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) }))
  },

  // like veya dislike at — toggle, 8+ dislike = otomatik silme
  voteOnAlert: async (alertId, voteType) => {
    const { data, error } = await supabase.rpc('vote_on_alert', {
      p_alert_id: alertId,
      p_vote_type: voteType,
    })
    if (!error && data) {
      set((state) => {
        const newAlerts = data.deleted
          ? state.alerts.filter((a) => a.id !== alertId)
          : state.alerts.map((a) =>
              a.id === alertId
                ? { ...a, like_count: data.like_count, dislike_count: data.dislike_count }
                : a
            )
        const newVotes = { ...state.userVotes }
        if (data.user_vote) {
          newVotes[alertId] = data.user_vote
        } else {
          delete newVotes[alertId]
        }
        return { alerts: newAlerts, userVotes: newVotes }
      })
    }
    return { data, error }
  },
}))

export default useAlertStore
