<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  bootstrapH5,
  confirmWechatLogin,
  getH5Comment,
  H5ApiError,
  listH5Honors,
  listH5Scores,
  listH5Students,
  listH5Terms,
  registerParent,
  resolveH5Context,
  sendMobileCode,
  setH5Csrf,
  type H5AcademicTermCapability,
  type H5FlowResponse,
  type H5FlowState,
  type H5Honor,
  type H5QueryCandidate,
  type H5QueryContextResolveRequest,
  type H5QueryPreset,
  type H5ScoreResponse,
  type H5SelectionState,
  type H5Student,
  type H5TeacherCommentResponse
} from '../../api/h5'

type ContentTab = 'scores' | 'comment' | 'honors'

const selectionStates = new Set<H5FlowState>([
  'STUDENT_SELECTION_REQUIRED',
  'TERM_SELECTION_REQUIRED',
  'EXAM_SELECTION_REQUIRED'
])

const route = useRoute()
const appid = computed(() => String(route.query.appid || ''))
const loading = ref(true)
const submitting = ref(false)
const contentLoading = ref(false)
const error = ref('')
const notice = ref('')
const queryContextWarning = ref('')
const state = ref<H5FlowResponse>({ flowState: 'CHECKING' })
const students = ref<H5Student[]>([])
const terms = ref<H5AcademicTermCapability[]>([])
const selectedStudent = ref<number>()
const selectedTerm = ref<number>()
const examTypeId = ref<number>()
const scoreData = ref<H5ScoreResponse>()
const commentData = ref<H5TeacherCommentResponse>()
const honors = ref<H5Honor[]>([])
const tab = ref<ContentTab>('scores')
const candidates = ref<H5QueryCandidate[]>([])
const selectedCandidateIndex = ref<number>()
const form = reactive({
  studentName: '',
  mobile: '',
  verificationCode: '',
  studentNo: '',
  idCardLast4: '',
  agreementVersion: '2026-08-31',
  agreementAccepted: false
})

let contentController: AbortController | undefined

// 已成功加载过的 Tab（切换回来直接展示缓存，不重复请求）
const loadedTabs = ref<Set<ContentTab>>(new Set())

const isSelectionState = computed(() => selectionStates.has(state.value.flowState))
const selectionState = computed(() => state.value.flowState as H5SelectionState)
const availableExams = computed(() =>
  terms.value.find((term) => term.academicTermId === selectedTerm.value)?.examTypes || []
)
const selectedCandidate = computed(() =>
  selectedCandidateIndex.value === undefined ? undefined : candidates.value[selectedCandidateIndex.value]
)
const canConfirmCandidate = computed(() => selectedCandidate.value !== undefined && !submitting.value)
const readyPreset = computed(() =>
  hasResolvedPreset(state.value.queryPreset) ? state.value.queryPreset : undefined
)
const readyContextBlocked = computed(() =>
  state.value.flowState === 'READY'
  && state.value.queryPreset !== undefined
  && !hasResolvedPreset(state.value.queryPreset)
)
const schoolName = computed(() => state.value.schoolName || '新实中学')
const sealText = computed(() => schoolName.value.replace(/中学|学校/g, '').slice(0, 2) || '档案')
const selectedTermCapability = computed(() =>
  terms.value.find((term) => term.academicTermId === selectedTerm.value)
)
// 查询条件区内的轻提示（区别于底部错误横幅）
const queryHint = computed(() => {
  if (!terms.value.length) return ''
  if (tab.value === 'scores') {
    if (!selectedTerm.value) return ''
    if (!availableExams.value.length) return '该学期暂无已发布成绩，可查看班主任评语或荣誉'
    if (!examTypeId.value) return '请选择考试类型后查询'
  }
  return ''
})

function formatDate(value?: string) {
  if (!value) return ''
  const [year, month, day] = value.slice(0, 10).split('-')
  return month && day ? `${year}年${Number(month)}月${Number(day)}日` : value.slice(0, 10)
}

function capabilityFlag(value: boolean | number | undefined) {
  return Boolean(value)
}

