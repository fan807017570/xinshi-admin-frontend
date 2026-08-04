<template>
  <section class="students-page">
    <div class="page-hero">
      <div>
        <p class="eyebrow">Student Management</p>
        <h1>班主任学生管理</h1>
        <p>维护学生基础信息，学号由系统自动生成。</p>
      </div>
      <div class="hero-actions">
        <button class="ghost-btn" type="button" @click="search">刷新</button>
        <button class="primary-btn" type="button" @click="openCreate">新增学生</button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><div><p class="eyebrow">Filters</p><h2>查询筛选</h2></div></div>
      <div class="toolbar">
        <select v-model="query.classId"><option value="">全部班级</option><option v-for="klass in classes" :key="klass.id" :value="klass.id">{{ klass.className || klass.name }}</option></select>
        <select v-model="query.status"><option value="">全部状态</option><option value="1">启用</option><option value="0">停用</option></select>
        <input v-model.trim="query.keyword" placeholder="按学号或姓名搜索" @input="onKeywordInput" @keyup.enter="search" />
        <button class="primary-btn" type="button" @click="search">查询</button>
        <button class="ghost-btn" type="button" @click="resetQuery">重置</button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><div><p class="eyebrow">Students</p><h2>学生列表</h2></div></div>
      <table class="data-table">
        <thead><tr><th>学号</th><th>姓名</th><th>性别</th><th>班级</th><th>状态</th><th>录入时间</th><th>修改时间</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="item in students" :key="item.id">
            <td>{{ item.studentNo || '-' }}</td>
            <td>{{ item.studentName || item.name }}</td>
            <td>{{ genderText(item.gender) }}</td>
            <td>{{ item.className || '-' }}</td>
            <td><span :class="['status-pill', Number(item.status) === 1 ? 'on' : 'off']">{{ Number(item.status) === 1 ? '启用' : '停用' }}</span></td>
            <td>{{ formatTime(item.createdAt) }}</td>
            <td>{{ formatTime(item.updatedAt) }}</td>
            <td class="actions">
              <button class="link-btn" type="button" @click="goScores(item)">成绩</button>
              <button class="link-btn" type="button" @click="openEdit(item)">修改</button>
              <button class="link-btn danger" type="button" @click="removeStudent(item)">删除</button>
              <button class="link-btn" type="button" @click="openTranscript(item)">成绩单</button>
            </td>
          </tr>
          <tr v-if="!students.length"><td colspan="8" class="empty">暂无学生数据</td></tr>
        </tbody>
      </table>
      <div class="pagination">
        <span>共 {{ total }} 条</span>
        <select v-model.number="page.size" @change="search"><option :value="10">10</option><option :value="20">20</option><option :value="50">50</option><option :value="100">100</option></select>
        <button v-for="num in pageNumbers" :key="num" :class="{ active: num === page.current }" type="button" @click="goPage(num)">{{ num }}</button>
      </div>
    </div>

    <div v-if="modalVisible" class="modal-mask" @click.self="closeModal">
      <div class="modal-card">
        <div class="modal-head">
          <div><p class="eyebrow">{{ editing ? '编辑学生' : '新增学生' }}</p><h2>{{ editing ? '修改学生信息' : '录入学生信息' }}</h2></div>
          <button class="close-btn" type="button" @click="closeModal">关闭</button>
        </div>
        <div class="modal-form">
          <input v-model.trim="form.studentName" placeholder="学生姓名" />
          <select v-model.number="form.gender"><option :value="0">未知</option><option :value="1">男</option><option :value="2">女</option></select>
          <select v-model="form.classId"><option value="">所属班级（必选）</option><option v-for="klass in classes" :key="klass.id" :value="klass.id">{{ klass.className || klass.name }}</option></select>
          <select v-model.number="form.status"><option :value="1">启用</option><option :value="0">停用</option></select>
        </div>
        <p v-if="!editing" class="hint">学号将按 年月日分秒 + 年级 + 班级 + 1000以内随机数 自动生成。</p>
        <p v-if="modalError" class="modal-error">{{ modalError }}</p>
        <div class="modal-actions">
          <button class="ghost-btn" type="button" @click="closeModal">取消</button>
          <button class="primary-btn" type="button" @click="submitStudent">保存学生</button>
        </div>
      </div>
    </div>

    <DownloadProgress :visible="downloadVisible" :percent="downloadPercent" @cancel="cancelDownload" />

    <Teleport to="body">
      <div v-if="transcriptVisible" class="modal-mask" @click.self="closeTranscript">
        <div class="modal-card" role="dialog" aria-modal="true">
          <div class="modal-head">
            <div>
              <p class="eyebrow">成绩单生成</p>
              <h2>生成成绩单 - {{ transcriptStudent?.studentName || transcriptStudent?.name || '' }}</h2>
            </div>
            <button class="close-btn" type="button" @click="closeTranscript">关闭</button>
          </div>

          <div v-if="transcriptGenerating" class="modal-state">
            <p>正在生成成绩单，请稍候…</p>
          </div>

          <div v-else-if="transcriptError" class="modal-body">
            <p class="modal-error">生成失败：{{ transcriptError }}</p>
            <div class="modal-actions">
              <button class="ghost-btn" type="button" @click="closeTranscript">关闭</button>
              <button class="primary-btn" type="button" @click="submitTranscript">重试</button>
            </div>
          </div>

          <div v-else-if="transcriptResult" class="modal-body">
            <p class="transcript-success">成绩单已生成</p>
            <div class="transcript-detail">
              <div><strong>{{ transcriptResult.transcriptNo || '-' }}</strong></div>
              <div>学生：{{ transcriptResult.studentName || '-' }}</div>
              <div>班级：{{ transcriptResult.className || '-' }}</div>
              <div>文件：{{ transcriptResult.pdfFileName || '-' }}</div>
              <div v-if="transcriptResult.generatedAt">生成时间：{{ transcriptResult.generatedAt }}</div>
            </div>
            <div class="modal-actions">
              <button class="ghost-btn" type="button" @click="closeTranscript">关闭</button>
              <button
                class="primary-btn"
                type="button"
                :disabled="transcriptDownloading"
                @click="downloadTranscriptResult"
              >{{ transcriptDownloading ? '下载中…' : '下载成绩单' }}</button>
            </div>
          </div>

          <div v-else class="modal-form">
            <select v-model="transcriptTermId">
              <option value="">选择学期（必选）</option>
              <option v-for="term in terms" :key="term.id" :value="term.id">{{ term.termName || term.name }}</option>
            </select>
            <select v-model="transcriptExamTypeId">
              <option value="">考试类型（可选）</option>
              <option v-for="et in examTypes" :key="et.id" :value="et.id">{{ et.examTypeName || et.name }}</option>
            </select>
            <div class="modal-actions">
              <button class="ghost-btn" type="button" @click="closeTranscript">取消</button>
              <button class="primary-btn" type="button" @click="submitTranscript">生成成绩单</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import DownloadProgress from '../components/DownloadProgress.vue'
