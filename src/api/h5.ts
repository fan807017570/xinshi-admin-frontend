import axios, { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'

export type H5FlowState =
  | 'CHECKING'
  | 'LOGIN_CONFIRMATION_REQUIRED'
  | 'NEED_REGISTRATION'
  | 'READY'
  | 'ACCOUNT_DISABLED'
  | 'ACCOUNT_INCOMPLETE'
  | 'STUDENT_NAME_NOT_BOUND'
  | 'STUDENT_SELECTION_REQUIRED'
  | 'TERM_SELECTION_REQUIRED'
  | 'EXAM_SELECTION_REQUIRED'
  | 'GUARDIAN_AUTH_REQUIRED'
  | 'MAINTENANCE'

export type H5SelectionState =
  | 'STUDENT_SELECTION_REQUIRED'
  | 'TERM_SELECTION_REQUIRED'
  | 'EXAM_SELECTION_REQUIRED'

export interface H5Student {
  studentId: number
  studentNameMasked: string
  studentNoMasked?: string
  className: string
}

export interface H5ExamType {
  examTypeId: number
  examTypeName: string
}

export interface H5AcademicTermCapability {
  academicTermId: number
  termName: string
  current?: boolean
  hasScores: boolean | number
  hasTeacherComment: boolean | number
  hasHonors?: boolean | number
  honorCount?: number
  examTypes: H5ExamType[]
}

export interface H5QueryPreset {
  source?: 'WECHAT_TEXT'
  studentMatched?: boolean
  studentNameMasked?: string
  requestedYear?: number
  requestedExamTypeCode?: string
  resolvedStudentId?: number
  resolvedAcademicTermId?: number
  resolvedExamTypeId?: number
  resolutionState:
    | 'PENDING'
    | 'RESOLVED'
    | 'STUDENT_SELECTION_REQUIRED'
    | 'TERM_SELECTION_REQUIRED'
    | 'EXAM_SELECTION_REQUIRED'
}

export interface H5QueryCandidate {
  studentId?: number
  studentNameMasked?: string
  studentNoMasked?: string
  className?: string
  academicTermId?: number
  termName?: string
  examTypeId?: number
  examTypeName?: string
}

export interface H5QueryContextWarning {
  code?: string
  message: string
}

export interface H5FlowResponse {
  flowState: H5FlowState
  csrfToken?: string
  loginConfirmationToken?: string
  schoolName?: string
  mobileMasked?: string
  students?: H5Student[]
  defaultStudentId?: number
  queryPreset?: H5QueryPreset
  candidates?: H5QueryCandidate[]
  queryContextWarning?: H5QueryContextWarning
}

export interface H5RegistrationRequest {
  studentName: string
  mobile: string
  verificationCode: string
  studentNo: string
  idCardLast4: string
  agreementVersion: string
}

export interface H5QueryContextResolveRequest {
  studentId?: number
  academicTermId?: number
  examTypeId?: number
}

export interface H5ScoreSubject {
  resultId: number
  subjectId: number
  subjectCode?: string
  subjectName: string
  score: number | null
  maxScore: number | null
  sortOrder: number
  hasDetail: boolean | number
}

export interface H5ScoreResponse {
  student: H5Student
  term: { academicTermId: number; termName: string }
  examType: H5ExamType
  summary: {
    totalScore: number
    averageScore: number
    subjectCount: number
    classRank?: number | null
  }
  subjects: H5ScoreSubject[]
}

export interface H5TeacherCommentResponse {
  student: H5Student
  comment: null | {
    commentId: number
    academicTermId: number
    termName: string
    teacherNameDisplay?: string
    overallComment?: string
    strengths?: string
    improvementPoints?: string
    publishedAt: string
  }
}

export interface H5Honor {
  honorId: number
  academicTermId: number
  termName: string
  achievementText: string
  awardedOn?: string
  publishedAt: string
}

export interface H5HonorPage {
  student: H5Student
  items: H5Honor[]
  page: number
  pageSize: number
  total: number
  hasNext: boolean
}

export interface H5MobileCodeResponse {
  retryAfterSeconds?: number
}

export interface H5LoginConfirmationResponse {
  authorizeUrl: string
}

interface H5Envelope<T> {
  success: boolean
  code?: string
  message?: string
  data: T
  traceId?: string
}

export class H5ApiError extends Error {
  readonly code?: string
  readonly status?: number
  readonly data?: unknown

  constructor(message: string, code?: string, status?: number, data?: unknown) {
    super(message)
    this.name = 'H5ApiError'
    this.code = code
    this.status = status
    this.data = data
  }
}

let csrfToken = ''

const h5 = axios.create({ baseURL: '/api/h5', timeout: 10000, withCredentials: true })

h5.interceptors.request.use((config) => {
  const headers = AxiosHeaders.from(config.headers)
  headers.set('Content-Type', 'application/json')
  if (csrfToken && !['get', 'head', 'options'].includes(String(config.method).toLowerCase())) {
    headers.set('X-H5-CSRF', csrfToken)
  }
  config.headers = headers
  return config
})

h5.interceptors.response.use(
  (response) => response,
  (error: AxiosError<H5Envelope<unknown>>) => {
    if (axios.isCancel(error)) return Promise.reject(error)
    const body = error.response?.data
    return Promise.reject(new H5ApiError(
      body?.message || error.message || '请求失败',
      body?.code,
      error.response?.status,
      body?.data
    ))
  }
)

async function unwrap<T>(request: Promise<AxiosResponse<H5Envelope<T>>>): Promise<T> {
  const response = await request
  return response.data.data
}

export function setH5Csrf(value?: string) {
  csrfToken = value || ''
}

export const bootstrapH5 = (appid: string) =>
  unwrap(h5.get<H5Envelope<H5FlowResponse>>('/bootstrap', { params: { appid } }))

export const confirmWechatLogin = (loginConfirmationToken: string) =>
  unwrap(h5.post<H5Envelope<H5LoginConfirmationResponse>>('/wechat/login-confirmations', { loginConfirmationToken }))

export const sendMobileCode = (mobile: string) =>
  unwrap(h5.post<H5Envelope<H5MobileCodeResponse>>('/mobile/verification-codes', { mobile }))

export const registerParent = (data: H5RegistrationRequest) =>
  unwrap(h5.post<H5Envelope<H5FlowResponse>>('/registrations', data))

export const listH5Students = () =>
  unwrap(h5.get<H5Envelope<H5Student[]>>('/students'))

export const listH5Terms = (studentId: number) =>
  unwrap(h5.get<H5Envelope<H5AcademicTermCapability[]>>(`/students/${studentId}/terms`))

export const listH5Scores = (
  studentId: number,
  academicTermId: number,
  examTypeId: number,
  signal?: AbortSignal
) => unwrap(h5.get<H5Envelope<H5ScoreResponse>>(`/students/${studentId}/scores`, {
  params: { academicTermId, examTypeId },
  signal
}))

export const getH5Comment = (studentId: number, academicTermId: number, signal?: AbortSignal) =>
  unwrap(h5.get<H5Envelope<H5TeacherCommentResponse>>(`/students/${studentId}/teacher-comments`, {
    params: { academicTermId },
    signal
  }))

export const listH5Honors = (studentId: number, academicTermId: number, signal?: AbortSignal) =>
  unwrap(h5.get<H5Envelope<H5HonorPage>>(`/students/${studentId}/honors`, {
    params: { academicTermId, page: 1, pageSize: 20 },
    signal
  }))

export const resolveH5Context = (data: H5QueryContextResolveRequest) =>
  unwrap(h5.post<H5Envelope<H5FlowResponse>>('/query-context/resolve', data))

export const logoutH5 = () =>
  unwrap(h5.post<H5Envelope<null>>('/logout'))
