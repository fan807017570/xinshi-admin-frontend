export type SelectionStatus = 'ASSIGNED' | 'UNASSIGNED'

export interface TeachingClass {
  id: string
  name: string
  grade: number
  cohort: string
}

export interface CourseCombination {
  code: string
  label: string
  subjects: string[]
}

export interface SelectionStudent {
  id: string
  studentNo: string
  name: string
  termId: string
  classId: string
  className: string
  selectionCode: string | null
  selectionVersion: number
}

export interface ReportCandidate extends SelectionStudent {
  selectionReady: boolean
  subjectCount: number | null
  scoreCount: number | null
  missingSubjects: string[]
  ruleReady: boolean
  commentState: '已补齐' | '可选'
  technicalFailure: boolean
}

export type JobItemStatus =
  | 'PENDING'
  | 'CHECKING'
  | 'BLOCKED'
  | 'GENERATING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELED'

export interface DemoAttempt {
  time: string
  action: string
  outcome: string
  detail: string
}

export interface DemoJobItem extends ReportCandidate {
  status: JobItemStatus
  issues: string[]
  attempts: DemoAttempt[]
  retryCount: number
  lastUpdated: string
}

export interface DemoTranscriptJob {
  id: string
  termId: string
  termLabel: string
  classId: string
  className: string
  examName: string
  rosterFrozenAt: string
  resultVersion: string
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'COMPLETED_WITH_ISSUES' | 'CANCELED'
  createdAt: string
  items: DemoJobItem[]
}

export const TEACHING_DEMO_NOTICE = '本页面使用本地演示数据。选课、任务状态与报告生成尚无对应业务接口；页面不会写入学校业务数据，也不会生成真实成绩单文件。'

export const ACADEMIC_TERMS = [
  { id: '2026-fall', label: '2026—2027 学年第一学期' },
  { id: '2026-spring', label: '2025—2026 学年第二学期' }
]

export const TEACHING_CLASSES: TeachingClass[] = [
  { id: 'g10-01', name: '高一（1）班', grade: 10, cohort: '2026 届' },
  { id: 'g10-02', name: '高一（2）班', grade: 10, cohort: '2026 届' },
  { id: 'g11-01', name: '高二（1）班', grade: 11, cohort: '2025 届' }
]

const LANGUAGES = [
  { code: 'EN', label: '英语' },
  { code: 'JP', label: '日语' }
]
const PHYSICS_HISTORY = [
  { code: 'PH', label: '物理' },
  { code: 'HI', label: '历史' }
]
const ELECTIVES = [
  { code: 'CH', label: '化学' },
  { code: 'BI', label: '生物' },
  { code: 'GE', label: '地理' },
  { code: 'PO', label: '政治' }
]

function buildCombinations(): CourseCombination[] {
  const result: CourseCombination[] = []
  LANGUAGES.forEach((language) => {
    PHYSICS_HISTORY.forEach((track) => {
      for (let first = 0; first < ELECTIVES.length; first += 1) {
        for (let second = first + 1; second < ELECTIVES.length; second += 1) {
          const pair = [ELECTIVES[first], ELECTIVES[second]]
          const code = [language.code, track.code, pair[0].code, pair[1].code].join('-')
          result.push({
            code,
            label: [language.label, track.label, pair[0].label, pair[1].label].join(' · '),
            subjects: ['语文', '数学', language.label, track.label, pair[0].label, pair[1].label]
          })
        }
      }
    })
  })
  return result
}

export const COURSE_COMBINATIONS = buildCombinations()

const NAME_SETS = [
  ['陈佳宁', '周亦航', '林知夏', '许嘉禾', '沈书言', '叶思远', '顾清妍', '唐予安', '宋明哲', '吴语桐', '陆星河', '郑一诺'],
  ['姜若琳', '梁子墨', '韩雨桐', '邵安然', '高嘉懿', '罗心怡', '蒋星辰', '谢知遥', '秦书瑶', '冯亦辰', '许沐阳', '魏梓涵'],
  ['邱明月', '杜承宇', '蔡依诺', '袁景行', '钟可欣', '方知远', '苏念安', '孟言蹊', '白清越', '贺云舟', '姚书宁', '邓嘉树']
]

const STUDENT_STORAGE_KEY = 'xinshi-teaching-demo-selections-v1'
const JOB_STORAGE_KEY = 'xinshi-teaching-demo-jobs-v1'
const READINESS_STORAGE_KEY = 'xinshi-teaching-demo-readiness-v1'
const cancelRequests = new Set<string>()

