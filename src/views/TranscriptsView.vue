<template>
  <section class="page transcripts-page">
    <header class="academic-page-header">
      <div class="academic-page-header__copy">
        <p class="eyebrow">教务工作流 · 03</p>
        <h1>成绩单管理</h1>
        <p class="lead">基于学生成绩与综合评价生成 PDF，并集中下载和重新生成。</p>
      </div>
      <div class="transcript-overview" aria-live="polite">
        <span>当前记录</span>
        <strong>{{ total }}</strong>
      </div>
      <button class="button ghost" type="button" :disabled="loading" @click="loadPage">{{ loading ? '刷新中…' : '刷新数据' }}</button>
    </header>

    <AcademicWorkflowNav current="transcripts" :context="workflowContext" :context-text="workflowContextText" />

    <section class="panel transcript-filter-panel" aria-labelledby="transcript-filter-title">
      <div class="panel-head">
        <div>
          <p class="eyebrow">归档范围</p>
          <h2 id="transcript-filter-title">定位成绩单</h2>
          <p class="hint">学期、届次、班级和学生用于查询；考试类型仅限定新生成成绩单的范围。</p>
        </div>
        <span class="filter-status">{{ generationReady ? '已具备生成条件' : '请选择学期、班级和学生' }}</span>
      </div>
      <form class="transcript-filter-grid" @submit.prevent="search(true)">
        <label><span>学期</span><select v-model="query.academicTermId" @change="search(true)"><option value="">请选择学期</option><option v-for="term in terms" :key="term.id" :value="String(term.id)">{{ term.termName || term.name }}</option></select></label>
        <label><span>届次</span><select v-model="query.gradeSession" @change="handleSessionChange"><option value="">全部届次</option><option v-for="session in sessionOptions" :key="session" :value="session">{{ session }}届</option></select></label>
        <label><span>班级</span><select v-model="query.classId" @change="handleClassChange"><option value="">请选择班级</option><option v-for="klass in availableClasses" :key="klass.id" :value="String(klass.id)">{{ klass.className || klass.name }}</option></select></label>
        <label><span>生成考试类型</span><select v-model="query.examTypeId" @change="syncRouteQuery"><option value="">全部考试类型</option><option v-for="type in examTypes" :key="type.id" :value="String(type.id)">{{ type.examTypeName || type.name }}</option></select></label>
        <div class="transcript-student-field">
          <label for="transcript-student-search">学生</label>
          <div class="transcript-student-search">
            <input
              id="transcript-student-search"
              v-model.trim="studentKeyword"
              :class="{ 'has-clear': query.studentId }"
              type="search"
              role="combobox"
              aria-autocomplete="list"
              aria-controls="transcript-student-options"
              aria-describedby="transcript-student-help"
              :aria-expanded="studentSuggestionsOpen"
              :aria-activedescendant="activeStudentIndex >= 0 ? `transcript-student-option-${studentSuggestions[activeStudentIndex]?.id}` : undefined"
              :disabled="!query.classId"
              :placeholder="query.classId ? '输入学生姓名或学号' : '请先选择班级'"
              autocomplete="off"
              @input="onStudentKeywordInput"
              @focus="onStudentSearchFocus"
              @blur="scheduleStudentSuggestionsClose"
              @keydown.down.prevent="moveStudentSuggestion(1)"
              @keydown.up.prevent="moveStudentSuggestion(-1)"
              @keydown.enter.prevent="selectActiveStudent"
              @keydown.esc="closeStudentSuggestions"
            />
            <button v-if="query.studentId" class="student-search-clear" type="button" aria-label="清除已选择学生" @mousedown.prevent @click="clearSelectedStudent">清除</button>
            <div v-if="studentSuggestionsOpen" id="transcript-student-options" class="transcript-student-suggestions" role="listbox" aria-label="学生搜索结果">
              <p v-if="studentSearchLoading" class="student-suggestion-state">正在搜索学生…</p>
              <p v-else-if="studentSearchError" class="student-suggestion-state student-suggestion-state--error">{{ studentSearchError }}</p>
              <button
                v-for="(student, index) in studentSuggestions"
                v-else
                :id="`transcript-student-option-${student.id}`"
                :key="student.id"
                :class="{ active: index === activeStudentIndex }"
                type="button"
                role="option"
                :aria-selected="index === activeStudentIndex"
                @mousedown.prevent
                @mouseenter="activeStudentIndex = index"
                @click="selectTranscriptStudent(student)"
              >
                <span><strong>{{ student.studentName || student.name }}</strong><small>{{ student.studentNo || '暂无学号' }}</small></span>
                <small>{{ student.className || selectedClass?.className || '当前班级' }}</small>
              </button>
              <p v-if="!studentSearchLoading && !studentSearchError && !studentSuggestions.length" class="student-suggestion-state">未找到匹配学生，请尝试姓名或学号中的其他字符。</p>
            </div>
          </div>
          <small id="transcript-student-help" class="student-search-help">{{ query.studentId ? `已选择：${selectedStudentName}` : '输入关键词后从候选结果中选择学生' }}</small>
        </div>
        <button class="button primary transcript-filter-submit" type="submit" :disabled="loading">{{ loading ? '查询中…' : '查询成绩单' }}</button>
      </form>
    </section>

    <section v-if="canManageTranscripts" class="transcript-generate-band" aria-labelledby="generate-transcript-title">
      <div>
        <p class="eyebrow">当前生成对象</p>
        <h2 id="generate-transcript-title">{{ selectedStudentName || '尚未选择学生' }}</h2>
        <p>{{ generationContextText }}</p>
      </div>
      <label class="generator-field"><span>生成者用户 ID（可选）</span><input v-model.trim="query.generatedByUserId" inputmode="numeric" placeholder="默认使用当前账号" /></label>
      <button class="button primary" type="button" :disabled="!generationReady || generating" @click="submitGenerate">
        {{ generating ? '正在生成…' : '生成成绩单 PDF' }}
      </button>
    </section>
    <section v-else class="transcript-readonly-note">
      <strong>当前为只读模式</strong>
      <p>可以查询和下载历史成绩单，但不能生成或重新生成。</p>
    </section>

    <p v-if="success" class="success" role="status">{{ success }}</p>

    <section class="panel transcript-list-panel" aria-labelledby="transcript-list-title" :aria-busy="loading">
      <div class="panel-head transcript-list-head">
        <div><p class="eyebrow">PDF 归档</p><h2 id="transcript-list-title">成绩单记录</h2><p class="hint">下载已有文件，或在成绩数据更新后重新生成。</p></div>
        <span class="result-count"><strong>{{ total }}</strong> 份</span>
      </div>

      <div v-if="loading" class="transcript-state"><span class="state-spinner" aria-hidden="true"></span><div><strong>正在加载成绩单</strong><p>正在读取当前筛选范围内的归档记录。</p></div></div>
      <div v-else-if="error" class="transcript-state transcript-state--error" role="alert"><span class="state-mark" aria-hidden="true">!</span><div><strong>成绩单加载失败</strong><p>{{ error }}</p></div><button class="button ghost" type="button" @click="search(false)">重新加载</button></div>
      <div v-else-if="!transcripts.length" class="transcript-state transcript-state--empty"><svg class="state-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6zM14 3v5h5M9 13h6M9 17h4" /></svg><div><strong>暂无成绩单记录</strong><p>选择学期、班级和学生后可以生成第一份成绩单。</p></div></div>
      <template v-else>
        <p class="mobile-table-hint">可左右滑动查看完整成绩单信息。</p>
        <div class="transcript-table-wrap">
          <table class="transcript-table">
            <thead><tr><th>成绩单编号</th><th>学生</th><th>班级</th><th>文件</th><th>生成时间</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="item in transcripts" :key="item.id">
                <td><strong class="transcript-number">{{ item.transcriptNo || '-' }}</strong></td>
                <td>{{ item.studentName || '-' }}</td>
                <td>{{ item.className || '-' }}</td>
                <td class="transcript-file">{{ item.pdfFileName || '-' }}</td>
                <td>{{ formatTime(item.generatedAt) }}</td>
                <td><div class="transcript-row-actions">
                  <button v-if="item.classId && item.studentId" class="button ghost sm" type="button" @click="goScoresForTranscript(item)">查看成绩</button>
                  <button class="button primary sm" type="button" :disabled="downloadingIds.has(item.id)" @click="downloadById(item.id)">{{ downloadingIds.has(item.id) ? '下载中…' : '下载 PDF' }}</button>
                  <button v-if="canManageTranscripts" class="button ghost sm" type="button" :disabled="regeneratingIds.has(item.id)" @click="submitRegenerate(item.id)">{{ regeneratingIds.has(item.id) ? '生成中…' : '重新生成' }}</button>
                </div></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="pagination">
          <div class="pagination-left"><span class="pagination-info">共 {{ total }} 条，第 {{ page.current }}/{{ totalPages }} 页</span><label class="pagination-size-label">每页<select v-model.number="page.size" class="pagination-size-select" @change="changePageSize"><option :value="10">10</option><option :value="20">20</option><option :value="50">50</option><option :value="100">100</option></select>条</label></div>
          <div class="pagination-buttons">
            <button class="button ghost sm" type="button" :disabled="page.current <= 1" @click="goPage(page.current - 1)">上一页</button>
            <button v-for="num in pageNumbers" :key="num" :class="['button', 'sm', num === page.current ? 'primary' : 'ghost']" type="button" @click="goPage(num)">{{ num }}</button>
            <button class="button ghost sm" type="button" :disabled="page.current >= totalPages" @click="goPage(page.current + 1)">下一页</button>
          </div>
        </div>
      </template>
    </section>

    <DownloadProgress :visible="downloadVisible" :percent="downloadPercent" @cancel="cancelDownload" />

    <Teleport to="body">
      <div v-if="regenerateVisible" class="modal-backdrop" @click.self="closeRegenerateModal">
        <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="regenerate-title">
          <div class="modal-head">
            <div>
              <p class="eyebrow">成绩单管理</p>
              <h2 id="regenerate-title">重新生成成绩单</h2>
            </div>
            <button class="button ghost sm" type="button" @click="closeRegenerateModal">关闭</button>
          </div>
          <div v-if="regenerating" class="modal-state">
            <p>正在重新生成成绩单，请稍候…</p>
          </div>
          <div v-else-if="regenerateError" class="modal-body">
            <p class="error">{{ regenerateError }}</p>
            <div class="modal-actions">
              <button class="button ghost sm" type="button" @click="closeRegenerateModal">关闭</button>
              <button class="button primary sm" type="button" @click="retryRegenerate">重试</button>
            </div>
          </div>
          <ResultPanel
            v-else-if="regeneratedTranscript"
            success-text="成绩单已重新生成"
            :item="regeneratedTranscript"
            :downloading="resultDownloading"
            :percent="resultDownloadPercent"
            @close="closeRegenerateModal"
            @download="downloadResult(regeneratedTranscript)"
          />
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="generateVisible" class="modal-backdrop" @click.self="closeGenerateModal">
        <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="generate-title">
          <div class="modal-head">
            <div>
              <p class="eyebrow">成绩单管理</p>
              <h2 id="generate-title">生成成绩单</h2>
            </div>
            <button class="button ghost sm" type="button" @click="closeGenerateModal">关闭</button>
          </div>
          <div v-if="generating" class="modal-state">
            <p>正在生成成绩单，请稍候…</p>
          </div>
          <div v-else-if="generateError" class="modal-body">
            <p class="error preserve-error">{{ generateError }}</p>
            <div class="modal-actions">
              <button class="button ghost sm" type="button" @click="closeGenerateModal">关闭</button>
              <button class="button primary sm" type="button" @click="submitGenerate">重试</button>
            </div>
          </div>
          <ResultPanel
            v-else-if="generatedTranscript"
            success-text="成绩单已生成"
            :item="generatedTranscript"
            :downloading="resultDownloading"
            :percent="resultDownloadPercent"
            @close="closeGenerateModal"
            @download="downloadResult(generatedTranscript)"
          />
        </section>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AcademicWorkflowNav from '../components/AcademicWorkflowNav.vue'