const statusContent = computed(() => {
  const statuses: Partial<Record<H5FlowState, { title: string; message: string; retry: boolean }>> = {
    ACCOUNT_DISABLED: { title: '账户暂不可用', message: '请联系学校管理员处理。', retry: false },
    ACCOUNT_INCOMPLETE: { title: '账户资料不完整', message: '当前账户缺少有效学生关系，请联系学校处理，无法重复注册。', retry: false },
    STUDENT_NAME_NOT_BOUND: { title: '无法查询该学生', message: '查询姓名与当前账号绑定学生不一致，请核对后重新发送。', retry: false },
    GUARDIAN_AUTH_REQUIRED: { title: '监护关系待审核', message: '手机号未与学校监护人档案匹配，请联系学校审核。', retry: false },
    MAINTENANCE: { title: '成绩查询维护中', message: '服务暂时不可用，请稍后重试。', retry: true }
  }
  return statuses[state.value.flowState] || {
    title: '暂时无法继续',
    message: '当前查询状态无法进入成绩页，请重新加载或联系学校。',
    retry: true
  }
})

const selectionCopy = computed(() => {
  const copy: Record<H5SelectionState, { title: string; message: string }> = {
    STUDENT_SELECTION_REQUIRED: {
      title: '请选择本人学生',
      message: '存在多名同名绑定学生，请根据脱敏学号和班级确认。'
    },
    TERM_SELECTION_REQUIRED: {
      title: '请选择查询学期',
      message: '微信查询条件命中多个有已发布成绩的学期。'
    },
    EXAM_SELECTION_REQUIRED: {
      title: '请选择考试类型',
      message: '当前学期存在多个已发布考试，成绩不会合并展示。'
    }
  }
  return copy[selectionState.value]
})

function messageOf(value: unknown): string {
  return value instanceof Error ? value.message : '请求失败，请稍后重试'
}

function isPositiveId(value: number | undefined): value is number {
  return Number.isInteger(value) && Number(value) > 0
}

function hasResolvedPreset(preset?: H5QueryPreset): preset is H5QueryPreset & {
  resolutionState: 'RESOLVED'
  resolvedStudentId: number
  resolvedAcademicTermId: number
  resolvedExamTypeId: number
} {
  return preset?.resolutionState === 'RESOLVED'
    && isPositiveId(preset.resolvedStudentId)
    && isPositiveId(preset.resolvedAcademicTermId)
    && isPositiveId(preset.resolvedExamTypeId)
}

function clearResults() {
  contentController?.abort()
  scoreData.value = undefined
  commentData.value = undefined
  honors.value = []
  loadedTabs.value = new Set()
}

function clearRegistrationSecrets() {
  form.studentName = ''
  form.mobile = ''
  form.verificationCode = ''
  form.studentNo = ''
  form.idCardLast4 = ''
  form.agreementAccepted = false
}

function candidateKey(candidate: H5QueryCandidate, index: number) {
  return [candidate.studentId, candidate.academicTermId, candidate.examTypeId, index].join('-')
}

function candidateTitle(candidate: H5QueryCandidate) {
  if (selectionState.value === 'STUDENT_SELECTION_REQUIRED') {
    return candidate.studentNameMasked || '已绑定学生'
  }
  if (selectionState.value === 'TERM_SELECTION_REQUIRED') {
    return candidate.termName || '可查询学期'
  }
  return candidate.examTypeName || '可查询考试'
}

function candidateDetail(candidate: H5QueryCandidate) {
  if (selectionState.value === 'STUDENT_SELECTION_REQUIRED') {
    return [candidate.className, candidate.studentNoMasked].filter(Boolean).join(' · ')
  }
  if (selectionState.value === 'TERM_SELECTION_REQUIRED') {
    return candidate.examTypeName ? `已发布：${candidate.examTypeName}` : '该学期存在已发布成绩'
  }
  return candidate.termName || '仅查询该考试的已发布成绩'
}

async function initialize() {
  loading.value = true
  error.value = ''
  notice.value = ''
  queryContextWarning.value = ''
  try {
    if (!/^wx[0-9A-Za-z]{8,64}$/.test(appid.value)) {
      throw new Error('无效的成绩查询入口')
    }
    await applyFlowResponse(await bootstrapH5(appid.value))
  } catch (value) {
    error.value = messageOf(value)
    state.value = { flowState: 'MAINTENANCE' }
  } finally {
    loading.value = false
  }
}

