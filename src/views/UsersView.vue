<template>
  <section class="users-page">
    <div class="page-header">
      <div>
        <p class="eyebrow">User Management</p>
        <h1>用户管理</h1>
        <p class="lead">维护系统账号、角色和启停状态。</p>
      </div>
      <button class="button primary" type="button" @click="openCreate">新增用户</button>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Filters</p>
          <h2>查询条件</h2>
        </div>
      </div>
      <div class="user-query-form">
        <input v-model.trim="query.keyword" placeholder="按账号或姓名搜索" @keyup.enter="search" />
        <select v-model="query.status">
          <option value="">全部状态</option>
          <option value="1">启用</option>
          <option value="0">停用</option>
        </select>
        <select v-model="query.roleCode">
          <option value="">全部角色</option>
          <option v-for="role in roles" :key="role.roleCode || role.code" :value="role.roleCode || role.code">
            {{ role.roleName || role.name }}
          </option>
        </select>
        <div class="user-query-actions">
          <button class="button primary" type="button" @click="search">查询</button>
          <button class="button ghost" type="button" @click="resetQuery">重置</button>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Users</p>
          <h2>用户列表</h2>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>账号</th>
              <th>姓名</th>
              <th>手机号</th>
              <th>邮箱</th>
              <th>角色</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>修改时间</th>
              <th>修改人</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in users" :key="item.id">
              <td>{{ item.loginName }}</td>
              <td>{{ item.realName }}</td>
              <td>{{ item.mobile || '-' }}</td>
              <td>{{ item.email || '-' }}</td>
              <td>{{ roleText(item) }}</td>
              <td><span :class="['badge', Number(item.status) === 1 ? '' : 'warning']">{{ Number(item.status) === 1 ? '启用' : '停用' }}</span></td>
              <td>{{ formatTime(item.createdAt) }}</td>
              <td>{{ formatTime(item.updatedAt) }}</td>
              <td>{{ item.updatedByName || '-' }}</td>
              <td>
                <div class="action-group">
                  <button class="button sm" type="button" @click="openEdit(item)">修改</button>
                  <button class="button sm" type="button" @click="toggleStatus(item)">{{ Number(item.status) === 1 ? '停用' : '启用' }}</button>
                </div>
              </td>
            </tr>
            <tr v-if="!users.length"><td colspan="10" class="empty">暂无用户数据</td></tr>
          </tbody>
        </table>
      </div>
      <div class="pagination">
        <div class="pagination-left">
          <span class="pagination-info">共 {{ total }} 条</span>
          <label class="pagination-size-label">
            每页
            <select v-model.number="page.size" class="pagination-size-select" @change="search">
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
            条
          </label>
        </div>
        <div class="pagination-buttons">
          <button v-for="num in pageNumbers" :key="num" class="button sm" :class="{ primary: num === page.current }" type="button" @click="goPage(num)">{{ num }}</button>
        </div>
      </div>
    </div>

    <div v-if="modalVisible" class="modal-backdrop" @click.self="closeModal">
      <div class="modal-card modal-card-wide">
        <div class="modal-head">
          <div>
            <p class="eyebrow">{{ editing ? '编辑用户' : '新增用户' }}</p>
            <h2>{{ editing ? '修改用户信息' : '录入用户信息' }}</h2>
          </div>
          <button class="button ghost sm" type="button" @click="closeModal">关闭</button>
        </div>
        <form class="student-form modal-form" @submit.prevent="submitUser">
          <input v-model.trim="form.realName" placeholder="真实姓名" required @blur="syncLoginName" />
          <input v-model.trim="form.loginName" placeholder="登录账号" required :disabled="!!editing" />
          <input v-model.trim="form.mobile" placeholder="手机号" />
          <input v-model.trim="form.email" type="email" placeholder="邮箱" />
          <input v-if="!editing" v-model.trim="form.password" type="password" placeholder="初始密码" required />
          <input v-if="editing" v-model.trim="form.password" type="password" placeholder="新密码（留空则不修改）" />
          <div class="student-form-full">
            <div class="role-picker-title">角色选择</div>
            <div class="role-picker">
              <label
                v-for="role in roleOptions"
                :key="roleCodeOf(role)"
                class="role-chip"
                :class="{ 'role-chip--active': form.roleCodes.includes(roleCodeOf(role)) }"
              >
                <input v-model="form.roleCodes" type="checkbox" :value="roleCodeOf(role)" />
                <span>{{ roleNameOf(role) }}</span>
              </label>
            </div>
            <div class="hint" style="margin-top: 8px">勾选一个或多个角色，编辑时会直接覆盖原有角色。</div>
          </div>
          <select v-model.number="form.status">
            <option :value="1">启用</option>
            <option :value="0">停用</option>
          </select>
          <div class="modal-actions student-form-full">
            <p v-if="modalError" class="modal-error" style="margin: 0 0 0 0; flex: 1">{{ modalError }}</p>
            <button class="button ghost" type="button" @click="closeModal">取消</button>
            <button class="button primary sm" type="submit">{{ editing ? '保存修改' : '保存用户' }}</button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { pinyin } from 'pinyin-pro'
