import http from './http'

export type QueryParams = Record<string, string | number | boolean | undefined | null>

export interface AuthUser {
  id: number | string
  loginName: string
  realName: string
  mobile?: string
  email?: string
  roleCodes: string[]
  token: string
  roles: string[]
  menus: string[]
  landingPage?: string
}

export interface LoginResponse {
  userId: number | string
  loginName: string
  realName: string
  mobile?: string
  email?: string
  roleCodes: string[]
  token: string
  roles: string[]
  menus: string[]
  landingPage?: string
}

export function normalizeUser(data: LoginResponse): AuthUser {
  return {
    id: data.userId,
    loginName: data.loginName,
    realName: data.realName,
    mobile: data.mobile,
    email: data.email,
    roleCodes: data.roleCodes ?? [],
    token: data.token,
    roles: data.roles ?? [],
    menus: data.menus ?? [],
    landingPage: data.landingPage
  }
}

export const login = (payload: { loginName: string; password: string }) =>
  http.post<LoginResponse>('/auth/login', payload).then((res) => res.data)

export const getCurrentUser = () => http.get<LoginResponse>('/auth/me').then((res) => res.data)
export const logout = () => http.post('/auth/logout').then((res) => res.data)
export const updateProfile = (payload: unknown) => http.put('/auth/profile', payload).then((res) => res.data)
export const getDashboardSummary = () => http.get('/dashboard/summary').then((res) => res.data)

export const listUsers = (params: QueryParams = {}) => http.get('/users', { params }).then((res) => res.data)
export const loginNameExists = (loginName: string) =>
  http.get<{ exists: boolean }>('/users/login-name-exists', { params: { loginName } }).then((res) => res.data)
export const createUser = (payload: unknown) => http.post('/users', payload).then((res) => res.data)
export const updateUser = (id: string | number, payload: unknown) =>
  http.put(`/users/${id}`, payload).then((res) => res.data)
export const updateUserStatus = (id: string | number, status: number) =>
  http.patch(`/users/${id}/status`, { status }).then((res) => res.data)
export const updateUserRoles = (id: string | number, roleCodes: string[]) =>
  http.put(`/users/${id}/roles`, { roleCodes }).then((res) => res.data)

export const listRoles = () => http.get('/roles').then((res) => res.data)
export const listMenus = () => http.get('/menus').then((res) => res.data)
export const createRole = (payload: unknown) => http.post('/roles', payload).then((res) => res.data)

export const listAcademicTerms = () => http.get('/academic-terms').then((res) => res.data)
export const createAcademicTerm = (payload: unknown) => http.post('/academic-terms', payload).then((res) => res.data)
export const updateAcademicTerm = (id: string | number, payload: unknown) =>
  http.put(`/academic-terms/${id}`, payload).then((res) => res.data)

export const listClasses = (params: QueryParams = {}) => http.get('/classes', { params }).then((res) => res.data)
export const listClassFilterOptions = (params: QueryParams = {}) =>
  http.get('/classes/filter-options', { params }).then((res) => res.data)
export const searchTeachers = (keyword: string) =>
  http.get('/teachers/search', { params: { keyword } }).then((res) => res.data)
export const createClass = (payload: unknown) => http.post('/classes', payload).then((res) => res.data)
export const updateClass = (id: string | number, payload: unknown) => http.put(`/classes/${id}`, payload).then((res) => res.data)
export const deleteClass = (id: string | number) => http.delete(`/classes/${id}`).then((res) => res.data)

export const listSubjects = (params: QueryParams = {}) => http.get('/subjects', { params }).then((res) => res.data)
export const createSubject = (payload: unknown) => http.post('/subjects', payload).then((res) => res.data)
export const updateSubject = (id: string | number, payload: unknown) => http.put(`/subjects/${id}`, payload).then((res) => res.data)
export const listGradeSubjects = (academicTermId: string | number, gradeLevel: string | number) =>
  http.get('/grade-subjects', { params: { academicTermId, gradeLevel } }).then((res) => res.data)
export interface SaveGradeSubjectsPayload {
  academicTermId: string | number
  gradeLevel: number
  subjects: Array<{
    subjectId: string | number
    isRequired?: number
    sortOrder?: number
    status?: number
  }>
}

export const saveGradeSubjects = (payload: SaveGradeSubjectsPayload) =>
  http.put('/grade-subjects', payload).then((res) => res.data)
export const listClassSubjects = (
  academicTermId: string | number,
  classId: string | number,
  mode?: 'teacher' | 'headTeacher'
) => http.get('/class-subjects', { params: { academicTermId, classId, mode } }).then((res) => res.data)
export const updateClassSubjectTeacher = (id: string | number, teacherUserId: string | number | null) =>
  http.put(`/class-subjects/${id}/teacher`, { teacherUserId }).then((res) => res.data)
export const createClassSubject = (payload: unknown) => http.post('/class-subjects', payload).then((res) => res.data)
export const deleteClassSubject = (id: string | number) => http.delete(`/class-subjects/${id}`).then((res) => res.data)

export const listStudents = (params: QueryParams = {}) => http.get('/students', { params }).then((res) => res.data)
export const createStudent = (payload: unknown) => http.post('/students', payload).then((res) => res.data)
export const updateStudent = (id: string | number, payload: unknown) => http.put(`/students/${id}`, payload).then((res) => res.data)
export const deleteStudent = (id: string | number) => http.delete(`/students/${id}`).then((res) => res.data)

export const listStudentResults = (params: QueryParams = {}, signal?: AbortSignal) =>
  http.get('/student-results', { params, signal }).then((res) => res.data)
export const listTeacherScoreEntries = (params: QueryParams = {}) =>
  http.get('/teacher-score-entries', { params }).then((res) => res.data)
