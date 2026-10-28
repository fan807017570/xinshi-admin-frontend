<template>
  <section class="students-page page">
    <header class="academic-page-header">
      <div class="academic-page-header__copy">
        <p class="eyebrow">教务工作流 · 01</p>
        <h1>学生管理</h1>
        <p class="lead">维护学生档案，并从同一位学生继续处理成绩与成绩单。</p>
      </div>
      <dl class="student-overview" aria-label="学生概览">
        <div><dt>学生总数</dt><dd>{{ total }}</dd></div>
        <div><dt>本页启用</dt><dd>{{ enabledCount }}</dd></div>
        <div><dt>可选班级</dt><dd>{{ availableClasses.length }}</dd></div>
      </dl>
      <div class="academic-page-header__actions">
        <button class="button ghost" type="button" :disabled="loading" @click="search(false)">
          {{ loading ? '刷新中…' : '刷新列表' }}
        </button>
        <button class="button primary" type="button" @click="openCreate">
          <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          新增学生
        </button>
      </div>
    </header>

    <AcademicWorkflowNav current="students" :context="workflowContext" :context-text="workflowContextText" />

    <section class="panel student-filter-panel" aria-labelledby="student-filter-title">
      <div class="panel-head">
        <div>
          <p class="eyebrow">查询范围</p>
          <h2 id="student-filter-title">定位学生</h2>
          <p class="hint">先选择届次和班级，再按姓名或学号缩小范围。</p>
        </div>
        <button v-if="activeFilters.length" class="button ghost sm" type="button" @click="resetQuery">清除全部</button>
      </div>
      <form class="student-filter-grid" @submit.prevent="search(true)">
        <label>
          <span>届次</span>
          <select v-model="query.gradeSession" @change="onSessionChange">
            <option value="">全部届次</option>
            <option v-for="session in sessionOptions" :key="session" :value="session">{{ session }}届</option>
          </select>
        </label>
        <label>
          <span>班级</span>
          <select v-model="query.classId" @change="onClassChange">
            <option value="">全部班级</option>
            <option v-for="klass in availableClasses" :key="klass.id" :value="String(klass.id)">{{ klass.className || klass.name }}</option>
          </select>
        </label>
        <label>
          <span>状态</span>
          <select v-model="query.status" @change="onStatusChange">
            <option value="">全部状态</option>
            <option value="1">启用</option>
            <option value="0">停用</option>
          </select>
        </label>
        <label class="student-filter-keyword">
          <span>学生姓名或学号</span>
          <input v-model.trim="query.keyword" type="search" placeholder="例如：张同学 / 2026…" @input="onKeywordInput" />
        </label>
        <button class="button primary student-filter-submit" type="submit" :disabled="loading">
          {{ loading ? '查询中…' : '查询学生' }}
        </button>
      </form>
      <div v-if="activeFilters.length" class="filter-tags" aria-label="已选筛选条件">
        <span class="filter-tags__label">已选</span>
        <button
          v-for="filter in activeFilters"
          :key="filter.key"
          class="filter-tag"
          type="button"
          :aria-label="`移除筛选：${filter.label}`"
          @click="removeFilter(filter.key)"
        >{{ filter.label }} <span aria-hidden="true">×</span></button>
      </div>
    </section>

    <section class="panel student-list-panel" aria-labelledby="student-list-title" :aria-busy="loading">
      <div class="panel-head student-list-head">
        <div>
          <p class="eyebrow">学生档案</p>
          <h2 id="student-list-title">学生列表</h2>
          <p class="hint">从学生行直接进入成绩录入或成绩单管理，班级与学生条件会自动带入。</p>
        </div>
        <span class="result-count"><strong>{{ total }}</strong> 条记录</span>
      </div>

      <div v-if="loading" class="student-state" aria-live="polite">
        <span class="state-spinner" aria-hidden="true"></span>
        <div><strong>正在加载学生档案</strong><p>正在按当前条件查询，请稍候。</p></div>
      </div>
      <div v-else-if="listError" class="student-state student-state--error" role="alert">
        <span class="state-mark" aria-hidden="true">!</span>
        <div><strong>学生列表加载失败</strong><p>{{ listError }}</p></div>
        <button class="button ghost" type="button" @click="search(false)">重新加载</button>
      </div>
      <div v-else-if="!students.length" class="student-state student-state--empty">
        <svg class="state-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 20v-1.5A3.5 3.5 0 0 0 12.5 15h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM17 8h4M19 6v4" /></svg>
        <div><strong>没有找到学生</strong><p>{{ emptyText }}</p></div>
        <button class="button primary" type="button" @click="openCreate">新增学生</button>
      </div>

      <template v-else>
        <p class="mobile-table-hint">可左右滑动查看完整学生信息。</p>
        <div class="student-table-wrap">
          <table class="student-table">
            <thead>
              <tr><th>学生</th><th>学号</th><th>性别</th><th>班级</th><th>状态</th><th>录入时间</th><th>修改时间</th><th class="student-actions-heading">下一步 / 管理</th></tr>
            </thead>
            <tbody>
              <tr v-for="item in students" :key="item.id">
                <td>
                  <div class="student-identity">
                    <span class="student-avatar" aria-hidden="true">{{ studentInitial(item) }}</span>
                    <div><strong>{{ item.studentName || item.name || '-' }}</strong><small>{{ item.className || '未分班' }}</small></div>
                  </div>
                </td>
                <td class="student-number">{{ item.studentNo || '-' }}</td>
                <td>{{ genderText(item.gender) }}</td>
                <td>{{ item.className || '-' }}</td>
                <td><span :class="['status-pill', Number(item.status) === 1 ? 'on' : 'off']"><span class="status-dot" aria-hidden="true"></span>{{ Number(item.status) === 1 ? '启用' : '停用' }}</span></td>
                <td>{{ formatTime(item.createdAt) }}</td>
                <td>{{ formatTime(item.updatedAt) }}</td>
                <td>
                  <div class="student-row-actions">
                    <button class="row-action row-action--primary" type="button" @click="goScores(item)">成绩</button>
                    <button class="row-action" type="button" @click="goTranscripts(item)">成绩单</button>
                    <button class="row-action" type="button" @click="openEdit(item)">编辑</button>
                    <button class="row-action row-action--danger" type="button" @click="removeStudent(item)">删除</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="student-pagination">
          <div class="student-pagination__summary">
            <span>第 {{ page.current }} / {{ totalPages }} 页</span>
            <label>每页
              <select v-model.number="page.size" @change="changePageSize"><option :value="10">10</option><option :value="20">20</option><option :value="50">50</option><option :value="100">100</option></select>
              条
            </label>
          </div>
          <div class="student-pagination__buttons">
            <button class="button ghost sm" type="button" :disabled="page.current <= 1" @click="goPage(page.current - 1)">上一页</button>
            <button v-for="num in pageNumbers" :key="num" :class="['button', 'sm', num === page.current ? 'primary' : 'ghost']" type="button" @click="goPage(num)">{{ num }}</button>
            <button class="button ghost sm" type="button" :disabled="page.current >= totalPages" @click="goPage(page.current + 1)">下一页</button>
          </div>
        </div>
      </template>
    </section>

    <Teleport to="body">
      <div v-if="modalVisible" class="modal-backdrop" @click.self="closeModal">
        <section class="modal-card student-modal" role="dialog" aria-modal="true" aria-labelledby="student-modal-title">
          <div class="modal-head">
            <div><p class="eyebrow">{{ editing ? '编辑学生' : '新增学生' }}</p><h2 id="student-modal-title">{{ editing ? '修改学生档案' : '录入学生档案' }}</h2></div>
            <button class="button ghost sm icon-button" type="button" aria-label="关闭学生档案弹窗" @click="closeModal"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
          </div>
          <form class="student-modal-form" @submit.prevent="submitStudent">
            <p v-if="modalError" class="student-form-error" role="alert">{{ modalError }}</p>
            <label class="student-modal-form__name"><span>学生姓名 <b aria-hidden="true">*</b></span><input v-model.trim="form.studentName" autocomplete="off" placeholder="请输入学生姓名" /></label>
            <label><span>性别</span><select v-model.number="form.gender"><option :value="0">未知</option><option :value="1">男</option><option :value="2">女</option></select></label>
            <label><span>届次</span><select v-model="form.gradeSession" @change="onModalSessionChange"><option value="">请选择届次</option><option v-for="session in sessionOptions" :key="session" :value="session">{{ session }}届</option></select></label>
            <label><span>所属班级 <b aria-hidden="true">*</b></span><select v-model="form.classId"><option value="">请选择班级</option><option v-for="klass in modalClasses" :key="klass.id" :value="String(klass.id)">{{ klass.className || klass.name }}</option></select></label>
            <label><span>档案状态</span><select v-model.number="form.status"><option :value="1">启用</option><option :value="0">停用</option></select></label>
            <p v-if="!editing" class="student-number-hint">保存后系统会自动生成学号，无需手工填写。</p>
            <div class="modal-actions">
              <button class="button ghost" type="button" @click="closeModal">取消</button>
              <button class="button primary" type="submit" :disabled="savingStudent">{{ savingStudent ? '保存中…' : '保存学生' }}</button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AcademicWorkflowNav from '../components/AcademicWorkflowNav.vue'
