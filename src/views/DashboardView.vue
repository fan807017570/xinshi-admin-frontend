<template>
  <section class="page">
    <header class="page-header">
      <div>
        <p class="eyebrow">Dashboard</p>
        <h1>{{ greeting }}，{{ userName }}</h1>
        <p class="lead">{{ leadText }}</p>
        <div class="tag-row">
          <span v-for="role in userRoles" :key="role" class="badge role-badge">{{ roleLabels[role] || role }}</span>
        </div>
      </div>
    </header>

    <div class="metrics">
      <article class="metric">
        <span class="metric-icon">👤</span>
        <div class="metric-body">
          <span class="metric-label">用户总数</span>
          <strong>{{ summary.userCount ?? 0 }}</strong>
        </div>
        <span class="metric-foot">系统登录主体</span>
      </article>
      <article class="metric">
        <span class="metric-icon">🏫</span>
        <div class="metric-body">
          <span class="metric-label">班级总数</span>
          <strong>{{ summary.classCount ?? 0 }}</strong>
        </div>
        <span class="metric-foot">当前有效班级</span>
      </article>
      <article class="metric">
        <span class="metric-icon">🎓</span>
        <div class="metric-body">
          <span class="metric-label">学生总数</span>
          <strong>{{ summary.studentCount ?? 0 }}</strong>
        </div>
        <span class="metric-foot">当前有效学生</span>
      </article>
      <article class="metric">
        <span class="metric-icon">📊</span>
        <div class="metric-body">
          <span class="metric-label">成绩记录</span>
          <strong>{{ summary.scoreCount ?? summary.resultCount ?? 0 }}</strong>
        </div>
        <span class="metric-foot">已录入课程成绩</span>
      </article>
    </div>

    <div class="panel workbench-panel">
      <div class="workbench-grid">
        <RouterLink
          v-for="item in quickLinks"
          :key="item.to"
          :to="item.to"
          class="workbench-card"
        >
          <span class="workbench-icon">{{ item.icon }}</span>
          <div class="workbench-card-body">
            <span class="workbench-kicker">{{ item.highlight }}</span>
            <strong>{{ item.title }}</strong>
            <p>{{ item.desc }}</p>
          </div>
          <span class="workbench-link">进入 →</span>
        </RouterLink>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="panel dash-panel">
        <div class="dash-panel-head">
          <h2>最近班级</h2>
          <RouterLink v-if="auth.canManageClasses" class="dash-panel-link" to="/classes">全部 →</RouterLink>
        </div>
        <div v-if="recentClasses.length" class="mini-list">
          <div v-for="item in recentClasses" :key="item.name" class="mini-item">
            <div class="mini-item-main">
              <strong>{{ item.name }}</strong>
              <span>{{ item.desc }}</span>
            </div>
            <span class="mini-item-badge badge--key">班级</span>
          </div>
        </div>
        <p v-else class="mini-empty">暂无班级数据</p>
      </div>

      <div class="panel dash-panel">
        <div class="dash-panel-head">
          <h2>最近学生</h2>
          <RouterLink v-if="auth.canManageStudents" class="dash-panel-link" to="/students">全部 →</RouterLink>
        </div>
        <div v-if="recentStudents.length" class="mini-list">
          <div v-for="item in recentStudents" :key="item.name" class="mini-item">
            <div class="mini-item-main">
              <strong>{{ item.name }}</strong>
              <span>{{ item.desc }}</span>
            </div>
            <span class="mini-item-badge badge--normal">学生</span>
          </div>
        </div>
        <p v-else class="mini-empty">暂无学生数据</p>
      </div>

      <div class="panel dash-panel">
        <div class="dash-panel-head">
          <h2>最近用户</h2>
          <RouterLink v-if="auth.canManageUsers" class="dash-panel-link" to="/users">全部 →</RouterLink>
        </div>
        <div v-if="recentUsers.length" class="mini-list">
          <div v-for="item in recentUsers" :key="item.name" class="mini-item">
            <div class="mini-item-main">
              <strong>{{ item.name }}</strong>
              <span>{{ item.desc }}</span>
            </div>
            <span class="mini-item-badge badge--normal">用户</span>
          </div>
        </div>
        <p v-else class="mini-empty">暂无用户数据</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getDashboardSummary, listRoles, listClasses, listStudents, listUsers } from '../api/school'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()

const summary = ref<Record<string, any>>({})
const recentClasses = ref<Array<{ name: string; desc: string }>>([])
const recentStudents = ref<Array<{ name: string; desc: string }>>([])
const recentUsers = ref<Array<{ name: string; desc: string }>>([])
const roleLabels = ref<Record<string, string>>({})