import DownloadProgress from '../components/DownloadProgress.vue'
import { useAuthStore } from '../stores/auth'
import * as schoolApi from '../api/school'

type AnyRow = Record<string, any>

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const canManageTranscripts = computed(() => auth.canManageTranscripts)
const terms = ref<AnyRow[]>([])
const classes = ref<AnyRow[]>([])
const students = ref<AnyRow[]>([])
const studentKeyword = ref('')
const studentSuggestions = ref<AnyRow[]>([])
const studentSuggestionsOpen = ref(false)
const studentSearchLoading = ref(false)
const studentSearchError = ref('')
const activeStudentIndex = ref(-1)
const examTypes = ref<AnyRow[]>([])
const transcripts = ref<AnyRow[]>([])
const loading = ref(false)
const error = ref('')
const success = ref('')
const downloadingIds = ref(new Set<any>())
const regeneratingIds = ref(new Set<any>())
const downloadVisible = ref(false)
const downloadPercent = ref(0)
const downloadAbortController = ref<AbortController | null>(null)
const generateVisible = ref(false)
const generating = ref(false)
const generateError = ref('')
const generatedTranscript = ref<AnyRow | null>(null)
const regenerateVisible = ref(false)
const regenerating = ref(false)
const regenerateError = ref('')
const regeneratedTranscript = ref<AnyRow | null>(null)
const activeRegenerateId = ref<any>(null)
const resultDownloading = ref(false)
const resultDownloadPercent = ref(0)
const total = ref(0)
const explicitTotalPages = ref(0)
const page = reactive({ current: 1, size: 10 })
const query = reactive({
  academicTermId: '',
  gradeSession: '',
  classId: '',
  studentId: '',
  examTypeId: '',
  generatedByUserId: ''
})
const filterOptions = ref<AnyRow>({})
let studentSearchTimer: ReturnType<typeof setTimeout> | null = null
let studentCloseTimer: ReturnType<typeof setTimeout> | null = null
let studentSearchRequest = 0
const sessionOptions = computed(() => (filterOptions.value.gradeSessions || []).map((item: any) => String(item)))
const latestSession = computed(() => sessionOptions.value[0] || '')
const availableClasses = computed(() =>
  query.gradeSession
    ? classes.value.filter((item) => String(item.gradeSession ?? '') === String(query.gradeSession))
    : classes.value
)
const selectedTerm = computed(() => terms.value.find((item) => String(item.id) === String(query.academicTermId)))
const selectedClass = computed(() => classes.value.find((item) => String(item.id) === String(query.classId)))
const selectedStudent = computed(() => students.value.find((item) => String(item.id) === String(query.studentId)))
const selectedStudentName = computed(() => String(selectedStudent.value?.studentName || selectedStudent.value?.name || ''))
const generationReady = computed(() => Boolean(query.academicTermId && query.classId && query.studentId))
const workflowContext = computed(() => ({
  academicTermId: query.academicTermId,
  gradeSession: query.gradeSession,
  gradeLevel: selectedClass.value?.gradeLevel,
  classId: query.classId,
  studentId: query.studentId,
  examTypeId: query.examTypeId
}))
const workflowContextText = computed(() => {
  const parts = [
    selectedTerm.value?.termName || selectedTerm.value?.name || '',
    query.gradeSession ? `${query.gradeSession}届` : '',
    selectedClass.value?.className || selectedClass.value?.name || '',
    selectedStudentName.value
  ].filter(Boolean)
  return parts.length ? parts.join(' / ') : '尚未选择成绩单范围'
})
const generationContextText = computed(() => {
  if (!generationReady.value) return '请在上方依次选择学期、班级和学生。'
  const exam = examTypes.value.find((item) => String(item.id) === String(query.examTypeId))
  return [
    selectedTerm.value?.termName || selectedTerm.value?.name,
    selectedClass.value?.className || selectedClass.value?.name,
    exam?.examTypeName || exam?.name || '全部考试类型'
  ].filter(Boolean).join(' / ')
})