function defaultStudents(): SelectionStudent[] {
  const students: SelectionStudent[] = []
  ACADEMIC_TERMS.forEach((term, termIndex) => {
    TEACHING_CLASSES.forEach((classInfo, classIndex) => {
      NAME_SETS[classIndex].forEach((name, studentIndex) => {
        const isUnassigned = (studentIndex + classIndex + termIndex) % 6 === 0
        const combination = COURSE_COMBINATIONS[(studentIndex * 3 + classIndex) % COURSE_COMBINATIONS.length]
        const year = termIndex === 0 ? '26' : '25'
        const studentNo = year + String(classInfo.grade) + String(classIndex + 1).padStart(2, '0') + String(studentIndex + 1).padStart(2, '0')
        students.push({
          id: term.id + '-' + classInfo.id + '-' + String(studentIndex + 1).padStart(2, '0'),
          studentNo,
          name,
          termId: term.id,
          classId: classInfo.id,
          className: classInfo.name,
          selectionCode: isUnassigned ? null : combination.code,
          selectionVersion: isUnassigned ? 0 : 1
        })
      })
    })
  })
  return students
}

function readJson<T>(key: string, fallback: () => T): T {
  const raw = localStorage.getItem(key)
  if (raw === null) return fallback()
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new Error('本地演示数据格式异常。请使用“恢复演示数据”清除损坏的演示记录后重试。')
  }
}

function readStudents(): SelectionStudent[] {
  return readJson(STUDENT_STORAGE_KEY, defaultStudents)
}

function writeStudents(students: SelectionStudent[]) {
  localStorage.setItem(STUDENT_STORAGE_KEY, JSON.stringify(students))
}

function readJobs(): DemoTranscriptJob[] {
  return readJson(JOB_STORAGE_KEY, () => [])
}

function writeJobs(jobs: DemoTranscriptJob[]) {
  localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(jobs))
}

function readReadinessOverrides(): Record<string, { missingSubjects: string[]; ruleReady: boolean }> {
  return readJson(READINESS_STORAGE_KEY, () => ({}))
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))
}

function nowLabel() {
  return new Date().toLocaleString('zh-CN', { hour12: false })
}

function getTermLabel(termId: string) {
  return ACADEMIC_TERMS.find((term) => term.id === termId)?.label ?? termId
}

export async function loadSelectionRoster(termId: string, classId: string): Promise<SelectionStudent[]> {
  await wait(180)
  return readStudents()
    .filter((student) => student.termId === termId && student.classId === classId)
    .sort((a, b) => a.studentNo.localeCompare(b.studentNo))
}

export async function saveSelectionBatch(
  termId: string,
  classId: string,
  studentIds: string[],
  combinationCode: string
): Promise<{ changed: number; unchanged: number }> {
  await wait(220)
  const combination = COURSE_COMBINATIONS.find((item) => item.code === combinationCode)
  if (!combination) throw new Error('请选择有效的修读组合。')
  const students = readStudents()
  const selected = new Set(studentIds)
  const scoped = students.filter((student) =>
    selected.has(student.id) && student.termId === termId && student.classId === classId
  )
  if (scoped.length !== selected.size) {
    throw new Error('所选学生已不在当前班级或学期，请刷新名单后重新选择。')
  }
  const unchanged = scoped.filter((student) => student.selectionCode === combinationCode).length
  const changedIds = new Set(scoped.filter((student) => student.selectionCode !== combinationCode).map((student) => student.id))
  const updated = students.map((student) =>
    changedIds.has(student.id)
      ? { ...student, selectionCode: combinationCode, selectionVersion: student.selectionVersion + 1 }
      : student
  )
  writeStudents(updated)
  return { changed: changedIds.size, unchanged }
}

function buildReadiness(student: SelectionStudent, classIndex: number, studentIndex: number): ReportCandidate {
  const combination = COURSE_COMBINATIONS.find((item) => item.code === student.selectionCode)
  const selectionReady = Boolean(combination)
  const subjects = combination?.subjects ?? []
  const missingSubjects = !selectionReady
    ? []
    : studentIndex % 7 === 2
      ? [subjects[4]]
      : studentIndex % 11 === 7
        ? [subjects[2], subjects[5]]
        : []
  const ruleReady = !selectionReady || studentIndex % 13 !== 9
  const completeScoreCount = selectionReady ? subjects.length - missingSubjects.length : null
  const technicalFailure = selectionReady && missingSubjects.length === 0 && ruleReady && classIndex === 0 && studentIndex === 10
  return {
    ...student,
    selectionReady,
    subjectCount: selectionReady ? subjects.length : null,
    scoreCount: completeScoreCount,
    missingSubjects,
    ruleReady,
    commentState: studentIndex % 4 === 0 ? '可选' : '已补齐',
    technicalFailure
  }
}