import * as schoolApi from '../api/school'

type AnyRow = Record<string, any>
const router = useRouter()
const classes = ref<AnyRow[]>([])
const students = ref<AnyRow[]>([])
const total = ref(0)
const modalVisible = ref(false)
const editing = ref<AnyRow | null>(null)
const modalError = ref('')
const transcriptVisible = ref(false)
const transcriptGenerating = ref(false)
const transcriptDownloading = ref(false)
const transcriptError = ref('')
const transcriptResult = ref<AnyRow | null>(null)
const transcriptStudent = ref<AnyRow | null>(null)
const transcriptTermId = ref('')
const transcriptExamTypeId = ref('')
const downloadVisible = ref(false)
const downloadPercent = ref(0)
const downloadAbortController = ref<AbortController | null>(null)
const terms = ref<AnyRow[]>([])
const examTypes = ref<AnyRow[]>([])
const query = reactive({ classId: '', status: '', keyword: '' })
const page = reactive({ current: 1, size: 10 })
const form = reactive({ id: '', studentName: '', gender: '', classId: '', status: 1 })
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
const pageNumbers = computed(() => Array.from({ length: Math.min(Math.max(1, Math.ceil(total.value / page.size)), 7) }, (_, i) => i + 1))

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
async function search() {
  const res = await call('listStudents', {
    page: page.current,
    size: page.size,
    classId: query.classId || undefined,
    status: query.status === '' ? undefined : Number(query.status),
    keyword: query.keyword || undefined
  })
  students.value = rows(res)
  total.value = totalOf(res)
}
function resetQuery() {
  query.classId = ''
  query.status = ''
  query.keyword = ''
  page.current = 1
  search()
}
function goPage(num: number) {
  page.current = num
  search()
}
function onKeywordInput() {
  if (keywordTimer) clearTimeout(keywordTimer)
  keywordTimer = setTimeout(() => search(), 400)
}
function resetForm() {
  form.id = ''
  form.studentName = ''
  form.gender = ''
  form.classId = ''
  form.status = 1
  modalError.value = ''
}
function openCreate() {
  editing.value = null
  resetForm()
  modalVisible.value = true
}
function openEdit(item: AnyRow) {
  editing.value = item
  resetForm()
  form.id = item.id
  form.studentName = item.studentName || item.name || ''
  form.gender = item.gender || ''
  form.classId = item.classId || ''
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
  const body = { ...form, classId: Number(form.classId), studentNo: editing.value ? undefined : generateStudentNo() }
  if (editing.value) await call('updateStudent', form.id, body)
  else await call('createStudent', body)
  modalVisible.value = false
  await search()
}
async function removeStudent(item: AnyRow) {
  if (!window.confirm(`确定删除${item.studentName || '该学生'}吗？`)) return
  await call('deleteStudent', item.id)
  await search()
}
function goScores(item: AnyRow) {
  router.push({ path: '/scores', query: { classId: String(item.classId), studentId: String(item.id) } })
}