async function applyFlowResponse(response: H5FlowResponse) {
  if (response.csrfToken) setH5Csrf(response.csrfToken)
  queryContextWarning.value = response.queryContextWarning?.message || ''
  state.value = { ...response }
  candidates.value = response.candidates ?? []
  selectedCandidateIndex.value = undefined

  if (isSelectionState.value) {
    clearResults()
    return
  }
  if (response.flowState === 'READY') {
    await enterReady(response)
  } else if (response.flowState !== 'NEED_REGISTRATION') {
    clearResults()
    students.value = []
    terms.value = []
  }
}

async function enterReady(response: H5FlowResponse) {
  if (readyContextBlocked.value) {
    clearResults()
    return
  }
  students.value = response.students?.length ? response.students : await listH5Students()
  if (!students.value.length) {
    state.value = { ...state.value, flowState: 'ACCOUNT_INCOMPLETE' }
    return
  }

  const preset = hasResolvedPreset(response.queryPreset) ? response.queryPreset : undefined
  const requestedStudentId = preset?.resolvedStudentId ?? response.defaultStudentId ?? students.value[0]?.studentId
  if (!requestedStudentId || !students.value.some((student) => student.studentId === requestedStudentId)) {
    state.value = { ...state.value, flowState: 'ACCOUNT_INCOMPLETE' }
    return
  }

  selectedStudent.value = requestedStudentId
  terms.value = await listH5Terms(requestedStudentId)
  if (preset) {
    await applyResolvedPreset(preset)
    return
  }

  const defaultTerm = terms.value.find((term) => Boolean(term.current) && Boolean(term.hasScores))
    || terms.value.find((term) => Boolean(term.hasScores))
  selectedTerm.value = defaultTerm?.academicTermId
  examTypeId.value = defaultTerm?.examTypes.length === 1 ? defaultTerm.examTypes[0].examTypeId : undefined
  clearResults()
  // 默认条件已就绪时自动加载成绩，减少家长操作步骤
  if (selectedTerm.value && examTypeId.value) void queryContent(false)
}

async function applyResolvedPreset(preset: H5QueryPreset) {
  const term = terms.value.find((item) => item.academicTermId === preset.resolvedAcademicTermId)
  const exam = term?.examTypes.find((item) => item.examTypeId === preset.resolvedExamTypeId)
  if (!term || !exam || preset.resolvedStudentId !== selectedStudent.value) {
    clearResults()
    error.value = '服务端查询条件已变化，请重新从微信进入查询'
    return
  }
  selectedTerm.value = term.academicTermId
  examTypeId.value = exam.examTypeId
  await queryContent()
}

async function continueLogin() {
  if (!state.value.loginConfirmationToken) {
    error.value = '登录确认已过期，请重新加载'
    return
  }
  submitting.value = true
  error.value = ''
  try {
    const data = await confirmWechatLogin(state.value.loginConfirmationToken)
    window.location.replace(data.authorizeUrl)
  } catch (value) {
    error.value = messageOf(value)
    submitting.value = false
  }
}

async function sendCode() {
  submitting.value = true
  error.value = ''
  notice.value = ''
  try {
    const response = await sendMobileCode(form.mobile)
    notice.value = response.retryAfterSeconds
      ? `验证码已发送，${response.retryAfterSeconds} 秒后可重新获取`
      : '验证码已发送，请在有效期内使用'
  } catch (value) {
    error.value = messageOf(value)
  } finally {
    submitting.value = false
  }
}

async function register() {
  if (!form.agreementAccepted) {
    error.value = '请先阅读并同意家长查询服务协议'
    return
  }
  submitting.value = true
  error.value = ''
  notice.value = ''
  try {
    const response = await registerParent({
      studentName: form.studentName.trim(),
      mobile: form.mobile.trim(),
      verificationCode: form.verificationCode.trim(),
      studentNo: form.studentNo.trim(),
      idCardLast4: form.idCardLast4.trim().toUpperCase(),
      agreementVersion: form.agreementVersion
    })
    clearRegistrationSecrets()
    await applyFlowResponse(response)
  } catch (value) {
    if (value instanceof H5ApiError && ['VERIFICATION_CODE_INVALID', 'VERIFY_CODE_INVALID'].includes(value.code || '')) {
      form.verificationCode = ''
    }
    error.value = messageOf(value)
  } finally {
    submitting.value = false
  }
}