export async function loadReportCandidates(termId: string, classId: string): Promise<ReportCandidate[]> {
  await wait(180)
  const classIndex = Math.max(0, TEACHING_CLASSES.findIndex((item) => item.id === classId))
  const readinessOverrides = readReadinessOverrides()
  return readStudents()
    .filter((student) => student.termId === termId && student.classId === classId)
    .sort((a, b) => a.studentNo.localeCompare(b.studentNo))
    .map((student, studentIndex) => {
      const candidate = buildReadiness(student, classIndex, studentIndex)
      const override = readinessOverrides[student.id]
      return override
        ? { ...candidate, missingSubjects: override.missingSubjects, ruleReady: override.ruleReady, scoreCount: candidate.subjectCount === null ? null : candidate.subjectCount - override.missingSubjects.length }
        : candidate
    })
}

export async function loadDemoJobs(): Promise<DemoTranscriptJob[]> {
  await wait(100)
  return readJobs()
}

export async function createDemoJob(input: {
  termId: string
  classId: string
  examName: string
}): Promise<DemoTranscriptJob> {
  await wait(200)
  const classInfo = TEACHING_CLASSES.find((item) => item.id === input.classId)
  const term = ACADEMIC_TERMS.find((item) => item.id === input.termId)
  if (!classInfo || !term) throw new Error('请选择有效的学期与行政班。')
  const candidates = await loadReportCandidates(input.termId, input.classId)
  if (candidates.length === 0) throw new Error('当前范围没有参评学生，无法创建班级任务。')
  const job: DemoTranscriptJob = {
    id: 'DEMO-' + Date.now().toString(36).toUpperCase(),
    termId: input.termId,
    termLabel: term.label,
    classId: input.classId,
    className: classInfo.name,
    examName: input.examName,
    rosterFrozenAt: nowLabel(),
    resultVersion: 'V1（演示）',
    status: 'QUEUED',
    createdAt: nowLabel(),
    items: candidates.map((candidate) => ({
      ...candidate,
      status: 'PENDING',
      issues: [],
      attempts: [],
      retryCount: 0,
      lastUpdated: nowLabel()
    }))
  }
  const jobs = readJobs()
  jobs.unshift(job)
  writeJobs(jobs)
  return job
}

function updateJob(jobId: string, update: (job: DemoTranscriptJob) => DemoTranscriptJob): DemoTranscriptJob {
  const jobs = readJobs()
  const index = jobs.findIndex((job) => job.id === jobId)
  if (index < 0) throw new Error('找不到该演示任务，请重新载入任务列表。')
  jobs[index] = update(jobs[index])
  writeJobs(jobs)
  return jobs[index]
}

function recordAttempt(item: DemoJobItem, action: string, outcome: string, detail: string): DemoAttempt[] {
  return [...item.attempts, { time: nowLabel(), action, outcome, detail }]
}