import * as schoolApi from '../api/school'

type AnyRow = Record<string, any>
const route = useRoute()
const router = useRouter()
const classes = ref<AnyRow[]>([])
const students = ref<AnyRow[]>([])
const total = ref(0)
const loading = ref(false)
const listError = ref('')
const filterOptions = ref<AnyRow>({})
const modalVisible = ref(false)
const editing = ref<AnyRow | null>(null)
const modalError = ref('')
const savingStudent = ref(false)
const query = reactive({ gradeSession: '', classId: '', status: '', keyword: '' })
const page = reactive({ current: 1, size: 10 })
const form = reactive({ id: '', studentName: '', gender: '', gradeSession: '', classId: '', status: 1 })
let keywordTimer: ReturnType<typeof setTimeout> | null = null

const payload = (res: any) => res?.data?.data ?? res?.data ?? res ?? {}
const rows = (value: any): AnyRow[] => {
  const data = payload(value)
  if (Array.isArray(data)) return data
  return data.records || data.list || data.items || data.content || []
}
const totalOf = (value: any) => Number(payload(value).total ?? rows(value).length ?? 0)
const call = async (name: string, ...params: any[]) => {
  const fn = (schoolApi as AnyRow)[name]
  return fn ? fn(...params) : []
}
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / page.size)))
const pageNumbers = computed(() => {
  const start = Math.max(1, page.current - 2)
  const end = Math.min(totalPages.value, page.current + 2)
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
})
const sessionOptions = computed(() => (filterOptions.value.gradeSessions || []).map((item: any) => String(item)))
const latestSession = computed(() => sessionOptions.value[0] || '')
const sessionClasses = (session: string) => (session ? classes.value.filter((item) => String(item.gradeSession ?? '') === String(session)) : classes.value)
const availableClasses = computed(() => sessionClasses(query.gradeSession))
const modalClasses = computed(() => sessionClasses(form.gradeSession))
const selectedClass = computed(() => classes.value.find((item) => String(item.id) === String(query.classId)))
const enabledCount = computed(() => students.value.filter((item) => Number(item.status) === 1).length)
const workflowContext = computed(() => ({
  gradeSession: query.gradeSession,
  gradeLevel: selectedClass.value?.gradeLevel,
  classId: query.classId
}))
const workflowContextText = computed(() => {
  const parts = [
    query.gradeSession ? `${query.gradeSession}届` : '',
    selectedClass.value?.className || selectedClass.value?.name || ''
  ].filter(Boolean)
  return parts.length ? parts.join(' / ') : '尚未限定届次和班级'
})
const activeFilters = computed(() => {
  const list: Array<{ key: string; label: string }> = []
  if (query.gradeSession) list.push({ key: 'gradeSession', label: `${query.gradeSession}届` })
  if (query.classId) {
    const klass = classes.value.find((item) => String(item.id) === String(query.classId))
    list.push({ key: 'classId', label: `班级：${klass?.className || query.classId}` })
  }
  if (query.status !== '') list.push({ key: 'status', label: `状态：${query.status === '1' ? '启用' : '停用'}` })
  if (query.keyword) list.push({ key: 'keyword', label: `关键词：${query.keyword}` })
  return list
})
const emptyText = computed(() => (activeFilters.value.length ? '当前筛选条件下暂无学生，试试调整届次、班级或关键词' : '暂无学生数据'))

