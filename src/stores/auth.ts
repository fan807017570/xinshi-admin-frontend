import { defineStore } from 'pinia'
import { AUTH_STORAGE_KEY } from '../api/http'
import { getCurrentUser, login, logout, normalizeUser, type AuthUser } from '../api/school'

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: readStoredUser() as AuthUser | null,
    loading: false,
    error: ''
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.user),
    isSuperAdmin: (state) => state.user?.roles.includes('SUPER_ADMIN') ?? false,
    isHeadTeacher: (state) => state.user?.roles.includes('HEAD_TEACHER') ?? false,
    isTeacher: (state) => state.user?.roles.includes('TEACHER') ?? false,
    isDualRoleTeacher(): boolean {
      return this.isHeadTeacher && this.isTeacher
    },
    isParent: (state) => state.user?.roles.includes('PARENT') ?? false,
    canManageUsers: (state) => state.user?.menus.includes('users') ?? false,
    canManageClasses: (state) => state.user?.menus.includes('classes') ?? false,
    canManageStudents: (state) => state.user?.menus.includes('students') ?? false,
    canManageScores: (state) => state.user?.menus.includes('scores') ?? false,
    canManageAcademicConfigs: (state) => state.user?.menus.includes('config') ?? false,
    canManageTranscripts: (state) => state.user?.menus.includes('transcripts') ?? false
  },
  actions: {
    async restore() {
      if (!localStorage.getItem(AUTH_STORAGE_KEY)) {
        return
      }
      try {
        const current = await getCurrentUser()
        this.user = normalizeUser(current)
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.user))
      } catch {
        this.clear()
      }
    },
    async login(payload: { loginName: string; password: string }) {
      this.loading = true
      this.error = ''
      try {
        const data = await login(payload)
        this.user = normalizeUser(data)
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(this.user))
      } catch (error) {
        this.error = error instanceof Error ? error.message : '登录失败'
        throw error
      } finally {
        this.loading = false
      }
    },
    async logout() {
      try {
        await logout()
      } catch {
        // Local logout still succeeds if the server session is already gone.
      }
      this.clear()
    },
    clear() {
      this.user = null
      localStorage.removeItem(AUTH_STORAGE_KEY)
    }
  }
})