export async function processDemoJob(
  jobId: string,
  onChange: (job: DemoTranscriptJob) => void
): Promise<DemoTranscriptJob> {
  cancelRequests.delete(jobId)
  let job = updateJob(jobId, (current) => ({ ...current, status: 'RUNNING' }))
  onChange(job)

  const pendingIds = job.items.filter((item) => item.status === 'PENDING').map((item) => item.id)
  for (const studentId of pendingIds) {
    if (cancelRequests.has(jobId)) break
    job = updateJob(jobId, (current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === studentId ? { ...item, status: 'CHECKING', lastUpdated: nowLabel() } : item
      )
    }))
    onChange(job)
    await wait(100)

    const candidate = job.items.find((item) => item.id === studentId)
    if (!candidate) continue
    const issues = [
      ...(!candidate.selectionReady ? ['待确认选课'] : []),
      ...(candidate.missingSubjects.length ? ['缺少成绩：' + candidate.missingSubjects.join('、')] : []),
      ...(!candidate.ruleReady && candidate.selectionReady ? ['缺少可用的等级规则'] : [])
    ]

    if (issues.length) {
      job = updateJob(jobId, (current) => ({
        ...current,
        items: current.items.map((item) =>
          item.id === studentId
            ? {
                ...item,
                status: 'BLOCKED',
                issues,
                lastUpdated: nowLabel(),
                attempts: recordAttempt(item, '资料校验', '待补齐', issues.join('；'))
              }
            : item
        )
      }))
      onChange(job)
      await wait(70)
      continue
    }

    job = updateJob(jobId, (current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === studentId ? { ...item, status: 'GENERATING', lastUpdated: nowLabel() } : item
      )
    }))
    onChange(job)
    await wait(130)

    const failOnce = Boolean(candidate.technicalFailure && candidate.retryCount === 0)
    job = updateJob(jobId, (current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === studentId
          ? {
              ...item,
              status: failOnce ? 'FAILED' : 'SUCCEEDED',
              issues: failOnce ? ['演示渲染失败：模拟PDF校验异常'] : [],
              lastUpdated: nowLabel(),
              attempts: recordAttempt(
                item,
                '演示生成',
                failOnce ? '技术失败' : '演示完成',
                failOnce ? '未生成真实文件；仅演示失败恢复流程。' : '演示完成；本地没有生成真实成绩单文件。'
              )
            }
          : item
      )
    }))
    onChange(job)
    await wait(70)
  }

  job = updateJob(jobId, (current) => {
    const items = current.items.map((item) =>
      cancelRequests.has(jobId) && item.status === 'PENDING'
        ? { ...item, status: 'CANCELED' as const, lastUpdated: nowLabel() }
        : item
    )
    const canceled = cancelRequests.has(jobId)
    const allSuccessful = items.every((item) => item.status === 'SUCCEEDED')
    return {
      ...current,
      items,
      status: canceled ? 'CANCELED' : allSuccessful ? 'SUCCEEDED' : 'COMPLETED_WITH_ISSUES'
    }
  })
  onChange(job)
  return job
}

export async function retryBlockedDemoItem(jobId: string, itemId: string): Promise<DemoTranscriptJob> {
  const currentJob = readJobs().find((job) => job.id === jobId)
  const currentItem = currentJob?.items.find((item) => item.id === itemId)
  if (!currentJob || !currentItem || currentItem.status !== 'BLOCKED') {
    throw new Error('该学生当前没有待补齐事项，请刷新任务状态。')
  }
  if (!currentItem.selectionReady) {
    await saveSelectionBatch(currentJob.termId, currentJob.classId, [itemId], COURSE_COMBINATIONS[0].code)
  }
  const overrides = readReadinessOverrides()
  overrides[itemId] = { missingSubjects: [], ruleReady: true }
  localStorage.setItem(READINESS_STORAGE_KEY, JSON.stringify(overrides))
  return updateJob(jobId, (job) => ({
    ...job,
    status: 'COMPLETED_WITH_ISSUES',
    items: job.items.map((item) => {
      if (item.id !== itemId || item.status !== 'BLOCKED') return item
      const repaired = {
        ...item,
        selectionReady: true,
        selectionCode: item.selectionCode ?? COURSE_COMBINATIONS[0].code,
        selectionVersion: item.selectionVersion || 1,
        scoreCount: item.subjectCount ?? 6,
        subjectCount: item.subjectCount ?? 6,
        missingSubjects: [],
        ruleReady: true,
        technicalFailure: false,
        status: 'PENDING' as const,
        issues: [],
        lastUpdated: nowLabel(),
        attempts: recordAttempt(item, '演示补齐与重验', '已就绪', '示例资料已在本地演示状态中补齐；未写入业务系统。')
      }
      return repaired
    })
  }))
}

export async function retryFailedDemoItem(jobId: string, itemId: string): Promise<DemoTranscriptJob> {
  return updateJob(jobId, (job) => ({
    ...job,
    status: 'COMPLETED_WITH_ISSUES',
    items: job.items.map((item) => {
      if (item.id !== itemId || item.status !== 'FAILED') return item
      return {
        ...item,
        technicalFailure: false,
        status: 'PENDING',
        issues: [],
        retryCount: item.retryCount + 1,
        lastUpdated: nowLabel(),
        attempts: recordAttempt(item, '仅重试该学生', '已排队', '复用当前演示结果版本；其他学生状态保持不变。')
      }
    })
  }))
}

export function requestDemoJobCancel(jobId: string): void {
  cancelRequests.add(jobId)
}

export function resetTeachingDemoData(): void {
  localStorage.removeItem(STUDENT_STORAGE_KEY)
  localStorage.removeItem(JOB_STORAGE_KEY)
  localStorage.removeItem(READINESS_STORAGE_KEY)
}

