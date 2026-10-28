<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useErrorStore } from '../stores/error'
import logoUrl from '../assets/xinshi_logo.png'

const KICK_STORAGE_KEY = 'login-kick-reason'

const router = useRouter()
const auth = useAuthStore()
const errorStore = useErrorStore()
const form = reactive({ loginName: '', password: '' })
const showPassword = ref(false)
const submitting = ref(false)
// 被顶下线提示：读取一次即清除，避免刷新后重复展示
const kickNotice = ref(sessionStorage.getItem(KICK_STORAGE_KEY) || '')
if (kickNotice.value) {
  sessionStorage.removeItem(KICK_STORAGE_KEY)
}

async function submit() {
  if (submitting.value) {
    return
  }
  submitting.value = true
  try {
    await auth.login(form)
    errorStore.clear() // 登录成功，清除历史上的全局错误弹窗
    await router.push(auth.user?.landingPage || '/dashboard')
  } catch {
    errorStore.clear() // 登录错误已在表单内展示，清除全局弹窗避免重复
    submitting.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <div v-if="kickNotice" class="login-kick-notice" role="alert">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span>{{ kickNotice }}，如需继续请重新登录。</span>
    </div>
    <section class="login-brand">
      <div class="login-brand__content">
        <img class="login-brand__logo" :src="logoUrl" alt="新实中学" />
        <h1 class="login-brand__title">新实中学</h1>
        <p class="login-brand__subtitle">学校班级成绩管理系统</p>
        <p class="login-brand__desc">一体化管理后台，联接班级、学生、课程、成绩与成绩单，为教师、班主任、家长提供专业的教育数据服务。</p>
        <div class="login-brand__features">
          <div class="login-brand__feature">
            <span class="login-brand__feature-icon">📊</span>
            <span>成绩管理与分析</span>
          </div>
          <div class="login-brand__feature">
            <span class="login-brand__feature-icon">✨</span>
            <span>智能评语与反馈</span>
          </div>
          <div class="login-brand__feature">
            <span class="login-brand__feature-icon">📄</span>
            <span>成绩单自动生成</span>
          </div>
        </div>
        <p class="login-brand__footer">© {{ new Date().getFullYear() }} 新实中学 · All Rights Reserved</p>
      </div>
    </section>
    <section class="login-form-panel">
      <form class="login-form-card" @submit.prevent="submit">
        <div class="login-form__header">
          <p class="login-form__eyebrow">欢迎回来</p>
          <h2>登录系统</h2>
          <p class="login-form__desc">请输入您的账号和密码</p>
        </div>
        <label class="login-form__field">
          <span class="login-form__label">登录账号</span>
          <div class="login-form__input-wrap">
            <svg class="login-form__input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <input id="loginName" v-model.trim="form.loginName" class="login-form__input" autocomplete="username" placeholder="请输入登录账号" autofocus required />
          </div>
        </label>
        <label class="login-form__field" style="margin-top: 14px">
          <span class="login-form__label">密码</span>
          <div class="login-form__input-wrap">
            <svg class="login-form__input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <input
              id="password"
              v-model="form.password"
              class="login-form__input"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="请输入密码"
              required
            />
            <button class="login-form__toggle-pw" type="button" :aria-label="showPassword ? '隐藏密码' : '显示密码'" @click="showPassword = !showPassword">
              <svg v-if="!showPassword" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" aria-hidden="true">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            </button>
          </div>
        </label>
        <p v-if="auth.error" class="login-form__error" style="margin-top: 14px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{{ auth.error }}</span>
        </p>
        <button class="login-form__submit" type="submit" :disabled="submitting || auth.loading" style="width: 100%; margin-top: 18px">
          <span v-if="submitting || auth.loading" class="login-form__spinner" />
          {{ submitting || auth.loading ? '登录中...' : '进入系统' }}
        </button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.login-kick-notice {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: min(560px, calc(100vw - 32px));
  border: 1px solid #fcd34d;
  border-radius: 12px;
  padding: 12px 18px;
  color: #92400e;
  background: #fef3c7;
  font-size: 14px;
  font-weight: 700;
  box-shadow: 0 12px 32px #0f172a26;
}
</style>