import * as schoolApi from '../api/school'

type AnyRow = Record<string, any>

const users = ref<AnyRow[]>([])
const roles = ref<AnyRow[]>([])
const total = ref(0)
const modalVisible = ref(false)
const editing = ref<AnyRow | null>(null)
const modalError = ref('')
const loginNameManuallyEdited = ref(false)
const query = reactive({ keyword: '', status: '', roleCode: '' })
const page = reactive({ current: 1, size: 10 })
const form = reactive({ id: '', realName: '', loginName: '', password: '123456', mobile: '', email: '', roleCodes: [] as string[], status: 1 })

const payload = (res: any) => res?.data?.data ?? res?.data ?? res ?? {}
const rows = (value: any): AnyRow[] => {
  const data = payload(value)
  if (Array.isArray(data)) return data
  return data.records || data.list || data.items || data.content || []
}
const totalOf = (value: any) => {
  const data = payload(value)
  return Number(data.total ?? data.totalElements ?? rows(value).length ?? 0)
}
const call = async (name: string, ...params: any[]) => {
  const fn = (schoolApi as AnyRow)[name]
  return fn ? fn(...params) : []
}
const pageNumbers = computed(() => {
  const count = Math.max(1, Math.ceil(total.value / page.size))
  return Array.from({ length: Math.min(count, 7) }, (_, index) => index + 1)
})
const roleOptions = computed(() => roles.value.filter((role) => !role.isProtected))

function roleText(item: AnyRow) {
  if (Array.isArray(item.roles)) return item.roles.map((role: AnyRow | string) => typeof role === 'string' ? role : role.roleName || role.name).join('、')
  if (typeof item.roleCodes === 'string') {
    return item.roleCodes
      .split(',')
      .map((code: string) => code.trim())
      .filter(Boolean)
      .map((code: string) => roles.value.find((role) => roleCodeOf(role) === code)?.roleName || code)
      .join('、') || '-'
  }
  if (Array.isArray(item.roleCodes)) {
    return item.roleCodes.map((code: string) => roles.value.find((role) => roleCodeOf(role) === code)?.roleName || code).join('、') || '-'
  }
  return item.roleName || item.roleCode || '-'
}
function roleCodeOf(role: AnyRow) {
  return String(role.roleCode || role.code || '')
}
function roleNameOf(role: AnyRow) {
  return role.roleName || role.name || roleCodeOf(role)
}
function formatTime(value: any) {
  if (!value) return '-'
  const str = String(value)
  return str.length >= 16 ? str.substring(0, 16) : str
}
async function loadRoles() {
  roles.value = rows(await call('listRoles'))
}
async function search() {
  const params = {
    page: page.current,
    size: page.size,
    keyword: query.keyword || undefined,
    status: query.status === '' ? undefined : Number(query.status),
    roleCode: query.roleCode || undefined
  }
  const res = await call('listUsers', params)
  users.value = rows(res)
  total.value = totalOf(res)
}
function resetQuery() {
  query.keyword = ''
  query.status = ''
  query.roleCode = ''
  page.current = 1
  search()
}
function goPage(num: number) {
  page.current = num
  search()
}
function resetForm() {
  form.id = ''
  form.realName = ''
  form.loginName = ''
  form.password = ''
  form.mobile = ''
  form.email = ''
  form.roleCodes = []
  form.status = 1
  modalError.value = ''
  loginNameManuallyEdited.value = false
}
function openCreate() {
  editing.value = null
  resetForm()
  form.password = '123456'
  modalVisible.value = true
}
function openEdit(item: AnyRow) {
  editing.value = item
  resetForm()
  form.id = item.id
  form.realName = item.realName || ''
  form.loginName = item.loginName || ''
  form.mobile = item.mobile || ''
  form.email = item.email || ''
  form.roleCodes = parseRoleCodes(item)
  form.status = Number(item.status ?? 1)
  modalVisible.value = true
}
function closeModal() {
  modalVisible.value = false
}
async function uniqueLoginName(base: string) {
  let index = 0
  while (index < 100) {
    const name = index === 0 ? base : `${base}${index}`
    const res = await call('loginNameExists', name)
    const data = payload(res)
    if (!(data === true || data.exists === true)) return name
    index += 1
  }
  return `${base}${Date.now()}`
}
function pinyinBase(name: string) {
  try {
    return pinyin(name, { toneType: 'none', type: 'array' }).join('').toLowerCase().replace(/[^a-z0-9]/g, '') || 'user'
  } catch {
    return ''
  }
}