const userName = computed(() => auth.user?.realName || auth.user?.loginName || '系统管理员')

const userRoles = computed(() => auth.user?.roles ?? [])

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

const leadText = computed(() => {
  const count = userRoles.value.length
  if (count === 0) return '暂无角色分配'
  if (count === 1) return '当前身份：' + (roleLabels.value[userRoles.value[0]] || userRoles.value[0])
  return '您拥有 ' + count + ' 个角色'
})

const quickLinks = computed(() => {
  const links: Array<{ to: string; title: string; desc: string; highlight: string; icon: string }> = []
  if (auth.canManageUsers) {
    links.push({ to: '/users', title: '用户管理', desc: '管理账号、分配角色。', highlight: '账号维护', icon: '👥' })
  }
  if (auth.canManageAcademicConfigs) {
    links.push({ to: '/config', title: '学期与课程配置', desc: '设置学期、年级科目和班级科目。', highlight: '基础配置', icon: '⚙️' })
  }
  if (auth.canManageClasses) {
    links.push({ to: '/classes', title: '班级管理', desc: '维护班级信息和班主任。', highlight: '班级总览', icon: '🏫' })
  }
  if (auth.canManageStudents) {
    links.push({ to: '/students', title: '学生管理', desc: '管理本班学生及家长绑定。', highlight: '学籍维护', icon: '🎓' })
  }
  if (auth.canManageScores) {
    links.push({ to: '/scores', title: '成绩录入', desc: '录入、发布课程成绩。', highlight: '教学动作', icon: '📝' })
  }
  if (auth.canManageTranscripts) {
    links.push({ to: '/transcripts', title: '成绩单', desc: '生成或查看学生成绩单。', highlight: '输出物', icon: '📄' })
  }
  if (auth.isParent) {
    links.push({ to: '/parents', title: '家长视图', desc: '查看绑定学生的成绩和评语。', highlight: '家庭侧', icon: '🏠' })
  }
  return links
})

function toArray(value: any) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.records)) return value.records
  if (Array.isArray(value?.list)) return value.list
  if (Array.isArray(value?.items)) return value.items
  return []
}

function normalizeRecent(rows: any[], primaryKeys: string[], secondaryKeys: string[]) {
  return rows.slice(0, 5).map((row) => ({
    name: primaryKeys.map((key) => row?.[key]).find(Boolean) || '未命名',
    desc: secondaryKeys.map((key) => row?.[key]).find(Boolean) || '暂无更多信息'
  }))
}

async function loadDashboard() {
  try {
    summary.value = (await getDashboardSummary()) ?? {}
  } catch {
    summary.value = {}
  }
  try {
    const roles: any[] = (await listRoles()) ?? []
    const labels: Record<string, string> = {}
    roles.forEach((r: any) => {
      labels[r.roleCode] = r.roleName
    })
    roleLabels.value = labels
  } catch {
    roleLabels.value = {
      SUPER_ADMIN: '超级管理员',
      HEAD_TEACHER: '班主任',
      TEACHER: '任课教师',
      PARENT: '家长'
    }
  }

  // 并行加载最近数据
  const promises: Promise<void>[] = []
  if (auth.isSuperAdmin || auth.isHeadTeacher) {
    promises.push(
      listClasses({ page: 1, size: 5 }).then((res: any) => {
        recentClasses.value = normalizeRecent(toArray(res?.data?.items ?? res?.items ?? res), ['className', 'name'], ['headTeacherName', 'gradeName'])
      }).catch(() => { recentClasses.value = [] })
    )
  }
  if (auth.isSuperAdmin || auth.isHeadTeacher || auth.isParent) {
    promises.push(
      listStudents({ status: 1, page: 1, size: 5 }).then((res: any) => {
        recentStudents.value = normalizeRecent(toArray(res?.data?.items ?? res?.items ?? res), ['studentName', 'name'], ['className', 'studentNo'])
      }).catch(() => { recentStudents.value = [] })
    )
  }
  if (auth.isSuperAdmin) {
    promises.push(
      listUsers({ page: 1, size: 5 }).then((res: any) => {
        recentUsers.value = normalizeRecent(toArray(res?.data?.items ?? res?.items ?? res), ['realName', 'loginName'], ['roleName', 'statusName'])
      }).catch(() => { recentUsers.value = [] })
    )
  }
  await Promise.all(promises)
}

onMounted(loadDashboard)
</script>