function selectionRequest(candidate: H5QueryCandidate): H5QueryContextResolveRequest {
  const currentState = selectionState.value
  const preset = state.value.queryPreset
  if (currentState === 'STUDENT_SELECTION_REQUIRED') {
    if (!isPositiveId(candidate.studentId)) throw new Error('服务端学生候选信息不完整，请重新加载')
    return { studentId: candidate.studentId }
  }
  if (currentState === 'TERM_SELECTION_REQUIRED') {
    if (!isPositiveId(preset?.resolvedStudentId)) throw new Error('服务端未保留已确认学生，请重新加载')
    if (!isPositiveId(candidate.academicTermId)) throw new Error('服务端学期候选信息不完整，请重新加载')
    return { academicTermId: candidate.academicTermId }
  }
  if (!isPositiveId(preset?.resolvedStudentId) || !isPositiveId(preset?.resolvedAcademicTermId)) {
    throw new Error('服务端未保留已确认学生和学期，请重新加载')
  }
  if (!isPositiveId(candidate.examTypeId)) throw new Error('服务端考试候选信息不完整，请重新加载')
  return { examTypeId: candidate.examTypeId }
}

async function confirmCandidate() {
  if (!selectedCandidate.value) return
  submitting.value = true
  error.value = ''
  try {
    const response = await resolveH5Context(selectionRequest(selectedCandidate.value))
    await applyFlowResponse(response)
  } catch (value) {
    error.value = messageOf(value)
  } finally {
    submitting.value = false
  }
}

async function changeStudent() {
  if (!selectedStudent.value) return
  clearResults()
  selectedTerm.value = undefined
  examTypeId.value = undefined
  terms.value = await listH5Terms(selectedStudent.value)
  const defaultTerm = terms.value.find((term) => Boolean(term.current) && Boolean(term.hasScores))
    || terms.value.find((term) => Boolean(term.hasScores))
  selectedTerm.value = defaultTerm?.academicTermId
  examTypeId.value = defaultTerm?.examTypes.length === 1 ? defaultTerm.examTypes[0].examTypeId : undefined
  if (selectedTerm.value && examTypeId.value) void queryContent(false)
}

function changeTerm() {
  clearResults()
  examTypeId.value = availableExams.value.length === 1 ? availableExams.value[0].examTypeId : undefined
  if (selectedTerm.value && examTypeId.value) void queryContent(false)
}

function changeExam() {
  clearResults()
  if (selectedTerm.value && examTypeId.value) void queryContent(false)
}

async function queryContent(manual = true) {
  if (!selectedStudent.value || !selectedTerm.value) {
    if (manual) error.value = '请选择学生和学期'
    return
  }
  if (tab.value === 'scores' && !examTypeId.value) {
    if (manual) error.value = '请选择一个考试类型后查询'
    return
  }

  contentController?.abort()
  const controller = new AbortController()
  contentController = controller
  const requestStudent = selectedStudent.value
  const requestTerm = selectedTerm.value
  const requestExam = examTypeId.value
  contentLoading.value = true
  error.value = ''
  try {
    if (tab.value === 'scores' && requestExam) {
      const response = await listH5Scores(requestStudent, requestTerm, requestExam, controller.signal)
      if (selectedStudent.value === requestStudent && selectedTerm.value === requestTerm && examTypeId.value === requestExam) {
        scoreData.value = response
        loadedTabs.value.add('scores')
      }
    } else if (tab.value === 'comment') {
      const response = await getH5Comment(requestStudent, requestTerm, controller.signal)
      if (selectedStudent.value === requestStudent && selectedTerm.value === requestTerm) {
        commentData.value = response
        loadedTabs.value.add('comment')
      }
    } else if (tab.value === 'honors') {
      const response = await listH5Honors(requestStudent, requestTerm, controller.signal)
      if (selectedStudent.value === requestStudent && selectedTerm.value === requestTerm) {
        honors.value = response.items
        loadedTabs.value.add('honors')
      }
    }
  } catch (value) {
    if (axiosAbort(value)) return
    error.value = messageOf(value)
  } finally {
    if (contentController === controller) {
      contentLoading.value = false
      contentController = undefined
    }
  }
}

