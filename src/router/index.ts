import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'
import { AUTH_STORAGE_KEY } from '../api/http'
import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import UsersView from '../views/UsersView.vue'
import ConfigView from '../views/ConfigView.vue'
import ClassesView from '../views/ClassesView.vue'
import StudentsView from '../views/StudentsView.vue'
import ScoresView from '../views/ScoresView.vue'
import TranscriptsView from '../views/TranscriptsView.vue'
import ParentsView from '../views/ParentsView.vue'
import ClassStatsView from '../views/ClassStatsView.vue'
import ProfileView from '../views/ProfileView.vue'

function landingPageFromStoredAuth() {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY)
  if (!raw) {
    return '/login'
  }
  try {
    return JSON.parse(raw).landingPage || '/dashboard'
  } catch {
    return '/login'
  }
}

function hasMenuAccess(to: RouteLocationNormalized) {
  const menuKey = to.meta.menuKey
  if (!menuKey || menuKey === 'dashboard') {
    return true
  }
  const raw = localStorage.getItem(AUTH_STORAGE_KEY)
  if (!raw) {
    return false
  }
  try {
    const menus = JSON.parse(raw).menus ?? []
    return menus.includes(String(menuKey))
  } catch {
    return false
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    { path: '/h5/score', name: 'h5-score', component: () => import('../views/h5/H5ScoreView.vue'), meta: { layout: 'h5' } },
    { path: '/', redirect: landingPageFromStoredAuth },
    { path: '/dashboard', name: 'dashboard', component: DashboardView, meta: { requiresAuth: true, menuKey: 'dashboard' } },
    { path: '/users', name: 'users', component: UsersView, meta: { requiresAuth: true, menuKey: 'users' } },
    { path: '/config', name: 'config', component: ConfigView, meta: { requiresAuth: true, menuKey: 'config' } },
    { path: '/classes', name: 'classes', component: ClassesView, meta: { requiresAuth: true, menuKey: 'classes' } },
    {
      path: '/teaching',
      component: () => import('../views/teaching/TeachingWorkspaceView.vue'),
      meta: { requiresAuth: true, menuKey: 'teaching' },
      children: [
        { path: '', redirect: '/teaching/course-selection' },
        { path: 'course-selection', name: 'teaching-course-selection', component: () => import('../views/teaching/CourseSelectionView.vue') },
        { path: 'report-jobs', name: 'teaching-report-jobs', component: () => import('../views/teaching/ReportJobsView.vue') },
        { path: 'assessments', name: 'teaching-assessments', component: () => import('../views/teaching/AssessmentsView.vue') },
        { path: 'comments', name: 'teaching-comments', component: () => import('../views/teaching/TeachingCommentsView.vue') },
        { path: 'research', name: 'teaching-research', component: () => import('../views/teaching/ResearchView.vue') },
        { path: 'teachers', name: 'teaching-teachers', component: () => import('../views/teaching/TeachingTeachersView.vue') }
      ]
    },
    { path: '/students', name: 'students', component: StudentsView, meta: { requiresAuth: true, menuKey: 'students' } },
    { path: '/scores', name: 'scores', component: ScoresView, meta: { requiresAuth: true, menuKey: 'scores' } },
    { path: '/classStats', name: 'classStats', component: ClassStatsView, meta: { requiresAuth: true, menuKey: 'classStats' } },
    { path: '/transcripts', name: 'transcripts', component: TranscriptsView, meta: { requiresAuth: true, menuKey: 'transcripts' } },
    { path: '/parents', name: 'parents', component: ParentsView, meta: { requiresAuth: true, menuKey: 'parents' } },
    { path: '/profile', name: 'profile', component: ProfileView, meta: { requiresAuth: true } }
  ]
})

router.beforeEach((to) => {
  if (to.meta.layout === 'h5') {
    return true
  }
  const hasAuth = Boolean(localStorage.getItem(AUTH_STORAGE_KEY))
  if (to.meta.requiresAuth && !hasAuth) {
    return '/login'
  }
  if (to.path === '/login' && hasAuth) {
    return landingPageFromStoredAuth()
  }
  if (hasAuth && !hasMenuAccess(to)) {
    return landingPageFromStoredAuth()
  }
  return true
})

export default router