function generateLoginNameBase() {
  if (loginNameManuallyEdited.value || !form.realName) return
  const base = pinyinBase(form.realName)
  if (base) form.loginName = base
}

async function syncLoginName() {
  if (loginNameManuallyEdited.value || !form.realName) return
  const base = pinyinBase(form.realName)
  if (!base) return
  form.loginName = await uniqueLoginName(base)
}
function validatePassword(pwd: string) {
  if (!pwd) return ''
  if (pwd.length < 10) return '密码长度不能小于10位'
  if (!/[A-Z]/.test(pwd)) return '密码必须包含大写字母'
  if (!/[a-z]/.test(pwd)) return '密码必须包含小写字母'
  if (!/[0-9]/.test(pwd)) return '密码必须包含数字'
  if (!/[^A-Za-z0-9]/.test(pwd)) return '密码必须包含特殊字符'
  return ''
}
function validateForm() {
  if (!form.realName) return '请填写姓名'
  if (!form.loginName) return '请填写账户名'
  if (!editing.value && !form.password) return '请填写初始密码'
  const passwordError = validatePassword(form.password)
  if (passwordError) return passwordError
  if (form.mobile && !/^1[3-9]\d{9}$/.test(form.mobile)) return '手机号码长度或格式不正确'
  if (!form.roleCodes.length) return '请选择角色'
  return ''
}
function parseRoleCodes(item: AnyRow) {
  if (Array.isArray(item.roleCodes)) return item.roleCodes.map(String).filter(Boolean)
  if (typeof item.roleCodes === 'string') return item.roleCodes.split(',').map((code: string) => code.trim()).filter(Boolean)
  if (Array.isArray(item.roles)) {
    return item.roles
      .map((role: AnyRow | string) => (typeof role === 'string' ? role : role.roleCode || role.code))
      .map(String)
      .filter(Boolean)
  }
  return item.roleCode ? [String(item.roleCode)] : []
}
async function submitUser() {
  await syncLoginName()
  modalError.value = validateForm()
  if (modalError.value) return
  const body = {
    id: form.id || undefined,
    realName: form.realName,
    loginName: editing.value ? undefined : form.loginName,
    password: editing.value ? (form.password || undefined) : form.password,
    mobile: form.mobile || undefined,
    email: form.email || undefined,
    status: form.status
  }
  try {
    if (editing.value) {
      await call('updateUser', form.id, body)
      await call('updateUserRoles', form.id, form.roleCodes)
    } else {
      await call('createUser', { ...body, roleCodes: form.roleCodes })
    }
  } catch (e: any) {
    modalError.value = e?.message || '操作失败，请稍后重试'
    return
  }
  modalVisible.value = false
  await search()
}
async function toggleStatus(item: AnyRow) {
    await call('updateUserStatus', item.id, Number(item.status) === 1 ? 0 : 1)
  await search()
}
// Auto-generate login name when realName changes
watch(() => form.realName, () => {
  generateLoginNameBase()
})

onMounted(async () => {
  await loadRoles()
  await search()
})
</script>

<style scoped>
.users-page { display: grid; gap: 20px; }

/* Center button vertically in page header */
.page-header { align-items: center; }

/* Modal form extra spacing override */
.modal-form {
  gap: 18px;
}

/* Role chip hover and active states */
.role-chip:hover,
.role-chip--active {
  color: #0f766e;
  background: #ecfdf5;
  border-color: #0f766e66;
}

.role-chip--active {
  box-shadow: 0 2px 10px #0f766e1a;
}

/* Role chip checkbox accent */
.role-chip input {
  accent-color: #0f766e;
}

/* Modal error inline in actions bar */
.modal-error { color: #b91c1c; font-weight: 800; font-size: 13px; }

@media (max-width: 760px) {
  .user-query-form { grid-template-columns: 1fr; }
  .modal-form { grid-template-columns: 1fr; }
}
</style>