function axiosAbort(value: unknown) {
  return value instanceof Error && (value.name === 'CanceledError' || value.name === 'AbortError')
}

function switchTab(nextTab: ContentTab) {
  if (nextTab === tab.value) return
  tab.value = nextTab
  if (loadedTabs.value.has(nextTab)) return // 已有缓存，直接展示
  clearResults()
  void queryContent(false) // 自动查询该 Tab 内容
}

onMounted(() => {
  document.title = `${schoolName.value} · 学生成长查询`
  initialize()
})
onBeforeUnmount(() => contentController?.abort())
</script>

<template>
  <main class="h5-page">
    <header class="h5-hero">
      <div class="h5-hero-inner">
        <span class="h5-seal" aria-hidden="true">{{ sealText }}</span>
        <p class="h5-hero-school">{{ schoolName }}</p>
        <h1>学生成长档案</h1>
        <p class="h5-hero-sub">成绩<i>·</i>班主任评语<i>·</i>荣誉 ｜ 仅展示已发布内容</p>
      </div>
    </header>

    <section v-if="loading" class="h5-card" aria-busy="true">
      <div class="h5-skeleton h5-skeleton--title"></div>
      <div class="h5-skeleton"></div>
      <div class="h5-skeleton h5-skeleton--short"></div>
    </section>

    <section v-else-if="state.flowState === 'LOGIN_CONFIRMATION_REQUIRED'" class="h5-card">
      <h2>微信身份确认</h2>
      <p>继续后将获取你的 OpenID 和昵称，用于建立独立查询会话。不会读取通讯录或发布内容。</p>
      <button :disabled="submitting" @click="continueLogin">{{ submitting ? '正在跳转…' : '同意并继续' }}</button>
      <small>如不希望授权，可直接关闭本页面。</small>
    </section>

    <form v-else-if="state.flowState === 'NEED_REGISTRATION'" class="h5-card h5-form" @submit.prevent="register">
      <h2>家长验证与学生绑定</h2>
      <p v-if="state.queryPreset" class="h5-preset">
        本次查询：{{ state.queryPreset.studentNameMasked || '待确认学生' }}
        <template v-if="state.queryPreset.requestedYear"> · {{ state.queryPreset.requestedYear }} 年</template>
        <template v-if="state.queryPreset.requestedExamTypeCode"> · {{ state.queryPreset.requestedExamTypeCode }}</template>
      </p>
      <label>学生姓名<input v-model.trim="form.studentName" :disabled="submitting" required maxlength="64" autocomplete="off" /></label>
      <label>学号<input v-model.trim="form.studentNo" :disabled="submitting" required maxlength="32" autocomplete="off" /></label>
      <label>身份证后四位<input v-model.trim="form.idCardLast4" :disabled="submitting" required maxlength="4" autocomplete="off" /></label>
      <label>学校登记监护人手机号<input v-model.trim="form.mobile" :disabled="submitting" required inputmode="numeric" maxlength="11" autocomplete="off" /></label>
      <label>
        短信验证码
        <span class="h5-code">
          <input v-model.trim="form.verificationCode" :disabled="submitting" required inputmode="numeric" maxlength="6" autocomplete="one-time-code" />
          <button type="button" :disabled="submitting" @click="sendCode">获取验证码</button>
        </span>
      </label>
      <label class="h5-agree"><input v-model="form.agreementAccepted" :disabled="submitting" type="checkbox" /> 我已阅读并同意家长查询服务协议</label>
      <button :disabled="submitting || !form.agreementAccepted" type="submit">{{ submitting ? '正在验证…' : '验证并绑定' }}</button>
    </form>

    <section v-else-if="isSelectionState" class="h5-card h5-selection">
      <h2>{{ selectionCopy.title }}</h2>
      <p>{{ selectionCopy.message }}</p>
      <p v-if="state.queryPreset" class="h5-preset">
        微信查询条件：{{ state.queryPreset.studentNameMasked || '本人学生' }}
        <template v-if="state.queryPreset.requestedYear"> · {{ state.queryPreset.requestedYear }} 年</template>
      </p>
      <fieldset v-if="candidates.length" class="h5-candidates" :disabled="submitting">
        <legend class="h5-visually-hidden">{{ selectionCopy.title }}</legend>
        <label v-for="(candidate, index) in candidates" :key="candidateKey(candidate, index)" class="h5-candidate">
          <input v-model="selectedCandidateIndex" type="radio" name="queryCandidate" :value="index" />
          <span><strong>{{ candidateTitle(candidate) }}</strong><small>{{ candidateDetail(candidate) }}</small></span>
        </label>
      </fieldset>
      <p v-else class="h5-empty">服务端未返回可确认候选，请重新加载。</p>
      <button class="h5-query" :disabled="!canConfirmCandidate" @click="confirmCandidate">
        {{ submitting ? '正在确认…' : '确认查询范围' }}
      </button>
    </section>

    <section v-else-if="state.flowState === 'READY' && !readyContextBlocked" class="h5-card h5-archive">
      <p v-if="readyPreset" class="h5-preset">
        已应用微信查询条件：{{ readyPreset.studentNameMasked || '本人学生' }}
        <template v-if="readyPreset.requestedYear"> · {{ readyPreset.requestedYear }} 年</template>
        <template v-if="readyPreset.requestedExamTypeCode"> · {{ readyPreset.requestedExamTypeCode }}</template>
      </p>

      <div v-if="terms.length" class="h5-querybox">
        <div class="h5-selects">
          <label class="h5-field h5-field--full">
            <span class="h5-field-label">学生</span>
            <span class="h5-select-wrap">
              <select v-model.number="selectedStudent" @change="changeStudent">
                <option v-for="student in students" :key="student.studentId" :value="student.studentId">{{ student.studentNameMasked }} · {{ student.className }}</option>
              </select>
            </span>
          </label>
          <label class="h5-field">
            <span class="h5-field-label">学期</span>
            <span class="h5-select-wrap">
              <select v-model.number="selectedTerm" @change="changeTerm">
                <option v-for="term in terms" :key="term.academicTermId" :value="term.academicTermId">{{ term.termName }}</option>
              </select>
            </span>
          </label>
          <label v-if="tab === 'scores'" class="h5-field">
            <span class="h5-field-label">考试类型</span>
            <span class="h5-select-wrap">
              <select v-model.number="examTypeId" @change="changeExam">
                <option :value="undefined" disabled>请选择考试类型</option>
                <option v-for="exam in availableExams" :key="exam.examTypeId" :value="exam.examTypeId">{{ exam.examTypeName }}</option>
              </select>
            </span>
          </label>
        </div>
        <p v-if="queryHint" class="h5-query-hint" role="status">{{ queryHint }}</p>

        <nav class="h5-tabs" role="tablist" aria-label="学生成长内容">
          <button type="button" role="tab" :aria-selected="tab === 'scores'" :class="{ active: tab === 'scores' }" @click="switchTab('scores')">
            成绩<i v-if="capabilityFlag(selectedTermCapability?.hasScores)" class="h5-tab-dot" aria-hidden="true"></i>
          </button>
          <button type="button" role="tab" :aria-selected="tab === 'comment'" :class="{ active: tab === 'comment' }" @click="switchTab('comment')">
            班主任评语<i v-if="capabilityFlag(selectedTermCapability?.hasTeacherComment)" class="h5-tab-dot" aria-hidden="true"></i>
          </button>
          <button type="button" role="tab" :aria-selected="tab === 'honors'" :class="{ active: tab === 'honors' }" @click="switchTab('honors')">
            荣誉<i v-if="capabilityFlag(selectedTermCapability?.hasHonors)" class="h5-tab-dot" aria-hidden="true"></i>
          </button>
        </nav>
        <button class="h5-query" :disabled="contentLoading" @click="queryContent()">{{ contentLoading ? '查询中…' : '查询已发布内容' }}</button>
      </div>

      <div v-else class="h5-empty-state">
        <p>本学期暂无已发布内容</p>
        <small>老师发布成绩、班主任评语或荣誉后，即可在这里查询。<br />如有疑问，请联系班主任。</small>
      </div>

      <div v-if="contentLoading" class="h5-result" aria-live="polite">
        <div class="h5-skeleton h5-skeleton--title"></div>
        <div class="h5-skeleton"></div>
        <div class="h5-skeleton"></div>
        <div class="h5-skeleton h5-skeleton--short"></div>
      </div>

      <div v-else-if="tab === 'scores' && scoreData" class="h5-result">
        <div class="h5-result-head">
          <h2>{{ scoreData.examType.examTypeName || '考试成绩' }}</h2>
          <p v-if="scoreData.term.termName" class="h5-result-meta">{{ scoreData.term.termName }}</p>
        </div>
        <div class="h5-summary">
          <div><span>总分</span><strong>{{ scoreData.summary.totalScore }}</strong></div>
          <div><span>平均分</span><strong>{{ scoreData.summary.averageScore }}</strong></div>
        </div>
        <ol v-if="scoreData.subjects.length" class="h5-score-list">
          <li v-for="subject in scoreData.subjects" :key="subject.resultId">
            <b class="h5-subject-name">{{ subject.subjectName }}</b>
            <span class="h5-leader" aria-hidden="true"></span>
            <strong class="h5-score-value">{{ subject.score ?? '未录入' }}</strong>
            <small v-if="subject.maxScore !== null" class="h5-score-max">/ {{ subject.maxScore }}</small>
          </li>
        </ol>
        <p v-else class="h5-empty">该范围暂无已发布成绩。</p>
      </div>

      <div v-else-if="tab === 'comment' && commentData" class="h5-result">
        <div class="h5-result-head">
          <h2>班主任评语</h2>
          <p v-if="commentData.comment" class="h5-result-meta">
            {{ commentData.comment.teacherNameDisplay || '班主任' }}
            <template v-if="commentData.comment.publishedAt"> · {{ formatDate(commentData.comment.publishedAt) }}</template>
          </p>
        </div>
        <template v-if="commentData.comment">
          <div v-if="commentData.comment.overallComment" class="h5-comment-block">
            <span class="h5-block-label">综合评语</span>
            <p>{{ commentData.comment.overallComment }}</p>
          </div>
          <div v-if="commentData.comment.strengths" class="h5-comment-block">
            <span class="h5-block-label">优点与亮点</span>
            <p>{{ commentData.comment.strengths }}</p>
          </div>
          <div v-if="commentData.comment.improvementPoints" class="h5-comment-block">
            <span class="h5-block-label">待改进之处</span>
            <p>{{ commentData.comment.improvementPoints }}</p>
          </div>
        </template>
        <p v-else class="h5-empty">本学期暂无已发布评语。<small>评语由班主任发布，发布后即可在这里查看。</small></p>
      </div>

      <div v-else-if="tab === 'honors'" class="h5-result">
        <div class="h5-result-head">
          <h2>荣誉记录</h2>
          <p v-if="honors.length" class="h5-result-meta">共 {{ honors.length }} 项</p>
        </div>
        <ul v-if="honors.length" class="h5-honor-list">
          <li v-for="honor in honors" :key="honor.honorId">
            <i class="h5-honor-mark" aria-hidden="true"></i>
            <div>
              <b>{{ honor.achievementText }}</b>
              <small>{{ formatDate(honor.awardedOn || honor.publishedAt) || honor.termName }}</small>
            </div>
          </li>
        </ul>
        <p v-else class="h5-empty">暂无已发布荣誉。<small>荣誉由班主任在后台发布，发布后即可在这里查看。</small></p>
      </div>
    </section>

    <section v-else class="h5-card h5-center">
      <h2>{{ readyContextBlocked ? '查询范围尚未确认' : statusContent.title }}</h2>
      <p>{{ readyContextBlocked ? '服务端尚未解析本次微信查询条件，为保护学生信息，不会使用默认成绩范围。请重新从微信进入查询。' : statusContent.message }}</p>
      <button v-if="readyContextBlocked || statusContent.retry" @click="initialize">重新加载</button>
    </section>

    <p v-if="queryContextWarning" class="h5-warning" role="status">{{ queryContextWarning }}</p>
    <p v-if="notice" class="h5-notice" role="status">{{ notice }}</p>
    <p v-if="error" class="h5-error" role="alert">{{ error }}</p>
    <footer>{{ schoolName }} · 查询结果仅供本人查看，请勿转发含学生隐私的截图</footer>
  </main>
</template>