const payload = (res: any) => res?.data?.data ?? res?.data ?? res ?? {}
const rows = (value: any): AnyRow[] => {
  const data = payload(value)
  if (Array.isArray(data)) return data
  return data.items || data.records || data.list || data.content || []
}
const totalOf = (value: any) => Number(payload(value).total ?? rows(value).length ?? 0)
const totalPagesOf = (value: any) => Number(payload(value).totalPages ?? 0)
const call = async (name: string, ...params: any[]) => {
  const fn = (schoolApi as AnyRow)[name]
  return fn ? fn(...params) : []
}
const totalPages = computed(() => Math.max(1, explicitTotalPages.value || Math.ceil(total.value / page.size)))
const pageNumbers = computed(() => {
  const start = Math.max(1, page.current - 2)
  const end = Math.min(totalPages.value, page.current + 2)
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
})

async function loadBase() {
  const [termRes, classRes, examRes, filterRes] = await Promise.all([
    call('listAcademicTerms').catch(() => []),
    call('listClasses', { page: 1, size: 200 }).catch(() => []),
    call('listExamTypes').catch(() => []),
    call('listClassFilterOptions').catch(() => ({}))
  ])
  terms.value = rows(termRes)
  classes.value = rows(classRes)
  examTypes.value = rows(examRes)
  filterOptions.value = payload(filterRes) || {}
  if (!query.academicTermId) {
    const activeTerm = terms.value.find((item) => Number(item.status) === 1) || terms.value[0]
    if (activeTerm) query.academicTermId = String(activeTerm.id)
  }
  if (!query.gradeSession) {
    query.gradeSession = latestSession.value
  }
}