export const saveStudentResult = (payload: unknown) => http.post('/student-results', payload).then((res) => res.data)
export const publishStudentResult = (id: string | number) =>
  http.patch(`/student-results/${id}/publish`).then((res) => res.data)
export const deleteStudentResult = (id: string | number) =>
  http.delete(`/student-results/${id}`).then((res) => res.data)
export const listOverallComments = (params: QueryParams = {}) =>
  http.get('/student-overall-comments', { params }).then((res) => res.data)
export const saveOverallComment = (payload: unknown) =>
  http.post('/student-overall-comments', payload).then((res) => res.data)
export const polishComment = (text: string) => http.post('/comments/polish', { text }).then((res) => res.data)

export const listTranscripts = (params: QueryParams = {}) => http.get('/transcripts', { params }).then((res) => res.data)
export const createTranscript = (payload: unknown) => http.post('/transcripts', payload).then((res) => res.data)
export const regenerateTranscript = (id: string | number) => http.post(`/transcripts/${id}/regenerate`).then((res) => res.data)
export const downloadTranscript = (
  id: string | number,
  options?: { signal?: AbortSignal; onProgress?: (percent: number) => void }
) =>
  http.get(`/transcripts/${id}/download`, {
    responseType: 'blob',
    timeout: 120000,
    signal: options?.signal,
    onDownloadProgress: (event) => {
      if (options?.onProgress && event.total) {
        options.onProgress(Math.round((event.loaded * 100) / event.total))
      }
    }
  })

export const listEnrollGrades = () => http.get('/enroll-grades').then((res) => res.data)
export const saveEnrollGrades = (gradeLevels: number[]) =>
  http.put('/enroll-grades', { gradeLevels }).then((res) => res.data)
export const listHonorTypes = () => http.get('/honor-types').then((res) => res.data)
export const listEnabledHonorTypes = () => http.get('/honor-types/enabled').then((res) => res.data)
export const createHonorType = (payload: unknown) => http.post('/honor-types', payload).then((res) => res.data)
export const updateHonorType = (id: string | number, payload: unknown) =>
  http.put(`/honor-types/${id}`, payload).then((res) => res.data)
export const listExamTypes = () => http.get('/exam-types').then((res) => res.data)
export const createExamType = (payload: unknown) => http.post('/exam-types', payload).then((res) => res.data)
export const updateExamType = (id: string | number, payload: unknown) =>
  http.put(`/exam-types/${id}`, payload).then((res) => res.data)
export const listStudentAchievements = (studentId: string | number, academicTermId: string | number) =>
  http.get(`/students/${studentId}/achievements`, { params: { academicTermId } }).then((res) => res.data)
export const createStudentAchievement = (studentId: string | number, payload: unknown) =>
  http.post(`/students/${studentId}/achievements`, payload).then((res) => res.data)
export const updateAchievement = (id: string | number, payload: unknown) =>
  http.put(`/achievements/${id}`, payload).then((res) => res.data)
export const deleteAchievement = (id: string | number) => http.delete(`/achievements/${id}`).then((res) => res.data)

// ==================== Excel 导入导出 ====================

// 场景 A：导出单科成绩模版
export const exportCourseResultTemplate = (params: {
  academicTermId: number
  gradeSession: string
  gradeLevel: number
  classId: number
  subjectId: number
  examTypeId: number
}) =>
  http.get('/course-results/export-template', {
    params,
    responseType: 'blob',
    timeout: 30000
  })

// 场景 A：导入单科成绩
export const importCourseResults = (file: File, enableAiPolish = false) => {
  const fd = new FormData()
  fd.append('file', file)
  return http.post('/course-results/import', fd, {
    params: { enableAiPolish: String(enableAiPolish) },
    timeout: 120000
  }).then((res) => res.data)
}

export interface CourseImportContext {
  academicTermId: number
  gradeSession: string
  gradeLevel: number
  classId: number
  subjectId: number
  examTypeId: number
}

export interface ParentContentImportContext {
  academicTermId: number
  gradeSession: string
  gradeLevel: number
  classId: number
}

export const precheckCourseResults = (file: File, context: CourseImportContext) => {
  const fd = new FormData()
  fd.append('file', file)
  return http.post('/course-results/import/precheck', fd, {
    params: context,
    timeout: 120000
  }).then((res) => res.data)
}

export const commitCourseResults = (importToken: string) =>
  http.post('/course-results/import/commit', { importToken }, { timeout: 120000 })
    .then((res) => res.data)

// 场景 B：导出综合评价与荣誉模版
export const exportHeadTeacherTemplate = (params: {
  academicTermId: number
  gradeSession: string
  gradeLevel: number
  classId: number
}) =>
  http.get('/head-teacher/export-template', {
    params,
    responseType: 'blob',
    timeout: 30000
  })

// 场景 B：导入综合评价与荣誉
export const importHeadTeacherData = (file: File, enableAiPolish = false) => {
  const fd = new FormData()
  fd.append('file', file)
  return http.post('/head-teacher/import', fd, {
    params: { enableAiPolish: String(enableAiPolish) },
    timeout: 120000
  }).then((res) => res.data)
}

export const precheckHeadTeacherData = (
  file: File,
  context: ParentContentImportContext,
  enableAiPolish = false
) => {
  const fd = new FormData()
  fd.append('file', file)
  return http.post('/head-teacher/import/precheck', fd, {
    params: { ...context, enableAiPolish: String(enableAiPolish) },
    timeout: 120000
  }).then((res) => res.data)
}

export const commitHeadTeacherData = (importToken: string) =>
  http.post('/head-teacher/import/commit', { importToken }, { timeout: 120000 })
    .then((res) => res.data)
