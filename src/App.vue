<script setup lang="ts">
import { computed, onErrorCaptured, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { listMenus } from './api/school'
import { useAuthStore } from './stores/auth'
import { useErrorStore } from './stores/error'
import logoUrl from './assets/xinshi_logo.png'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const errorStore = useErrorStore()
const menuLabels = ref<Record<string, string>>({})
const dropdownOpen = ref(false)
const userDropdownRef = ref<HTMLElement | null>(null)
const minSidebarWidth = 200
const maxSidebarWidth = 480
const sidebarStorageKey = 'xinshi-sidebar-width'
const isResizing = ref(false)

const showShell = computed(() => route.path !== '/login' && auth.isAuthenticated)
const userMenus = computed(() => auth.user?.menus ?? [])
const sidebarWidth = ref(readSidebarWidth())

const staticLabels: Record<string, string> = {
  dashboard: '工作台',
  config: '基础配置',
  users: '用户管理',
  classes: '班级管理',
  students: '学生管理',
  scores: '成绩管理',
  transcripts: '成绩单',
  parents: '家长端'
}

const menuOrder = ['config', 'users', 'classes', 'students', 'scores', 'transcripts', 'parents']

function readSidebarWidth() {
  const value = Number(localStorage.getItem(sidebarStorageKey))
  return value >= minSidebarWidth && value <= maxSidebarWidth ? value : 260
}

function menuLabel(menuCode: string) {
  return menuLabels.value[menuCode] || staticLabels[menuCode] || menuCode
}

async function loadMenus() {
  try {
    const menus = await listMenus()
    const labels: Record<string, string> = {}
    ;(menus ?? []).forEach((item: any) => {
      labels[item.menuCode] = item.menuLabel
    })
    menuLabels.value = labels
  } catch {
    menuLabels.value = staticLabels
  }
}

function startResize(event: MouseEvent) {
  event.preventDefault()
  isResizing.value = true
  document.addEventListener('mousemove', resize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function resize(event: MouseEvent) {
  if (!isResizing.value) {
    return
  }
  sidebarWidth.value = Math.min(maxSidebarWidth, Math.max(minSidebarWidth, event.clientX))
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', resize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  localStorage.setItem(sidebarStorageKey, String(sidebarWidth.value))
}

function toggleUserDropdown() {
  dropdownOpen.value = !dropdownOpen.value
}

function closeUserDropdown() {
  dropdownOpen.value = false
}

function handleDocumentClick(event: MouseEvent) {
  const target = event.target
  if (target instanceof Node && userDropdownRef.value?.contains(target)) {
    return
  }
  closeUserDropdown()
}

function goProfile() {
  closeUserDropdown()
  router.push('/profile')
}

async function doLogout() {
  await auth.logout()
  closeUserDropdown()
  router.push('/login')
}

onMounted(async () => {
  // 先恢复登录态，成功后再加载菜单，避免 token 失效时的并发错误
  await auth.restore()
  loadMenus()
  document.addEventListener('click', handleDocumentClick, true)

  // 全局未捕获异常弹窗
  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason instanceof Error ? event.reason.message : String(event.reason)
    errorStore.show(msg || '未知错误')
    event.preventDefault()
  })
})

// Vue 组件错误边界
onErrorCaptured((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  errorStore.show(msg || '页面渲染异常')
  return false // 阻止错误继续传播
})

onUnmounted(() => {
  document.removeEventListener('mousemove', resize)
  document.removeEventListener('mouseup', stopResize)
  document.removeEventListener('click', handleDocumentClick, true)
})
</script>

<template>
  <div
    v-if="showShell"
    class="app-shell"
    :style="{ gridTemplateColumns: `${sidebarWidth}px 6px 1fr` }"
  >
    <aside class="sidebar">
      <RouterLink class="brand" to="/dashboard">
        <img class="sidebar-logo" :src="logoUrl" alt="新实中学" />
        <span class="brand-copy">
          <span class="brand-title">新实中学</span>
          <small>学校管理后台</small>
        </span>
      </RouterLink>
      <nav class="nav">
        <RouterLink to="/dashboard">🏠 工作台</RouterLink>
        <RouterLink
          v-for="menu in menuOrder.filter((item) => userMenus.includes(item))"
          :key="menu"
          :to="`/${menu}`"
        >
          {{ menuLabel(menu) }}
        </RouterLink>
      </nav>
    </aside>
    <div
      class="sidebar-resize-handle"
      :class="{ 'sidebar-resize-handle--active': isResizing }"
      @mousedown="startResize"
    />
    <main class="main">
      <header class="topbar">
        <div>
          <p class="eyebrow">学校管理</p>
          <h2>{{ auth.user?.realName || auth.user?.loginName }}</h2>
        </div>
        <div class="topbar-actions">
          <div ref="userDropdownRef" class="user-dropdown">
            <span class="topbar-user-name" @click="toggleUserDropdown">
              {{ auth.user?.realName || auth.user?.loginName }}
              <svg class="user-dropdown-arrow" :class="{ 'user-dropdown-arrow--open': dropdownOpen }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
            <div v-if="dropdownOpen" class="user-dropdown-menu">
              <div class="user-dropdown-item" @click="goProfile">用户信息修改</div>
              <div class="user-dropdown-item user-dropdown-item--danger" @click="doLogout">退出登录</div>
            </div>
          </div>
        </div>
      </header>
      <RouterView />
    </main>

    <!-- Global Error Modal -->
    <Teleport to="body">
      <div v-if="errorStore.visible" class="modal-backdrop" @click.self="errorStore.clear()">
        <div class="modal-card" role="alertdialog" aria-modal="true" aria-label="错误提示" style="max-width: 480px">
          <div class="modal-head">
            <h2>⚠️ 错误</h2>
            <button class="button ghost sm" type="button" aria-label="关闭" @click="errorStore.clear()">关闭</button>
          </div>
          <p style="color: #b91c1c; font-size: 15px; line-height: 1.7; white-space: pre-wrap; margin: 0">{{ errorStore.message }}</p>
        </div>
      </div>
    </Teleport>
  </div>
  <RouterView v-else />
</template>

<style scoped>
.brand {
  text-decoration: none;
}
.brand-copy {
  display: grid;
  gap: 2px;
}
</style>
