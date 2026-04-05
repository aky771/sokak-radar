import { create } from 'zustand'
import { supabase, ADMIN_EMAIL } from '../lib/supabase'

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
      .single()
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

  isAdmin: () => get().user?.email === ADMIN_EMAIL,

  updateProfile: async (updates) => {
    const userId = get().user?.id
    if (!userId) return { error: new Error('Giriş yapılmamış') }
    const { error } = await supabase
      .from('profiles')
      .update({
        username:     updates.username     ?? undefined,
        display_name: updates.display_name ?? null,
        bio:          updates.bio          ?? null,
        avatar_color: updates.avatar_color ?? undefined,
      })
      .eq('id', userId)
    if (!error) await get().fetchProfile(userId)
    return { error }
  },
}))

export default useAuthStore