async function loadTranscriptRefs() {
  try { terms.value = rows(await call('listAcademicTerms')) } catch { terms.value = [] }
  try { examTypes.value = rows(await call('listExamTypes')) } catch { examTypes.value = [] }
}

function openTranscript(item: AnyRow) {
  transcriptStudent.value = item
  transcriptTermId.value = ''
  transcriptExamTypeId.value = ''
  transcriptError.value = ''
  transcriptResult.value = null
  transcriptVisible.value = true
  loadTranscriptRefs()
}

async function submitTranscript() {
  if (!transcriptTermId.value) { transcriptError.value = '请选择学期'; return }
  transcriptGenerating.value = true
  transcriptError.value = ''
  transcriptResult.value = null
  try {
    transcriptResult.value = payload(await call('createTranscript', {
      academicTermId: Number(transcriptTermId.value),
      classId: Number(transcriptStudent.value!.classId),
      studentId: Number(transcriptStudent.value!.id),
      examTypeId: transcriptExamTypeId.value ? Number(transcriptExamTypeId.value) : undefined,
    }))
  } catch (err) {
    transcriptError.value = err instanceof Error ? err.message : '生成失败'
  } finally {
    transcriptGenerating.value = false
  }
}

function closeTranscript() {
  transcriptVisible.value = false
  transcriptResult.value = null
  transcriptError.value = ''
}

async function downloadTranscriptResult() {
  if (!transcriptResult.value) return
  transcriptDownloading.value = true
  downloadPercent.value = 0
  downloadVisible.value = true
  const controller = new AbortController()
  downloadAbortController.value = controller
  try {
    const res = await call('downloadTranscript', transcriptResult.value.id, {
      signal: controller.signal,
      onProgress: (percent: number) => {
        downloadPercent.value = percent
      }
    })
    const blob = res?.data instanceof Blob ? res.data : new Blob([res?.data ?? res], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = transcriptResult.value.pdfFileName || '成绩单.pdf'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      transcriptError.value = err instanceof Error ? err.message : '下载失败'
    }
  } finally {
    downloadVisible.value = false
    transcriptDownloading.value = false
    downloadAbortController.value = null
  }
}

function cancelDownload() {
  downloadAbortController.value?.abort()
}

onMounted(async () => {
  await loadClasses()
  await search()
})
</script>

