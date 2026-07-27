<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { listRoles, updateProfile } from '../api/school'
import { useAuthStore } from '../stores/auth'
import { AUTH_STORAGE_KEY } from '../api/http'

const auth = useAuthStore()
const saving = ref(false)
const success = ref('')
const error = ref('')
const roleNameMap = ref<Record<string, string>>({})

const form = reactive({
  mobile: '',
  email: '',
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

function rows(data: any) {
  return Array.isArray(data) ? data : data?.records ?? data?.list ?? []
}

function roleText() {
  return (auth.user?.roles ?? []).map((role) => roleNameMap.value[role] || role).join('、')
}

function fillFormFromUser() {
  const user = auth.user
  if (!user) {
    return
  }
  form.mobile = user.mobile || ''
  form.email = user.email || ''
}

function clearMessages() {
  success.value = ''
  error.value = ''
}

async function loadRoleNames() {
  try {
    const roles = rows(await listRoles())
    const map: Record<string, string> = {}
    roles.forEach((role: any) => {
      map[role.roleCode] = role.roleName
    })
    roleNameMap.value = map
  } catch {
    roleNameMap.value = {}
  }
}

async function submit() {
  if (saving.value) {
    return
  }
  clearMessages()
  if (form.newPassword && form.newPassword !== form.confirmPassword) {
    error.value = '两次输入的新密码不一致'
    return
  }
  saving.value = true
  try {
    const payload: Record<string, string> = {}
    if (form.mobile) {
      payload.mobile = form.mobile
    }
    if (form.email) {
      payload.email = form.email
    }
    if (form.newPassword) {
      payload.oldPassword = form.oldPassword
      payload.newPassword = form.newPassword
    }

    const updated: any = await updateProfile(payload)
    if (auth.user) {
      auth.user.realName = updated.realName ?? auth.user.realName
      if (updated.mobile !== undefined) {
        auth.user.mobile = updated.mobile
      }
      if (updated.email !== undefined) {
        auth.user.email = updated.email
      }
      const raw = localStorage.getItem(AUTH_STORAGE_KEY)
      if (raw) {
        try {
          const stored = JSON.parse(raw)
          if (updated.mobile !== undefined) {
            stored.mobile = updated.mobile
          }
          if (updated.email !== undefined) {
            stored.email = updated.email
          }
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(stored))
        } catch {
          // Ignore malformed cached auth; the active Pinia state has already been updated.
        }
      }
    }
    form.oldPassword = ''
    form.newPassword = ''
    form.confirmPassword = ''
    success.value = '个人信息更新成功'
  } catch (err) {
    error.value = err instanceof Error ? err.message : '更新失败'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  fillFormFromUser()
  loadRoleNames()
})
</script>

<template>
  <div class="profile-page">
    <div class="profile-card">
      <div class="profile-header">
        <h1>个人信息</h1>
        <p>管理您的账户信息和密码</p>
      </div>

      <div class="profile-section">
        <h3 class="section-title">账户信息</h3>
        <div class="info-grid">
          <div class="info-item">
            <label>登录账号</label>
            <span class="info-value">{{ auth.user?.loginName }}</span>
          </div>
          <div class="info-item">
            <label>姓名</label>
            <span class="info-value">{{ auth.user?.realName }}</span>
          </div>
          <div class="info-item">
            <label>角色</label>
            <span class="info-value">{{ roleText() }}</span>
          </div>
        </div>
      </div>

      <div class="profile-section">
        <h3 class="section-title">联系方式</h3>
        <form class="profile-form" @submit.prevent="submit">
          <div class="form-field">
            <label for="mobile">手机号码</label>
            <input
              id="mobile"
              v-model="form.mobile"
              type="text"
              placeholder="请输入11位手机号码"
              maxlength="11"
              class="form-input"
            />
          </div>

          <div class="form-field">
            <label for="email">邮箱地址</label>
            <input id="email" v-model="form.email" type="email" placeholder="请输入邮箱地址" class="form-input" />
          </div>

          <h3 class="section-title" style="margin-top: 32px">修改密码</h3>

          <div class="form-field">
            <label for="oldPassword">旧密码</label>
            <input
              id="oldPassword"
              v-model="form.oldPassword"
              type="password"
              placeholder="如需修改密码，请输入旧密码"
              class="form-input"
            />
          </div>

          <div class="form-field">
            <label for="newPassword">新密码</label>
            <input
              id="newPassword"
              v-model="form.newPassword"
              type="password"
              placeholder="至少10位，包含大小写字母、数字和特殊字符"
              class="form-input"
            />
          </div>

          <div class="form-field">
            <label for="confirmPassword">确认新密码</label>
            <input
              id="confirmPassword"
              v-model="form.confirmPassword"
              type="password"
              placeholder="请再次输入新密码"
              class="form-input"
            />
          </div>

          <div v-if="success" class="form-message form-message--success">{{ success }}</div>
          <div v-if="error" class="form-message form-message--error">{{ error }}</div>

          <button class="submit-btn" type="submit" :disabled="saving">
            <template v-if="saving">
              <span class="spinner"></span>
              保存中...
            </template>
            <template v-else> 保存修改 </template>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  max-width: 640px;
  margin: 0 auto;
  padding: 24px;
}

.profile-card {
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px #0000000f;
}

.profile-header {
  border-bottom: 1px solid #f1f5f9;
  padding: 28px 32px 20px;
}

.profile-header h1 {
  color: #0f172a;
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}

.profile-header p {
  color: #64748b;
  margin: 6px 0 0;
  font-size: 14px;
}

.profile-section {
  padding: 24px 32px;
}

.profile-section + .profile-section {
  border-top: 1px solid #f1f5f9;
}

.section-title {
  color: #334155;
  margin: 0 0 16px;
  font-size: 15px;
  font-weight: 600;
}

.info-grid {
  gap: 16px;
  display: grid;
}

.info-item {
  align-items: center;
  padding: 10px 0;
  display: flex;
}

.info-item label {
  color: #94a3b8;
  flex-shrink: 0;
  width: 100px;
  font-size: 13px;
  font-weight: 500;
}

.info-value {
  color: #0f172a;
  font-size: 14px;
  font-weight: 500;
}

.profile-form {
  gap: 16px;
  display: grid;
}

.form-field {
  gap: 6px;
  display: grid;
}

.form-field label {
  color: #334155;
  font-size: 13px;
  font-weight: 600;
}

.form-input {
  color: #0f172a;
  box-sizing: border-box;
  background: #fff;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  outline: none;
  width: 100%;
  padding: 11px 14px;
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-input::placeholder {
  color: #94a3b8;
}

.form-input:focus {
  border-color: #0f766e;
  box-shadow: 0 0 0 3px #0f766e1f;
}

.form-message {
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 13px;
  line-height: 1.5;
}

.form-message--success {
  color: #15803d;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.form-message--error {
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.submit-btn {
  color: #fff;
  cursor: pointer;
  background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%);
  border: none;
  border-radius: 12px;
  justify-content: center;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin-top: 8px;
  padding: 13px 20px;
  font-size: 15px;
  font-weight: 600;
  transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
  display: flex;
  box-shadow: 0 4px 14px #0f766e40;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 24px #0f766e59;
}

.submit-btn:active:not(:disabled) {
  transform: translateY(0);
}

.submit-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.spinner {
  border: 2px solid #ffffff4d;
  border-top-color: #fff;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  animation: 0.6s linear infinite profile-spin;
}

@keyframes profile-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