async function loadStudents() {
  if (!query.classId) {
    students.value = []
    studentKeyword.value = ''
    return
  }
  students.value = rows(await call('listStudents', { classId: Number(query.classId), page: 1, size: 500 }))
  if (query.studentId && !students.value.some((student) => String(student.id) === String(query.studentId))) {
    query.studentId = ''
    studentKeyword.value = ''
  } else if (query.studentId) {
    studentKeyword.value = selectedStudentName.value
  }
}

async function loadPage() {
  loading.value = true
  error.value = ''
  try {
    await loadBase()
    await loadStudents()
    await search(false)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function syncRouteQuery() {
  const nextQuery: Record<string, string> = {}
  for (const key of ['academicTermId', 'gradeSession', 'classId', 'studentId', 'examTypeId'] as const) {
    if (query[key]) nextQuery[key] = String(query[key])
  }
  router.replace({ path: route.path, query: nextQuery })
}

async function search(resetPage = false) {
  if (resetPage) {
    page.current = 1
  }
  loading.value = true
  error.value = ''
  try {
    const res = await call('listTranscripts', {
      academicTermId: query.academicTermId ? Number(query.academicTermId) : undefined,
      gradeSession: query.gradeSession || undefined,
      classId: query.classId ? Number(query.classId) : undefined,
      studentId: query.studentId ? Number(query.studentId) : undefined,
      page: page.current,
      size: page.size
    })
    transcripts.value = rows(res)
    total.value = totalOf(res)
    explicitTotalPages.value = totalPagesOf(res)
    syncRouteQuery()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function cancelStudentSearch() {
  studentSearchRequest += 1
  if (studentSearchTimer) clearTimeout(studentSearchTimer)
  if (studentCloseTimer) clearTimeout(studentCloseTimer)
  studentSearchTimer = null
  studentCloseTimer = null
  studentSearchLoading.value = false
  studentSearchError.value = ''
  studentSuggestionsOpen.value = false
  studentSuggestions.value = []
  activeStudentIndex.value = -1
}

function queueStudentSearch() {
  if (studentSearchTimer) clearTimeout(studentSearchTimer)
  if (!query.classId || !studentKeyword.value) {
    studentSuggestionsOpen.value = false
    studentSuggestions.value = []
    activeStudentIndex.value = -1
    return
  }
  studentSuggestionsOpen.value = true
  studentSearchLoading.value = true
  studentSearchError.value = ''
  studentSearchTimer = setTimeout(performStudentSearch, 350)
}

function onStudentKeywordInput() {
  if (query.studentId) {
    query.studentId = ''
    syncRouteQuery()
  }
  queueStudentSearch()
}

function onStudentSearchFocus() {
  if (!query.studentId && studentKeyword.value) queueStudentSearch()
}

async function performStudentSearch() {
  const requestId = ++studentSearchRequest
  const classId = query.classId
  const keyword = studentKeyword.value
  studentSearchLoading.value = true
  studentSearchError.value = ''
  try {
    const result = rows(await call('listStudents', {
      classId: Number(classId),
      keyword,
      page: 1,
      size: 8
    }))
    if (requestId !== studentSearchRequest || classId !== query.classId || keyword !== studentKeyword.value) return
    studentSuggestions.value = result
    activeStudentIndex.value = result.length ? 0 : -1
    studentSuggestionsOpen.value = true
  } catch {
    if (requestId !== studentSearchRequest) return
    studentSuggestions.value = []
    activeStudentIndex.value = -1
    studentSearchError.value = '学生搜索失败，请稍后重新输入。'
    studentSuggestionsOpen.value = true
  } finally {
    if (requestId === studentSearchRequest) studentSearchLoading.value = false
  }
}

function moveStudentSuggestion(direction: number) {
  if (!studentSuggestionsOpen.value || !studentSuggestions.value.length) return
  const count = studentSuggestions.value.length
  activeStudentIndex.value = (activeStudentIndex.value + direction + count) % count
}

function selectActiveStudent() {
  if (!studentSuggestionsOpen.value || !studentSuggestions.value.length) return
  const index = activeStudentIndex.value >= 0 ? activeStudentIndex.value : 0
  selectTranscriptStudent(studentSuggestions.value[index])
}

function selectTranscriptStudent(student: AnyRow) {
  if (studentCloseTimer) clearTimeout(studentCloseTimer)
  query.studentId = String(student.id)
  studentKeyword.value = String(student.studentName || student.name || '')
  if (!students.value.some((item) => String(item.id) === String(student.id))) students.value.push(student)
  studentSuggestionsOpen.value = false
  studentSuggestions.value = []
  activeStudentIndex.value = -1
  search(true)
}

function clearSelectedStudent() {
  cancelStudentSearch()
  query.studentId = ''
  studentKeyword.value = ''
  search(true)
}

function closeStudentSuggestions() {
  studentSuggestionsOpen.value = false
  activeStudentIndex.value = -1
}

function scheduleStudentSuggestionsClose() {
  if (studentCloseTimer) clearTimeout(studentCloseTimer)
  studentCloseTimer = setTimeout(closeStudentSuggestions, 120)
}

async function handleClassChange() {
  cancelStudentSearch()
  query.studentId = ''
  studentKeyword.value = ''
  await loadStudents()
  await search(true)
}

async function handleSessionChange() {
  cancelStudentSearch()
  query.classId = ''
  query.studentId = ''
  studentKeyword.value = ''
  students.value = []
  await search(true)
}

function goPage(num: number) {
  page.current = num
  search(false)
}

function changePageSize() {
  page.current = 1
  search(false)
}

function formatTime(value: any) {
  if (!value) return '-'
  const text = String(value).replace('T', ' ')
  return text.length >= 16 ? text.slice(0, 16) : text
}

function goScoresForTranscript(item: AnyRow) {
  router.push({
    path: '/scores',
    query: {
      academicTermId: String(item.academicTermId || query.academicTermId || ''),
      gradeSession: String(item.gradeSession || query.gradeSession || ''),
      gradeLevel: item.gradeLevel ? String(item.gradeLevel) : undefined,
      classId: String(item.classId || query.classId || ''),
      studentId: String(item.studentId || query.studentId || ''),
      examTypeId: item.examTypeId ? String(item.examTypeId) : String(query.examTypeId || '')
    }
  })
}

async function submitGenerate() {
  if (!query.academicTermId) {
    error.value = '请先选择学期'
    return
  }
  if (!query.classId) {
    error.value = '请先选择班级'
    return
  }
  if (!query.studentId) {
    error.value = '请先选择学生'
    return
  }
  generateVisible.value = true
  generating.value = true
  generateError.value = ''
  generatedTranscript.value = null
  try {
    generatedTranscript.value = payload(await call('createTranscript', {
      academicTermId: Number(query.academicTermId),
      classId: Number(query.classId),
      studentId: Number(query.studentId),
      examTypeId: query.examTypeId ? Number(query.examTypeId) : undefined,
      generatedByUserId: query.generatedByUserId ? Number(query.generatedByUserId) : null
    }))
  } catch (err) {
    generateError.value = err instanceof Error ? err.message : '生成失败'
  } finally {
    generating.value = false
  }
}

function closeGenerateModal() {
  generateVisible.value = false
  generatedTranscript.value = null
  generateError.value = ''
  search(false)
}

async function submitRegenerate(id: any) {
  if (!id || regeneratingIds.value.has(id)) return
  regeneratingIds.value = new Set(regeneratingIds.value).add(id)
  activeRegenerateId.value = id
  regenerateVisible.value = true
  regenerating.value = true
  regenerateError.value = ''
  regeneratedTranscript.value = null
  try {
    regeneratedTranscript.value = payload(await call('regenerateTranscript', id))
  } catch (err) {
    regenerateError.value = err instanceof Error ? err.message : '重新生成失败'
  } finally {
    regenerating.value = false
    const next = new Set(regeneratingIds.value)
    next.delete(id)
    regeneratingIds.value = next
  }
}

function retryRegenerate() {
  if (activeRegenerateId.value) {
    submitRegenerate(activeRegenerateId.value)
  }
}

function closeRegenerateModal() {
  regenerateVisible.value = false
  activeRegenerateId.value = null
  regeneratedTranscript.value = null
  regenerateError.value = ''
  search(false)
}

function filenameFromResponse(res: any) {
  const disposition = res?.headers?.['content-disposition'] || ''
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/)
  const plain = disposition.match(/filename="?([^";]+)"?/)
  if (encoded) return decodeURIComponent(encoded[1])
  if (plain) return plain[1]
  return '成绩单.pdf'
}

function saveBlobResponse(res: any) {
  const blob = res?.data instanceof Blob ? res.data : new Blob([res?.data ?? res], { type: 'application/pdf' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filenameFromResponse(res)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

async function downloadById(id: any) {
  if (!id || downloadingIds.value.has(id)) return
  downloadingIds.value = new Set(downloadingIds.value).add(id)
  error.value = ''
  downloadPercent.value = 0
  downloadVisible.value = true
  const controller = new AbortController()
  downloadAbortController.value = controller
  try {
    const res = await call('downloadTranscript', id, {
      signal: controller.signal,
      onProgress: (percent: number) => {
        downloadPercent.value = percent
      }
    })
    saveBlobResponse(res)
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      error.value = err instanceof Error ? err.message : '下载失败'
    }
  } finally {
    downloadVisible.value = false
    downloadAbortController.value = null
    const next = new Set(downloadingIds.value)
    next.delete(id)
    downloadingIds.value = next
  }
}

function cancelDownload() {
  downloadAbortController.value?.abort()
}

async function downloadResult(item: AnyRow) {
  if (!item?.id || resultDownloading.value) return
  resultDownloading.value = true
  resultDownloadPercent.value = 0
  try {
    const res = await call('downloadTranscript', item.id, {
      onProgress: (percent: number) => {
        resultDownloadPercent.value = percent
      }
    })
    saveBlobResponse(res)
  } finally {
    resultDownloading.value = false
    resultDownloadPercent.value = 0
  }
}

const ResultPanel = defineComponent({
  props: {
    successText: { type: String, required: true },
    item: { type: Object as () => AnyRow, required: true },
    downloading: { type: Boolean, default: false },
    percent: { type: Number, default: 0 }
  },
  emits: ['close', 'download'],
  setup(props, { emit }) {
    return () =>
      h('div', { class: 'modal-body' }, [
        h('p', { class: 'result-success' }, props.successText),
        h('div', { class: 'mini-list result-list' }, [
          h('div', { class: 'mini-item' }, [h('div', [h('strong', props.item.transcriptNo || '-')])]),
          h('div', { class: 'mini-item' }, [h('div', [h('span', '学生'), h('strong', props.item.studentName || '-')])]),
          h('div', { class: 'mini-item' }, [h('div', [h('span', '班级'), h('strong', props.item.className || '-')])]),
          props.item.pdfFileName
            ? h('div', { class: 'mini-item' }, [h('div', [h('span', '文件'), h('strong', props.item.pdfFileName)])])
            : null,
          props.item.generatedAt
            ? h('div', { class: 'mini-item' }, [h('div', [h('span', '生成时间'), h('strong', props.item.generatedAt)])])
            : null
        ]),
        props.downloading
          ? h('div', { class: 'progress-block' }, [
              h('div', { class: 'progress-track' }, [
                h('div', { class: 'progress-fill', style: { width: `${props.percent}%` } })
              ]),
              h('p', { class: 'progress-text' }, `${props.percent}%`)
            ])
          : null,
        h('div', { class: 'modal-actions' }, [
          h('button', { class: 'button ghost sm', type: 'button', onClick: () => emit('close') }, '关闭'),
          h(
            'button',
            { class: 'button primary sm', type: 'button', disabled: props.downloading, onClick: () => emit('download') },
            props.downloading ? '下载中…' : '下载成绩单'
          )
        ])
      ])
  }
})

onMounted(() => {
  query.academicTermId = String(route.query.academicTermId || '')
  query.gradeSession = String(route.query.gradeSession || '')
  query.classId = String(route.query.classId || '')
  query.studentId = String(route.query.studentId || '')
  query.examTypeId = String(route.query.examTypeId || '')
  loadPage()
})

onUnmounted(() => {
  cancelStudentSearch()
})
</script>

<style scoped>
.transcripts-page {
  --academic-ink: #102a43;
  --academic-muted: #62758a;
  --academic-line: #d9e2ec;
  --academic-soft: #f4f8fa;
  --academic-primary: #0f766e;
  --academic-primary-dark: #115e59;
  --academic-danger: #b42318;
  display: grid;
  gap: 16px;
  min-width: 0;
  color: var(--academic-ink);
}

.academic-page-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 20px;
  padding: 6px 2px 2px;
}

.academic-page-header__copy {
  min-width: 0;
}

.eyebrow {
  margin: 0 0 5px;
  color: var(--academic-primary);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.academic-page-header h1,
.panel-head h2,
.transcript-generate-band h2 {
  margin: 0;
  color: var(--academic-ink);
  letter-spacing: -.025em;
}

.academic-page-header h1 {
  font-size: clamp(26px, 3vw, 36px);
  line-height: 1.15;
}

.lead,
.hint,
.transcript-generate-band p,
.transcript-readonly-note p,
.transcript-state p {
  margin: 6px 0 0;
  color: var(--academic-muted);
  line-height: 1.55;
}

.lead {
  max-width: 680px;
  font-size: 14px;
}

.transcript-overview {
  display: grid;
  min-width: 94px;
  padding-left: 18px;
  border-left: 1px solid var(--academic-line);
}

.transcript-overview span {
  color: var(--academic-muted);
  font-size: 12px;
}

.transcript-overview strong {
  margin-top: 2px;
  color: var(--academic-ink);
  font-size: 24px;
  font-variant-numeric: tabular-nums;
}

.transcript-filter-panel,
.transcript-list-panel {
  padding: 0;
  border-color: var(--academic-line);
  box-shadow: 0 8px 24px rgba(16, 42, 67, .055);
}

.transcript-filter-panel { overflow: visible; }
.transcript-list-panel { overflow: hidden; }

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 20px 22px 16px;
  border-bottom: 1px solid var(--academic-line);
}

.panel-head h2,
.transcript-generate-band h2 {
  font-size: 18px;
  line-height: 1.3;
}

.hint {
  font-size: 13px;
}

.filter-status,
.result-count {
  flex: 0 0 auto;
  color: var(--academic-primary-dark);
  font-size: 12px;
  font-weight: 700;
}

.filter-status {
  padding: 6px 9px;
  border: 1px solid #9fd5cf;
  border-radius: 6px;
  background: #edf8f6;
}

.transcript-filter-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: start;
  gap: 14px;
  padding: 18px 22px 22px;
  background: #fff;
}

.transcript-filter-grid > label,
.transcript-student-field,
.generator-field {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.transcript-filter-grid > label > span,
.transcript-student-field > label,
.generator-field > span {
  color: #465b70;
  font-size: 12px;
  font-weight: 700;
}

.transcript-filter-grid select,
.transcript-student-search input,
.generator-field input {
  width: 100%;
  min-width: 0;
  height: 40px;
  border: 1px solid #bcccdc;
  border-radius: 6px;
  background: #fff;
  color: var(--academic-ink);
}

.transcript-filter-grid select:focus-visible,
.transcript-student-search input:focus-visible,
.generator-field input:focus-visible {
  border-color: var(--academic-primary);
  outline: 3px solid rgba(15, 118, 110, .16);
  outline-offset: 1px;
}

.transcript-filter-grid select:disabled {
  cursor: not-allowed;
  background: #eef2f6;
  color: #8292a5;
}

.transcript-student-field {
  grid-column: 1 / span 3;
  min-width: 0;
}

.transcript-student-search {
  position: relative;
}

.transcript-student-search input {
  padding: 0 13px;
  line-height: 1.4;
}

.transcript-student-search input.has-clear {
  padding-right: 62px;
}

.transcript-student-search input:disabled {
  cursor: not-allowed;
  background: #eef2f6;
  color: #8292a5;
}

.student-search-clear {
  position: absolute;
  top: 50%;
  right: 8px;
  min-width: 42px;
  min-height: 28px;
  padding: 2px 7px;
  transform: translateY(-50%);
  border: 0;
  border-radius: 5px;
  background: #eef5f5;
  color: var(--academic-primary-dark);
  font-size: 11px;
  font-weight: 700;
}

.student-search-clear:hover {
  background: #d9efeb;
}

.student-search-clear:focus-visible {
  outline: 3px solid rgba(15, 118, 110, .2);
  outline-offset: 1px;
}

.transcript-student-suggestions {
  position: absolute;
  z-index: 40;
  top: calc(100% + 6px);
  right: 0;
  left: 0;
  max-height: 280px;
  padding: 6px;
  overflow-y: auto;
  border: 1px solid #bcccdc;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 16px 36px rgba(16, 42, 67, .16);
}

.transcript-student-suggestions button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 44px;
  padding: 8px 10px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--academic-ink);
  text-align: left;
}

.transcript-student-suggestions button:hover,
.transcript-student-suggestions button.active {
  background: #edf8f6;
}

.transcript-student-suggestions button:focus-visible {
  outline: 3px solid rgba(15, 118, 110, .2);
  outline-offset: -2px;
}

.transcript-student-suggestions button > span {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.transcript-student-suggestions button strong {
  font-size: 13px;
}

.transcript-student-suggestions button small,
.student-search-help,
.student-suggestion-state {
  color: var(--academic-muted);
  font-size: 11px;
}

.transcript-student-suggestions button > small {
  flex: 0 0 auto;
}

.student-search-help {
  min-height: 17px;
  line-height: 1.45;
}

.student-suggestion-state {
  margin: 0;
  padding: 12px 10px;
  line-height: 1.5;
}

.student-suggestion-state--error {
  color: var(--academic-danger);
}

.transcript-filter-submit {
  grid-column: 4;
  grid-row: 2;
  align-self: start;
  min-height: 40px;
  margin-top: 24px;
  white-space: nowrap;
}

.transcript-generate-band {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(210px, 280px) auto;
  align-items: end;
  gap: 24px;
  padding: 20px 22px;
  border: 1px solid #c7d8df;
  border-left: 4px solid var(--academic-primary);
  border-radius: 8px;
  background: linear-gradient(100deg, #f4faf9 0%, #fff 62%);
}

.transcript-generate-band p {
  font-size: 13px;
}

.transcript-generate-band .button {
  min-height: 40px;
  white-space: nowrap;
}

.transcript-readonly-note {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 13px 16px;
  border-left: 3px solid #829ab1;
  background: var(--academic-soft);
}

.transcript-readonly-note strong {
  flex: 0 0 auto;
  font-size: 13px;
}

.transcript-readonly-note p {
  font-size: 13px;
}

.success {
  margin: 0;
}

.transcript-list-head {
  align-items: center;
}

.result-count {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  color: var(--academic-muted);
}

.result-count strong {
  color: var(--academic-ink);
  font-size: 24px;
  font-variant-numeric: tabular-nums;
}

.transcript-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  min-height: 210px;
  padding: 28px;
  text-align: left;
}

.transcript-state strong {
  font-size: 14px;
}

.transcript-state p {
  font-size: 13px;
}

.transcript-state--error {
  flex-wrap: wrap;
  background: #fffbfa;
}

.transcript-state--error strong,
.transcript-state--error p {
  color: var(--academic-danger);
}

.transcript-state--empty {
  background: #fbfcfd;
}

.state-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #c7d8df;
  border-top-color: var(--academic-primary);
  border-radius: 50%;
  animation: transcript-spin .7s linear infinite;
}

.state-mark {
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  border-radius: 50%;
  background: #fee4e2;
  color: var(--academic-danger);
  font-weight: 800;
}

.state-icon {
  width: 38px;
  height: 38px;
  fill: none;
  stroke: #829ab1;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.5;
}

.mobile-table-hint {
  display: none;
  margin: 0;
  padding: 10px 16px;
  border-bottom: 1px solid var(--academic-line);
  background: #f7fafc;
  color: var(--academic-muted);
  font-size: 12px;
}

.transcript-table-wrap {
  width: 100%;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
}

.transcript-table {
  width: 100%;
  min-width: 920px;
  border-collapse: collapse;
}

.transcript-table th,
.transcript-table td {
  padding: 14px 16px;
  border-bottom: 1px solid #e6edf3;
  text-align: left;
  vertical-align: middle;
}

.transcript-table th {
  background: #f6f9fb;
  color: #53677b;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .045em;
  white-space: nowrap;
}

.transcript-table td {
  color: #334e68;
  font-size: 13px;
}

.transcript-table tbody tr:hover {
  background: #f8fbfb;
}

.transcript-table tbody tr:last-child td {
  border-bottom: 0;
}

.transcript-number {
  color: var(--academic-ink);
  font-variant-numeric: tabular-nums;
}

.transcript-file {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.transcript-row-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.pagination {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-top: 1px solid var(--academic-line);
  background: #fbfcfd;
}

.pagination-left {
  display: flex;
  align-items: center;
  gap: 14px;
}
.pagination-info,
.pagination-size-label {
  color: #64748b;
  white-space: nowrap;
  font-size: 13px;
}
.pagination-size-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.pagination-size-select {
  width: auto;
  padding: 5px 8px;
  border-radius: 7px;
  color: #334155;
  font-size: 12px;
  font-weight: 600;
  background: #f8fafc;
}
.pagination-buttons {
  display: flex;
  gap: 6px;
}

.modal-state {
  text-align: center;
  padding: 32px 0;
}
.modal-state p {
  margin: 0;
}
.modal-body {
  padding: 8px 0;
}
.preserve-error {
  white-space: pre-wrap;
}
:global(.result-success) {
  margin: 0 0 12px;
  color: #065f46;
}
.result-list {
  margin-bottom: 16px;
}
:global(.mini-list) {
  display: grid;
  gap: 2px;
}
:global(.mini-item) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
}
:global(.mini-item:hover) {
  background: #f8fafc;
}
:global(.mini-item span) {
  display: block;
  color: #64748b;
  font-size: 12px;
}
:global(.mini-item strong) {
  color: #0f172a;
  font-size: 14px;
}
:global(.progress-block) {
  margin-bottom: 16px;
}
:global(.progress-track) {
  width: 100%;
  height: 10px;
  border-radius: 14px;
  background: #e2e8f0;
  overflow: hidden;
}
:global(.progress-fill) {
  height: 100%;
  min-width: 0;
  border-radius: 14px;
  background: var(--academic-primary);
  transition: width .15s ease;
}
:global(.progress-text) {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 14px;
  font-weight: 700;
  text-align: center;
}

@keyframes transcript-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 1180px) {
  .transcript-filter-grid {
    grid-template-columns: repeat(3, minmax(170px, 1fr));
  }

  .transcript-student-field {
    grid-column: 1 / span 2;
  }

  .transcript-filter-submit {
    grid-column: 3;
    grid-row: auto;
    align-self: start;
  }

  .transcript-generate-band {
    grid-template-columns: minmax(240px, 1fr) minmax(220px, 280px);
  }

  .transcript-generate-band .button {
    grid-column: 2;
  }
}

