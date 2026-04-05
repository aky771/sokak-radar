import { create } from 'zustand'
import { supabase, ADMIN_EMAIL } from '../lib/supabase'
import useAlertStore from './useAlertStore'

const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  loading: true,

  init: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      set({ user: session.user })
      await get().fetchProfile(session.user.id)
    }
    set({ loading: false })

    supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user || null
      set({ user })
      if (user) await get().fetchProfile(user.id)
      else set({ profile: null })
    })
  },

  fetchProfile: async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    set({ profile: data })
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { user: data?.user || null, error }
  },

  signUp: async (email, password, username) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    })
    // session: e-posta doğrulama kapalıysa anında oturum açılır
    return {
      user: data?.user || null,
      session: data?.session || null,
      error,
    }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null })
  },

  isAdmin: () => {
    // 1. Birincil kontrol: DB'deki is_admin flag'i (en güvenilir)
    if (get().profile?.is_admin === true) return true
    // 2. Yedek kontrol: email karşılaştırması
    const email = get().user?.email?.trim().toLowerCase()
    return !!email && !!ADMIN_EMAIL && email === ADMIN_EMAIL.trim().toLowerCase()
  },

  updateProfile: async (updates) => {
    const userId    = get().user?.id
    const userEmail = get().user?.email
    if (!userId) return { error: new Error('Giriş yapılmamış') }

    // UPDATE yerine UPSERT — profil satırı yoksa oluşturur
    const newUsername = updates.username ?? get().profile?.username ?? userEmail?.split('@')[0] ?? 'kullanici'
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id:           userId,
        email:        userEmail ?? null,
        username:     newUsername,
        display_name: updates.display_name ?? null,
        bio:          updates.bio          ?? null,
        avatar_color: updates.avatar_color ?? get().profile?.avatar_color ?? '#6366f1',
      }, { onConflict: 'id' })
    if (!error) {
      await get().fetchProfile(userId)
      // Zustand alert store'daki bu kullanıcının uyarılarını hemen güncelle
      useAlertStore.getState().updateUsernameInAlerts(userId, newUsername)
      // DB'deki uyarı kayıtlarını da güncelle (best-effort, RLS izin verirse)
      supabase.from('alerts').update({ username: newUsername }).eq('user_id', userId)
    }
    return { error }
  },
}))

export default useAuthStore
