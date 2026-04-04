import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const ALERT_TYPES = {
  traffic:  { label: 'Trafik',        emoji: '🚗', color: '#f59e0b', bg: '#78350f' },
  accident: { label: 'Kaza',          emoji: '🚨', color: '#ef4444', bg: '#7f1d1d' },
  hazard:   { label: 'Tehlike',       emoji: '⚠️', color: '#f97316', bg: '#7c2d12' },
  police:   { label: 'Polis',         emoji: '🚔', color: '#3b82f6', bg: '#1e3a5f' },
  roadwork: { label: 'Yol Çalışması', emoji: '🚧', color: '#a855f7', bg: '#4a1d96' },
  closure:  { label: 'Yol Kapanışı',  emoji: '🚫', color: '#6b7280', bg: '#1f2937' },
  spotted:  { label: 'Görüldü',       emoji: '👁️', color: '#10b981', bg: '#064e3b' },
  flood:    { label: 'Su Baskını',    emoji: '🌊', color: '#0ea5e9', bg: '#0c4a6e' },
}

const useAlertStore = create((set, get) => ({
  alerts: [],
  loading: false,
  channel: null,

  fetchAlerts: async () => {
    set({ loading: true })
    const { data } = await supabase
      .from('alerts')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
    set({ alerts: data || [], loading: false })
  },

  subscribeToAlerts: () => {
    const existing = get().channel
    if (existing) supabase.removeChannel(existing)

    const channel = supabase
      .channel('public:alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, (payload) => {
        set((state) => ({ alerts: [payload.new, ...state.alerts] }))
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

  voteAlert: async (id) => {
    await supabase.rpc('increment_vote', { alert_id: id })
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, votes: a.votes + 1 } : a)),
    }))
  },
}))

export default useAlertStore