@media (max-width: 860px) {
  .academic-page-header {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .academic-page-header > .button {
    grid-column: 1 / -1;
    justify-self: start;
  }

  .transcript-filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .transcript-student-field {
    grid-column: 1;
  }

  .transcript-filter-submit {
    grid-column: 2;
  }

  .transcript-generate-band {
    grid-template-columns: minmax(0, 1fr);
  }

  .transcript-generate-band .button {
    grid-column: auto;
    justify-self: start;
  }
}

@media (max-width: 760px) {
  .transcripts-page {
    gap: 14px;
  }

  .academic-page-header {
    grid-template-columns: 1fr;
    gap: 13px;
  }

  .academic-page-header > .button {
    grid-column: auto;
    width: 100%;
    min-height: 44px;
  }

  .transcript-overview {
    grid-template-columns: auto 1fr;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
    padding: 10px 0 0;
    border-top: 1px solid var(--academic-line);
    border-left: 0;
  }

  .transcript-overview strong {
    font-size: 20px;
  }

  .panel-head,
  .transcript-list-head {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
    padding: 17px 16px 14px;
  }

  .transcript-filter-grid {
    grid-template-columns: 1fr;
    gap: 13px;
    padding: 16px;
  }

  .transcript-student-field,
  .transcript-filter-submit {
    grid-column: 1;
  }

  .transcript-filter-submit {
    margin-top: 0;
  }

  .transcript-filter-grid select,
  .transcript-student-search input,
  .generator-field input,
  .transcript-filter-submit {
    min-height: 44px;
    font-size: 16px;
  }

  .transcript-generate-band {
    gap: 18px;
    padding: 18px 16px;
  }

  .transcript-generate-band .button {
    width: 100%;
    min-height: 44px;
  }

  .transcript-readonly-note {
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
  }

  .transcript-state {
    align-items: flex-start;
    justify-content: flex-start;
    min-height: 180px;
    padding: 30px 18px;
  }

  .mobile-table-hint {
    display: block;
  }

  .transcript-table th,
  .transcript-table td {
    padding: 13px 14px;
  }

  .transcript-row-actions .button {
    min-height: 40px;
  }

  .pagination,
  .pagination-left,
  .pagination-buttons {
    align-items: stretch;
    flex-direction: column;
  }

  .pagination-buttons .button {
    min-height: 40px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .state-spinner {
    animation-duration: 1.6s;
  }

  :global(.progress-fill) {
    transition: none;
  }
}
</style>