function studentInitial(item: AnyRow) {
  const name = String(item.studentName || item.name || '学')
  return name.slice(-1)
}

function genderText(value: any) {
  if (value === 1 || value === '1' || value === 'M') return '男'
  if (value === 2 || value === '2' || value === 'F') return '女'
  return value || '未知'
}
function formatTime(value: any) {
  if (!value) return '-'
  const str = String(value)
  // 截取到分钟：yyyy-MM-dd HH:mm
  return str.length >= 16 ? str.substring(0, 16) : str
}
function getClassInfo() {
  return classes.value.find((item) => String(item.id) === String(form.classId)) || {}
}
function pad(value: number) {
  return String(value).padStart(2, '0')
}
function generateStudentNo() {
  const now = new Date()
  const klass = getClassInfo()
  const grade = Number(klass.gradeLevel || 0)
  const classNo = Number(klass.classNo || String(klass.className || '').match(/\d+/)?.[0] || 0)
  const random = Math.floor(Math.random() * 1000)
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getMinutes())}${pad(now.getSeconds())}${grade}${classNo}${random}`
}
async function loadClasses() {
  classes.value = rows(await call('listClasses', { page: 1, size: 500 }))
}
async function loadClassFilterOptions() {
  try {
    filterOptions.value = payload(await call('listClassFilterOptions')) || {}
  } catch {
    filterOptions.value = {}
  }
}
function syncRouteQuery() {
  const nextQuery: Record<string, string> = {}
  if (query.gradeSession) nextQuery.gradeSession = query.gradeSession
  if (query.classId) nextQuery.classId = String(query.classId)
  if (query.status !== '') nextQuery.status = query.status
  if (query.keyword) nextQuery.keyword = query.keyword
  router.replace({ path: route.path, query: nextQuery })
}

async function search(resetPage = false) {
  if (resetPage) page.current = 1
  loading.value = true
  listError.value = ''
  try {
    const res = await call('listStudents', {
      page: page.current,
      size: page.size,
      gradeSession: query.gradeSession || undefined,
      classId: query.classId || undefined,
      status: query.status === '' ? undefined : Number(query.status),
      keyword: query.keyword || undefined
    })
    students.value = rows(res)
    total.value = totalOf(res)
    if (page.current > totalPages.value) page.current = totalPages.value
    syncRouteQuery()
  } catch (err) {
    students.value = []
    total.value = 0
    listError.value = err instanceof Error ? err.message : '查询学生失败，请稍后重试'
  } finally {
    loading.value = false
  }
}
function onSessionChange() {
  query.classId = ''
  search(true)
}
function onClassChange() {
  search(true)
}
function onStatusChange() {
  search(true)
}
function onModalSessionChange() {
  form.classId = ''
}
function removeFilter(key: string) {
  if (key === 'gradeSession') query.gradeSession = ''
  else if (key === 'classId') query.classId = ''
  else if (key === 'status') query.status = ''
  else if (key === 'keyword') query.keyword = ''
  search(true)
}
function resetQuery() {
  query.gradeSession = latestSession.value
  query.classId = ''
  query.status = ''
  query.keyword = ''
  search(true)
}
function goPage(num: number) {
  if (num < 1 || num > totalPages.value || num === page.current) return
  page.current = num
  search(false)
}
function changePageSize() {
  search(true)
}
function onKeywordInput() {
  if (keywordTimer) clearTimeout(keywordTimer)
  keywordTimer = setTimeout(() => search(true), 400)
}
function resetForm() {
  form.id = ''
  form.studentName = ''
  form.gender = ''
  form.gradeSession = ''
  form.classId = ''
  form.status = 1
  modalError.value = ''
}
function openCreate() {
  editing.value = null
  resetForm()
  form.gradeSession = query.gradeSession || latestSession.value
  modalVisible.value = true
}
function openEdit(item: AnyRow) {
  editing.value = item
  resetForm()
  form.id = item.id
  form.studentName = item.studentName || item.name || ''
  form.gender = item.gender || ''
  form.classId = item.classId || ''
  const klass = classes.value.find((c) => String(c.id) === String(item.classId))
  form.gradeSession = klass?.gradeSession ?? ''
  form.status = Number(item.status ?? 1)
  modalVisible.value = true
}
function closeModal() {
  modalVisible.value = false
}
function validateForm() {
  if (!form.studentName) return '请填写学生姓名'
  if (!form.classId) return '请选择所属班级'
  return ''
}
async function submitStudent() {
  modalError.value = validateForm()
  if (modalError.value) return
  savingStudent.value = true
  const body = { ...form, classId: Number(form.classId), studentNo: editing.value ? undefined : generateStudentNo() }
  try {
    if (editing.value) await call('updateStudent', form.id, body)
    else await call('createStudent', body)
    modalVisible.value = false
    await search(false)
  } catch (err) {
    modalError.value = err instanceof Error ? err.message : '保存学生失败，请稍后重试'
  } finally {
    savingStudent.value = false
  }
}
async function removeStudent(item: AnyRow) {
  if (!window.confirm(`确定删除${item.studentName || '该学生'}吗？`)) return
  listError.value = ''
  try {
    await call('deleteStudent', item.id)
    await search(false)
  } catch (err) {
    listError.value = err instanceof Error ? err.message : '删除学生失败，请稍后重试'
  }
}
function studentRouteContext(item: AnyRow) {
  const klass = classes.value.find((row) => String(row.id) === String(item.classId)) || {}
  return {
    gradeSession: String(klass.gradeSession || query.gradeSession || ''),
    gradeLevel: klass.gradeLevel ? String(klass.gradeLevel) : undefined,
    classId: String(item.classId || ''),
    studentId: String(item.id)
  }
}

function goScores(item: AnyRow) {
  router.push({ path: '/scores', query: studentRouteContext(item) })
}

function goTranscripts(item: AnyRow) {
  router.push({ path: '/transcripts', query: studentRouteContext(item) })
}

onMounted(async () => {
  await Promise.all([loadClassFilterOptions(), loadClasses()])
  query.gradeSession = String(route.query.gradeSession || latestSession.value || '')
  query.classId = String(route.query.classId || '')
  query.status = String(route.query.status || '')
  query.keyword = String(route.query.keyword || '')
  if (query.classId && !availableClasses.value.some((item) => String(item.id) === query.classId)) query.classId = ''
  await search(false)
})

onUnmounted(() => {
  if (keywordTimer) clearTimeout(keywordTimer)
})
</script>

<style scoped>
.students-page {
  --student-ink: #0f172a;
  --student-text: #334155;
  --student-muted: #64748b;
  --student-line: #e2e8f0;
  --student-primary: #0f766e;
  --student-primary-soft: #ecfdf5;
  color: var(--student-ink);
  display: grid;
  gap: 18px;
  max-width: 1380px;
  min-width: 0;
}

.academic-page-header {
  align-items: center;
  border-bottom: 1px solid var(--student-line);
  display: grid;
  gap: 24px;
  grid-template-columns: minmax(260px, 1fr) auto auto;
  padding: 8px 2px 20px;
}

.academic-page-header h1 {
  font-size: clamp(28px, 3vw, 38px);
  letter-spacing: -.035em;
  line-height: 1.1;
  margin: 7px 0 0;
}

.academic-page-header .lead {
  font-size: 14px;
  line-height: 1.6;
  margin-top: 9px;
}

.academic-page-header__actions,
.student-row-actions,
.student-pagination__buttons,
.modal-actions {
  align-items: center;
  display: flex;
  gap: 8px;
}

.student-overview {
  display: grid;
  grid-template-columns: repeat(3, auto);
  margin: 0;
}

.student-overview div {
  border-left: 1px solid var(--student-line);
  min-width: 88px;
  padding: 2px 16px;
}

.student-overview dt {
  color: var(--student-muted);
  font-size: 11px;
}

.student-overview dd {
  color: var(--student-ink);
  font-size: 24px;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  line-height: 1.15;
  margin: 5px 0 0;
}

.ui-icon,
.state-icon {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.ui-icon { height: 16px; width: 16px; }

.student-filter-panel,
.student-list-panel {
  min-width: 0;
}

.panel-head h2 {
  margin: 5px 0 0;
}

.panel-head .hint {
  line-height: 1.55;
  margin: 6px 0 0;
}

.student-filter-grid {
  align-items: end;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(130px, .8fr) minmax(180px, 1.2fr) minmax(120px, .7fr) minmax(220px, 1.5fr) auto;
}

.student-filter-grid label,
.student-modal-form label {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.student-filter-grid label > span,
.student-modal-form label > span {
  color: var(--student-text);
  font-size: 12px;
  font-weight: 700;
}

.student-modal-form label b {
  color: #b91c1c;
}

.student-filter-submit {
  min-height: 42px;
  white-space: nowrap;
}

.filter-tags {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.filter-tags__label {
  color: var(--student-muted);
  font-size: 11px;
}

.filter-tag {
  background: var(--student-primary-soft);
  border: 1px solid rgba(15, 118, 110, .24);
  border-radius: 999px;
  color: var(--student-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  min-height: 30px;
  padding: 4px 10px;
}

.filter-tag:hover { background: #d1fae5; }
.filter-tag:focus-visible { outline: 3px solid rgba(20, 184, 166, .28); outline-offset: 2px; }

.student-list-head {
  border-bottom: 1px solid var(--student-line);
  margin-bottom: 0;
  padding-bottom: 14px;
}

.result-count {
  color: var(--student-muted);
  font-size: 12px;
  white-space: nowrap;
}

.result-count strong {
  color: var(--student-ink);
  font-size: 20px;
  margin-right: 3px;
}

.student-table-wrap {
  overflow-x: auto;
  scrollbar-color: #cbd5e1 transparent;
}

.student-table {
  border-collapse: collapse;
  min-width: 1040px;
  width: 100%;
}

.student-table th,
.student-table td {
  border-bottom: 1px solid #edf1f5;
  padding: 13px 12px;
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
}

.student-table th {
  background: #f8fafc;
  color: var(--student-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .04em;
  text-transform: uppercase;
}

.student-table tbody tr:hover { background: #f8fafc; }
.student-table tbody tr:last-child td { border-bottom: 0; }

.student-identity {
  align-items: center;
  display: flex;
  gap: 10px;
}

.student-avatar {
  align-items: center;
  background: var(--student-primary-soft);
  border: 1px solid rgba(15, 118, 110, .18);
  border-radius: 10px;
  color: var(--student-primary);
  display: inline-flex;
  flex: 0 0 34px;
  font-size: 14px;
  font-weight: 800;
  height: 34px;
  justify-content: center;
  width: 34px;
}

.student-identity strong,
.student-identity small { display: block; }
.student-identity strong { color: var(--student-ink); font-size: 13px; }
.student-identity small { color: var(--student-muted); font-size: 10px; margin-top: 2px; }
.student-number { color: var(--student-text); font-variant-numeric: tabular-nums; }

.status-pill {
  align-items: center;
  border-radius: 999px;
  display: inline-flex;
  font-size: 11px;
  font-weight: 800;
  gap: 6px;
  padding: 4px 9px;
}

.status-dot { border-radius: 50%; height: 6px; width: 6px; }
.status-pill.on { background: #d1fae5; color: #065f46; }
.status-pill.on .status-dot { background: #059669; }
.status-pill.off { background: #f1f5f9; color: #64748b; }
.status-pill.off .status-dot { background: #94a3b8; }

.student-actions-heading { min-width: 250px; }
.student-row-actions { flex-wrap: wrap; }

.row-action {
  background: #fff;
  border: 1px solid #dbe3ee;
  border-radius: 8px;
  color: var(--student-text);
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
  min-height: 32px;
  padding: 5px 9px;
}

.row-action:hover { background: #f1f5f9; border-color: #cbd5e1; }
.row-action--primary { background: var(--student-primary-soft); border-color: rgba(15, 118, 110, .3); color: var(--student-primary); }
.row-action--danger { color: #b91c1c; }
.row-action--danger:hover { background: #fef2f2; border-color: #fecaca; }
.row-action:focus-visible { outline: 3px solid rgba(20, 184, 166, .28); outline-offset: 2px; }

.student-state {
  align-items: center;
  color: var(--student-text);
  display: flex;
  gap: 14px;
  justify-content: center;
  min-height: 210px;
  padding: 28px;
}

.student-state strong { display: block; font-size: 14px; }
.student-state p { color: var(--student-muted); font-size: 12px; margin: 4px 0 0; }
.student-state--error { background: #fef2f2; justify-content: flex-start; min-height: 112px; }
.student-state--error .button { margin-left: auto; }
.student-state--empty { flex-direction: column; text-align: center; }
.state-icon { color: #94a3b8; height: 34px; width: 34px; }
.state-mark { align-items: center; background: #b91c1c; border-radius: 50%; color: #fff; display: inline-flex; flex: 0 0 26px; font-weight: 800; height: 26px; justify-content: center; }
.state-spinner { animation: student-spin .7s linear infinite; border: 2px solid #cbd5e1; border-radius: 50%; border-top-color: var(--student-primary); height: 24px; width: 24px; }
@keyframes student-spin { to { transform: rotate(360deg); } }

.mobile-table-hint { color: var(--student-muted); display: none; font-size: 11px; margin: 10px 0 0; }

.student-pagination {
  align-items: center;
  border-top: 1px solid var(--student-line);
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding-top: 14px;
}

.student-pagination__summary {
  align-items: center;
  color: var(--student-muted);
  display: flex;
  font-size: 12px;
  gap: 14px;
}

.student-pagination__summary label { align-items: center; display: flex; gap: 6px; }
.student-pagination__summary select { min-height: 32px; padding: 4px 8px; width: auto; }

.student-modal { width: min(680px, 100%); }
.student-modal-form { display: grid; gap: 14px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.student-modal-form__name,
.student-form-error,
.student-number-hint,
.student-modal-form .modal-actions { grid-column: 1 / -1; }
.student-form-error { background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; color: #b91c1c; font-size: 13px; margin: 0; padding: 10px 12px; }
.student-number-hint { background: #f8fafc; border-left: 3px solid var(--student-primary); color: var(--student-muted); font-size: 12px; margin: 0; padding: 10px 12px; }
.student-modal-form .modal-actions { justify-content: flex-end; margin-top: 4px; }
.icon-button { min-height: 38px; min-width: 38px; padding: 8px; }

@media (max-width: 1100px) {
  .academic-page-header { grid-template-columns: minmax(0, 1fr) auto; }
  .student-overview { grid-column: 1; grid-row: 2; }
  .academic-page-header__actions { grid-column: 2; grid-row: 1 / span 2; }
  .student-filter-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .student-filter-submit { width: 100%; }
}

@media (max-width: 760px) {
  .students-page { gap: 14px; }
  .academic-page-header { align-items: start; grid-template-columns: 1fr; gap: 16px; }
  .student-overview,
  .academic-page-header__actions { grid-column: 1; grid-row: auto; }
  .academic-page-header__actions { width: 100%; }
  .academic-page-header__actions .button { flex: 1; min-height: 44px; }
  .student-overview { grid-template-columns: repeat(3, minmax(0, 1fr)); width: 100%; }
  .student-overview div { min-width: 0; padding: 2px 10px; }
  .student-overview div:first-child { border-left: 0; padding-left: 0; }
  .student-filter-grid,
  .student-modal-form { grid-template-columns: 1fr; }
  .student-filter-grid input,
  .student-filter-grid select,
  .student-modal-form input,
  .student-modal-form select { font-size: 16px; min-height: 44px; }
  .student-filter-submit { min-height: 44px; }
  .student-modal-form__name,
  .student-form-error,
  .student-number-hint,
  .student-modal-form .modal-actions { grid-column: auto; }
  .mobile-table-hint { display: block; }
  .student-pagination { align-items: stretch; flex-direction: column; }
  .student-pagination__summary { justify-content: space-between; }
  .student-pagination__buttons { flex-wrap: wrap; }
  .student-pagination__buttons .button { flex: 1; min-height: 40px; }
  .student-state--error { align-items: flex-start; flex-direction: column; }
  .student-state--error .button { margin-left: 0; width: 100%; }
  .student-modal-form .modal-actions { flex-direction: column-reverse; }
  .student-modal-form .modal-actions .button { min-height: 44px; width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .students-page *,
  .students-page *::before,
  .students-page *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
</style>