<style scoped>
.students-page { display: grid; gap: 20px; color: #1f2937; }
.page-hero, .panel { border: 1px solid #e2e8f0eb; border-radius: 20px; background: #ffffffeb; box-shadow: 0 18px 40px #0f172a0d; }
.page-hero { display: flex; justify-content: space-between; align-items: center; gap: 18px; padding: 28px 32px; }
.page-hero h1 { margin: 6px 0 8px; color: #111827; font-size: 30px; }
.page-hero p { margin: 0; color: #6b7280; }
.hero-actions, .actions { display: flex; gap: 10px; }
.eyebrow { margin: 0; color: #0f766e; font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.panel { padding: 22px; }
.panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.panel-head h2 { margin: 4px 0 0; color: #111827; font-size: 20px; }
.toolbar, .modal-form { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 12px; }
input, select { height: 40px; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 0 12px; color: #111827; background: #fff; outline: none; }
input:focus, select:focus { border-color: #0f766e; box-shadow: 0 0 0 3px #0f766e1f; }
.primary-btn, .ghost-btn, .link-btn, .close-btn { border-radius: 10px; font-weight: 700; cursor: pointer; }
.primary-btn { height: 40px; border: 0; padding: 0 18px; color: #fff; background: linear-gradient(135deg, #0f766e, #0f9f8e); box-shadow: 0 12px 24px #0f766e38; }
.ghost-btn, .close-btn { height: 40px; border: 1px solid #dbe3ee; padding: 0 16px; color: #374151; background: #fff; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th { text-align: left; color: #64748b; font-weight: 800; background: #f8fafc; }
.data-table td { text-align: left; color: #1f2937; }
.data-table th, .data-table td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
.link-btn { height: 32px; border: 1px solid #dbe3ee; padding: 0 12px; color: #0f766e; background: #fff; }
.link-btn.danger { color: #b91c1c; }
.status-pill { display: inline-flex; padding: 4px 10px; border-radius: 999px; font-weight: 800; font-size: 13px; }
.status-pill.on { color: #065f46; background: #d1fae5; }
.status-pill.off { color: #64748b; background: #f1f5f9; }
.empty { text-align: center !important; color: #9ca3af !important; }
.pagination { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 16px; color: #4b5563; }
.pagination button { min-width: 34px; height: 34px; border: 1px solid #dbe3ee; border-radius: 8px; background: #fff; cursor: pointer; }
.pagination button.active { color: #fff; border-color: #0f766e; background: #0f766e; }
.pagination select { width: 76px; height: 34px; }
.modal-mask { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 24px; background: rgba(15,23,42,.42); }
.modal-card { width: min(720px,100%); border-radius: 20px; background: #fff; box-shadow: 0 28px 70px rgba(15,23,42,.24); padding: 24px; }
.modal-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 16px; }
.modal-head h2 { margin: 4px 0 0; color: #111827; font-size: 22px; }
.modal-form { grid-template-columns: repeat(2, minmax(0,1fr)); }
.hint { margin: 12px 0 0; color: #6b7280; font-weight: 700; }
.modal-error { margin: 12px 0 0; color: #b91c1c; font-weight: 800; }
.transcript-success { color: #065f46; font-weight: 800; margin: 0 0 12px; }
.transcript-detail { margin-bottom: 16px; display: grid; gap: 6px; }
.transcript-detail div { color: #1f2937; }
.modal-state { padding: 24px 0; text-align: center; color: #6b7280; }
.modal-body { padding: 4px 0; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.page-hero { padding: 24px; }
.page-hero h1 { margin: 4px 0 0; color: #0f172a; font-size: 32px; line-height: 1.15; }
.page-hero p { margin: 10px 0 0; color: #64748b; font-size: 14px; }
.panel { padding: 18px; }
.panel-head { align-items: flex-start; margin-bottom: 14px; }
.panel-head h2 { margin: 0 0 14px; color: #0f172a; font-size: 18px; }
input, select { height: auto; min-height: 42px; border: 1px solid #dbe3ee; border-radius: 14px; padding: 11px 13px; font-size: 14px; }
input:focus, select:focus { border-color: #0f766e; box-shadow: none; outline: 3px solid #14b8a629; }
.primary-btn, .ghost-btn, .link-btn, .close-btn { border-radius: 11px; font-size: 13px; font-weight: 700; transition: transform .15s, box-shadow .15s, background .15s; }
.primary-btn { height: auto; border: 1px solid #0f766e; padding: 9px 13px; }
.ghost-btn, .close-btn { height: auto; padding: 9px 13px; color: #0f172a; background: #f8fafc; }
.close-btn, .link-btn { border-radius: 9px; padding: 6px 11px; font-size: 12px; }
.link-btn { height: auto; color: #0f172a; background: #f8fafc; }
.link-btn.danger { color: #b91c1c; }
.data-table th { color: #64748b; font-size: 13px; font-weight: 700; }
.data-table th, .data-table td { padding: 14px 16px; border-bottom: 1px solid #e5e7eb; }
.modal-card { border: 1px solid #e2e8f0eb; border-radius: 24px; box-shadow: 0 30px 80px #0f172a47; padding: 22px; }
.modal-head h2 { color: #0f172a; font-size: 24px; }
.hint { color: #64748b; font-size: 13px; font-weight: 400; }
@media (max-width: 860px) { .toolbar, .modal-form { grid-template-columns: 1fr; } .page-hero { align-items: flex-start; flex-direction: column; } }
</style>
