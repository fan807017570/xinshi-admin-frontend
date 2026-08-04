<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import AppModal from '../components/AppModal.vue'
import { useAuthStore } from '../stores/auth'
import {
  createAcademicTerm,
  createExamType,
  createHonorType,
  createRole,
  createSubject,
  listAcademicTerms,
  listClassSubjects,
  listClasses,
  listEnrollGrades,
  listExamTypes,
  listGradeSubjects,
  listHonorTypes,
  listRoles,
  listSubjects,
  saveGradeSubjects,
  saveEnrollGrades,
  searchTeachers,
  updateAcademicTerm,
  updateClassSubjectTeacher,
  updateExamType,
  updateHonorType,
  updateSubject
} from '../api/school'

const loading = ref(false)
const auth = useAuthStore()
const canManageAcademicConfigs = computed(() => auth.canManageAcademicConfigs)
const error = ref('')
const modalVisible = ref(false)
const modalTitle = ref('')
const modalError = ref('')
const modalType = ref<'role' | 'term' | 'subject' | 'honor' | 'exam'>('term')
const editing = ref<any | null>(null)
const teacherModalVisible = ref(false)
const teacherModalError = ref('')
const teacherKeyword = ref('')
const teacherSearchRows = ref<any[]>([])
const teacherSearchLoading = ref(false)
let teacherSearchTimer: ReturnType<typeof setTimeout> | null = null
const teacherAssignItem = ref<any | null>(null)
const selectedTeacherId = ref<string | number | null>(null)
const gradeSubjectModalVisible = ref(false)
const gradeSubjectModalError = ref('')

const roles = ref<any[]>([])
const terms = ref<any[]>([])
const classes = ref<any[]>([])
const subjects = ref<any[]>([])
const enrollGradeRows = ref<any[]>([])
const selectedGrades = ref<Set<number>>(new Set())
const gradeSaving = ref(false)
const gradeSaveSuccess = ref('')
const gradeSaveError = ref('')

const activeGradeLevels = computed(() =>
  Array.from(selectedGrades.value).sort((a, b) => a - b)
)
const honorTypes = ref<any[]>([])
const examTypes = ref<any[]>([])
const gradeSubjectRows = ref<any[]>([])
const gradeSubjectSelected = ref<Array<string | number>>([])
const classSubjectRows = ref<any[]>([])
const teachers = ref<any[]>([])

const form = reactive<Record<string, any>>({})
const gradeSubjectFilter = reactive({
  academicTermId: '',
  gradeLevel: 7
})
const classSubjectFilter = reactive({
  academicTermId: '',
  classId: ''
})
const gradeSubjectForm = reactive({
  academicTermId: '',
  gradeLevel: 7
})

function rows(data: any) {
  if (Array.isArray(data)) return data
  return data?.records ?? data?.list ?? data?.items ?? data?.data ?? []
}

function normalizeGradeLevels(data: any) {
  const source = Array.isArray(data) ? data : data?.gradeLevels ?? rows(data)
  return source
    .map((item: any) => Number(item?.gradeLevel ?? item?.value ?? item))
    .filter((item: number) => Number.isFinite(item) && item > 0)
}

function toggleGrade(gradeLevel: number) {
  const next = new Set(selectedGrades.value)
  if (next.has(gradeLevel)) {
    next.delete(gradeLevel)
  } else {
    next.add(gradeLevel)
  }
  selectedGrades.value = next
}

async function reloadEnrollGrades() {
  try {
    const data = await listEnrollGrades()
    enrollGradeRows.value = Array.isArray(data) ? data : data?.gradeLevels ?? rows(data)
    // Only select active grades
    selectedGrades.value = new Set(
      enrollGradeRows.value
        .filter((item: any) => Number(item.status ?? item.enabled ?? 1) === 1)
        .map((item: any) => Number(item.gradeLevel ?? item.value ?? item))
        .filter((n: number) => Number.isFinite(n) && n > 0)
    )
  } catch {
    // Keep current selection on reload failure
  }
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const [
      roleRows,
      termRows,
      classRows,
      subjectRows,
      gradeRows,
      honorRows,
      examRows,
      teacherRows
    ] = await Promise.all([
      listRoles(),
      listAcademicTerms(),
      listClasses(),
      listSubjects(),
      listEnrollGrades(),
      listHonorTypes(),
      listExamTypes(),
      searchTeachers('')
    ])
    roles.value = rows(roleRows)
    terms.value = rows(termRows)
    classes.value = rows(classRows)
    subjects.value = rows(subjectRows)
    enrollGradeRows.value = Array.isArray(gradeRows) ? gradeRows : rows(gradeRows)
    selectedGrades.value = new Set(
      enrollGradeRows.value
        .filter((item: any) => Number(item.status ?? item.enabled ?? 1) === 1)
        .map((item: any) => Number(item.gradeLevel ?? item.value ?? item))
        .filter((n: number) => Number.isFinite(n) && n > 0)
    )
    honorTypes.value = rows(honorRows)
    examTypes.value = rows(examRows)
    teachers.value = rows(teacherRows)
    const defaultTerm = terms.value.find((item) => item.current) ?? terms.value[0]
    if (!gradeSubjectFilter.academicTermId && defaultTerm) {
      gradeSubjectFilter.academicTermId = defaultTerm.id
    }
    if (!classSubjectFilter.academicTermId && defaultTerm) {
      classSubjectFilter.academicTermId = defaultTerm.id
    }
    if (!classSubjectFilter.classId && classes.value[0]) {
      classSubjectFilter.classId = classes.value[0].id
    }
    await Promise.all([loadGradeSubjects(), loadClassSubjectsForTeacher()])
  } catch (err) {
    error.value = err instanceof Error ? err.message : '配置加载失败'
  } finally {
    loading.value = false
  }
}

function openModal(type: typeof modalType.value, item?: any) {
  modalType.value = type
  editing.value = item ?? null
  modalError.value = ''
  Object.keys(form).forEach((key) => delete form[key])
  Object.assign(form, item ?? defaultForm(type))
  if (item && type === 'term') {
    form.status = item.status ?? (item.current ? 1 : 0)
  }
  if (item && type === 'honor') {
    form.honorTypeCode = item.honorTypeCode ?? item.code ?? ''
    form.honorTypeName = item.honorTypeName ?? item.honorName ?? item.name ?? ''
    form.status = item.status ?? (item.enabled === false ? 0 : 1)
  }
  if (item && type === 'exam') {
    form.examTypeCode = item.examTypeCode ?? item.code ?? ''
    form.examTypeName = item.examTypeName ?? item.name ?? ''
    form.status = item.status ?? (item.enabled === false ? 0 : 1)
  }
  modalTitle.value = `${item ? '编辑' : '新增'}${typeLabel(type)}`
  modalVisible.value = true
}

function defaultForm(type: typeof modalType.value) {
  if (type === 'role') {
    return { roleCode: '', roleName: '', status: 1 }
  }
  if (type === 'term') {
    return { termCode: '', termName: '', academicYear: '', startDate: '', endDate: '', status: 1 }
  }
  if (type === 'subject') {
    return { subjectCode: '', subjectName: '', minScore: 0, maxScore: 100, status: 1 }
  }
  if (type === 'honor') {
    return { honorTypeCode: '', honorTypeName: '', sortOrder: 0, status: 1 }
  }
  return { examTypeCode: '', examTypeName: '', sortOrder: 0, status: 1 }
}

function typeLabel(type: typeof modalType.value) {
  return ({ role: '角色', term: '学期', subject: '科目', honor: '荣誉类型', exam: '考试类型' } as const)[type]
}

async function submitModal() {
  modalError.value = ''
  try {
    if (modalType.value === 'role') {
      await createRole(form)
    } else if (modalType.value === 'term') {
      editing.value ? await updateAcademicTerm(editing.value.id, form) : await createAcademicTerm(form)
    } else if (modalType.value === 'subject') {
      editing.value ? await updateSubject(editing.value.id, form) : await createSubject(form)
    } else if (modalType.value === 'honor') {
      editing.value ? await updateHonorType(editing.value.id, form) : await createHonorType(form)
    } else {
      editing.value ? await updateExamType(editing.value.id, form) : await createExamType(form)
    }
    modalVisible.value = false
    await loadData()
  } catch (err) {
    modalError.value = err instanceof Error ? err.message : '保存失败'
  }
}

async function saveGrades() {
  gradeSaveError.value = ''
  gradeSaveSuccess.value = ''
  gradeSaving.value = true
  try {
    const gradeLevels = Array.from(selectedGrades.value).sort((a, b) => a - b)
    await saveEnrollGrades(gradeLevels)
    gradeSaveSuccess.value = '年级配置已保存'
    await reloadEnrollGrades()
    setTimeout(() => { gradeSaveSuccess.value = '' }, 3000)
  } catch (err) {
    gradeSaveError.value = err instanceof Error ? err.message : '招生年级保存失败'
  } finally {
    gradeSaving.value = false
  }
}

async function loadGradeSubjects() {
  if (!gradeSubjectFilter.academicTermId || !gradeSubjectFilter.gradeLevel) {
    gradeSubjectRows.value = []
    gradeSubjectSelected.value = []
    return
  }
  const data = await listGradeSubjects(gradeSubjectFilter.academicTermId, gradeSubjectFilter.gradeLevel)
  gradeSubjectRows.value = rows(data)
  gradeSubjectSelected.value = gradeSubjectRows.value
    .filter((item) => item.enabled ?? item.selected ?? item.checked ?? item.assigned)
    .map((item) => item.subjectId ?? item.id)
}

async function saveGradeSubjectSelection() {
  error.value = ''
  try {
    await saveGradeSubjects({
      academicTermId: gradeSubjectFilter.academicTermId,
      gradeLevel: gradeSubjectFilter.gradeLevel,
      subjects: gradeSubjectSelected.value.map(id => ({ subjectId: id }))
    })
    await loadGradeSubjects()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '年级科目保存失败'
  }
}

async function openGradeSubjectModal() {
  gradeSubjectModalError.value = ''
  gradeSubjectForm.academicTermId = String(gradeSubjectFilter.academicTermId || terms.value[0]?.id || '')
  gradeSubjectForm.gradeLevel = Number(gradeSubjectFilter.gradeLevel || activeGradeLevels.value[0] || 7)
  gradeSubjectFilter.academicTermId = gradeSubjectForm.academicTermId
  gradeSubjectFilter.gradeLevel = gradeSubjectForm.gradeLevel
  await loadGradeSubjects()
  gradeSubjectModalVisible.value = true
}

async function loadGradeSubjectsForModal() {
  gradeSubjectFilter.academicTermId = gradeSubjectForm.academicTermId
  gradeSubjectFilter.gradeLevel = gradeSubjectForm.gradeLevel
  await loadGradeSubjects()
}

async function submitGradeSubjectModal() {
  if (!gradeSubjectForm.academicTermId || !gradeSubjectForm.gradeLevel) {
    gradeSubjectModalError.value = '请选择学期和年级'
    return
  }
  gradeSubjectFilter.academicTermId = gradeSubjectForm.academicTermId
  gradeSubjectFilter.gradeLevel = gradeSubjectForm.gradeLevel
  gradeSubjectModalError.value = ''
  try {
    await saveGradeSubjectSelection()
    gradeSubjectModalVisible.value = false
  } catch (err) {
    gradeSubjectModalError.value = err instanceof Error ? err.message : '保存配置失败'
  }
}

async function loadClassSubjectsForTeacher() {
  if (!classSubjectFilter.academicTermId || !classSubjectFilter.classId) {
    return
  }
  try {
    const data = await listClassSubjects(classSubjectFilter.academicTermId, classSubjectFilter.classId)
    classSubjectRows.value = rows(data)
  } catch {
    // Keep existing data on reload failure
  }
}

const gradeNames: Record<number, string> = {
  1: '小学一年级',
  2: '小学二年级',
  3: '小学三年级',
  4: '小学四年级',
  5: '小学五年级',
  6: '小学六年级',
  7: '初中一年级',
  8: '初中二年级',
  9: '初中三年级',
  10: '高中一年级',
  11: '高中二年级',
  12: '高中三年级'
}

function gradeLabel(grade: number | string) {
  const numericGrade = Number(grade)
  return gradeNames[numericGrade] ?? `${grade}年级`
}

function fieldText(item: any, keys: string[], fallback = '-') {
  for (const key of keys) {
    const value = item?.[key]
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }
  return fallback
}

function statusLabel(item: any) {
  const value = item?.status ?? (item?.enabled === false ? 0 : 1)
  return Number(value) === 0 ? '停用' : '启用'
}

async function searchTeacherOptions(keyword = teacherKeyword.value) {
  if (teacherSearchTimer) clearTimeout(teacherSearchTimer)
  teacherSearchLoading.value = true
  teacherSearchTimer = setTimeout(async () => {
    try {
      teacherSearchRows.value = rows(await searchTeachers(keyword.trim()))
    } catch {
      teacherSearchRows.value = []
    } finally {
      teacherSearchLoading.value = false
    }
  }, 300)
}

function openTeacherModal(item: any) {
  teacherAssignItem.value = item
  selectedTeacherId.value = item.teacherUserId ?? null
  teacherKeyword.value = item.teacherName || ''
  teacherModalError.value = ''
  teacherSearchRows.value = []
  teacherModalVisible.value = true
  // Always fetch fresh teacher data from API (not stale cache)
  searchTeacherOptions()
}

function closeTeacherModal() {
  teacherModalVisible.value = false
  teacherModalError.value = ''
  teacherAssignItem.value = null
  selectedTeacherId.value = null
  teacherKeyword.value = ''
}

async function submitTeacherAssignment() {
  if (!teacherAssignItem.value) {
    return
  }
  teacherModalError.value = ''
  try {
    await updateClassSubjectTeacher(teacherAssignItem.value.id, selectedTeacherId.value)
    await loadClassSubjectsForTeacher()
    closeTeacherModal()
  } catch (err) {
    teacherModalError.value = err instanceof Error ? err.message : '保存教师失败'
  }
}

function selectTeacher(teacher: any) {
  selectedTeacherId.value = teacher.id
  teacherKeyword.value = teacher.realName || teacher.name || teacher.loginName || ''
  teacherSearchRows.value = []
}

function clearSelectedTeacher() {
  selectedTeacherId.value = null
  teacherKeyword.value = ''
  // Fetch fresh data from API instead of showing stale cache
  searchTeacherOptions()
}

function onTeacherKeywordInput() {
  // When user starts typing, clear the current selection so they can search freely
  if (selectedTeacherId.value) {
    selectedTeacherId.value = null
  }
  searchTeacherOptions()
}

onMounted(loadData)
</script>

<template>
  <section class="config-page page">
    <div class="config-header page-header">
      <div class="config-header__info">
        <p class="eyebrow">Configuration</p>
        <h1>系统配置</h1>
        <p class="config-header__desc">管理角色、学期、课程、年级课程和班级任课教师等基础配置。</p>
      </div>
      <button class="config-header__refresh" type="button" :disabled="loading" @click="loadData">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        {{ loading ? '刷新中...' : '刷新' }}
      </button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <div v-if="!canManageAcademicConfigs" class="config-readonly">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <span>当前账号只能查看配置列表，不能维护基础配置。</span>
    </div>

    <section class="config-card">
      <div class="config-card__head">
        <div class="config-card__title-row">
          <span class="config-card__icon config-card__icon--roles">角</span>
          <div class="config-card__title-text">
            <h2 class="config-card__title">角色定义</h2>
            <p class="config-card__desc">管理系统中的角色编码与名称，如超级管理员、班主任、教师等。</p>
          </div>
        </div>
        <button class="config-btn config-btn--primary" type="button" @click="openModal('role')">新增角色</button>
      </div>
      <div class="config-list">
        <div v-for="role in roles" :key="role.roleCode || role.id" class="config-list__item">
          <div class="config-list__item-main">
            <span class="config-list__item-avatar">{{ String(role.roleName || role.roleCode || '角').slice(0, 1) }}</span>
            <div>
              <strong class="config-list__item-name">{{ role.roleName || role.name }}</strong>
              <span class="config-list__item-meta">{{ role.roleCode || role.code }}</span>
            </div>
          </div>
          <code class="config-list__item-code">{{ role.roleCode || role.code }}</code>
        </div>
        <div v-if="roles.length === 0" class="config-empty">
          <span class="config-empty__icon">🔐</span>
          <p>暂无角色，点击右上角"新增角色"创建</p>
        </div>
      </div>
    </section>

    <section class="config-card">
      <div class="config-card__head">
        <div class="config-card__title-row">
          <span class="config-card__icon config-card__icon--terms">期</span>
          <div class="config-card__title-text">
            <h2 class="config-card__title">学期管理</h2>
            <p class="config-card__desc">定义学年学期信息，包含学期编码、学年、起止日期等。</p>
          </div>
        </div>
        <button class="config-btn config-btn--primary" type="button" @click="openModal('term')">新增学期</button>
      </div>
      <div class="config-list">
        <div v-for="item in terms" :key="item.id" class="config-list__item">
          <div class="config-list__item-main">
            <span class="config-list__item-avatar config-list__item-avatar--term">{{ String(item.termName || '期').slice(0, 1) }}</span>
            <div>
              <strong class="config-list__item-name">{{ item.termName }}</strong>
              <span class="config-list__item-meta">{{ item.startDate || '-' }} ~ {{ item.endDate || '-' }}</span>
            </div>
          </div>
          <div class="config-list__item-extra">
            <span class="config-tag">{{ item.termCode || item.semester || '-' }}</span>
            <span class="config-tag config-tag--muted">{{ item.academicYear || '-' }}</span>
            <button class="config-btn config-btn--ghost config-btn--sm" type="button" @click="openModal('term', item)">编辑</button>
          </div>
        </div>
        <div v-if="terms.length === 0" class="config-empty">
          <span class="config-empty__icon">📅</span>
          <p>暂无学期，点击右上角"新增学期"创建</p>
        </div>
      </div>
    </section>

    <section class="config-card">
      <div class="config-card__head">
        <div class="config-card__title-row">
          <span class="config-card__icon config-card__icon--subjects">科</span>
          <div class="config-card__title-text">
            <h2 class="config-card__title">课程主数据</h2>
            <p class="config-card__desc">定义课程编码、名称、分数范围及启用状态，点击编辑按钮修改。</p>
          </div>
        </div>
        <button class="config-btn config-btn--primary" type="button" @click="openModal('subject')">新增课程</button>
      </div>
      <div class="config-list">
        <div v-for="item in subjects" :key="item.id" class="config-list__item">
          <div class="config-list__item-main">
            <span class="config-list__item-dot"></span>
            <div>
              <strong class="config-list__item-name">{{ item.subjectName }}</strong>
              <span class="config-list__item-meta">{{ item.subjectCode || '-' }} · 分值 {{ Number(item.minScore ?? 0).toFixed(0) }}-{{ Number(item.maxScore ?? 100).toFixed(0) }}</span>
            </div>
          </div>
          <div class="config-list__item-extra">
            <span class="config-tag" :class="{ 'config-tag--muted': Number(item.status ?? 1) === 0 }">{{ statusLabel(item) }}</span>
            <button class="config-btn config-btn--ghost config-btn--sm" type="button" @click="openModal('subject', item)">编辑</button>
          </div>
        </div>
        <div v-if="subjects.length === 0" class="config-empty">
          <span class="config-empty__icon">📚</span>
          <p>暂无课程，点击右上角"新增课程"创建</p>
        </div>
      </div>
    </section>

    <section class="config-card">
      <div class="config-card__head">
        <div class="config-card__title-row">
          <span class="config-card__icon config-card__icon--subjects">考</span>
          <div class="config-card__title-text">
            <h2 class="config-card__title">考试类型</h2>
            <p class="config-card__desc">定义考试类型，如期中考试、期末考试、月考、联考等，用于成绩分类管理。</p>
          </div>
        </div>
        <button class="config-btn config-btn--primary" type="button" @click="openModal('exam')">新增考试类型</button>
      </div>
      <div class="config-list">
        <div v-for="item in examTypes" :key="item.id" class="config-list__item">
          <div class="config-list__item-main">
            <span class="config-list__item-dot"></span>
            <div>
              <strong class="config-list__item-name">{{ fieldText(item, ['examTypeName', 'name']) }}</strong>
              <span class="config-list__item-meta">{{ fieldText(item, ['examTypeCode', 'code']) }}</span>
            </div>
          </div>
          <div class="config-list__item-extra">
            <span class="config-tag">顺序: {{ item.sortOrder ?? 0 }}</span>
            <span class="config-tag" :class="{ 'config-tag--muted': statusLabel(item) === '停用' }">{{ statusLabel(item) }}</span>
            <button class="config-btn config-btn--ghost config-btn--sm" type="button" @click="openModal('exam', item)">编辑</button>
          </div>
        </div>
        <div v-if="examTypes.length === 0" class="config-empty">
          <span class="config-empty__icon">📝</span>
          <p>暂无考试类型，点击右上角"新增考试类型"创建</p>
        </div>
      </div>
    </section>

    <section class="config-card">
      <div class="config-card__head">
        <div class="config-card__title-row">
          <span class="config-card__icon config-card__icon--grade">招</span>
          <div class="config-card__title-text">
            <h2 class="config-card__title">年级管理</h2>
            <p class="config-card__desc">设置学校当前招收哪些年级的学生，勾选后保存即可生效。</p>
          </div>
        </div>
        <button class="config-btn config-btn--primary" type="button" :disabled="gradeSaving" @click="saveGrades">
          <svg v-if="gradeSaving" style="animation: login-spin-4c85fae4 0.6s linear infinite; width: 14px; height: 14px; margin-right: 4px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          {{ gradeSaving ? '保存中...' : '保存配置' }}
        </button>
      </div>
      <p v-if="gradeSaveError" class="error" style="margin-bottom: 14px;">{{ gradeSaveError }}</p>
      <p v-if="gradeSaveSuccess" class="success" style="margin-bottom: 14px;">{{ gradeSaveSuccess }}</p>
      <div class="enroll-grade-grid">
        <label
          v-for="item in enrollGradeRows"
          :key="item.gradeLevel ?? item.id ?? item.value"
          class="enroll-grade-chip"
          :class="{ 'enroll-grade-chip--active': selectedGrades.has(Number(item.gradeLevel ?? item.value ?? item)) }"
        >
          <input
            type="checkbox"
            :checked="selectedGrades.has(Number(item.gradeLevel ?? item.value ?? item))"
            @change="toggleGrade(Number(item.gradeLevel ?? item.value ?? item))"
          />
          <span>{{ gradeLabel(Number(item.gradeLevel ?? item.value ?? item)) }}</span>
        </label>
      </div>
      <p class="config-hint">勾选的年级表示当前学校开设的年级，未勾选的年级将不会出现在班级管理等相关功能中。</p>
    </section>

    <section class="config-card">
      <div class="config-card__head">
        <div class="config-card__title-row">
          <span class="config-card__icon config-card__icon--grade">级</span>
          <div class="config-card__title-text">
            <h2 class="config-card__title">年级课程配置</h2>
            <p class="config-card__desc">按学期和年级配置课程列表，仅显示学校已招收的年级。</p>
          </div>
        </div>
        <button class="config-btn config-btn--primary" type="button" @click="openGradeSubjectModal">新增配置</button>
      </div>
      <div class="config-form--teacher-bar">
        <select v-model="gradeSubjectFilter.academicTermId" class="config-input" @change="loadGradeSubjects">
          <option v-for="item in terms" :key="item.id" :value="item.id">{{ item.termName }}</option>
        </select>
        <select v-model.number="gradeSubjectFilter.gradeLevel" class="config-input" @change="loadGradeSubjects">
          <option v-for="grade in activeGradeLevels" :key="grade" :value="grade">{{ gradeLabel(grade) }}</option>
          <option v-if="activeGradeLevels.length === 0" :value="0" disabled>请先在"年级管理"中配置招收年级</option>
        </select>
      </div>
      <div class="config-list">
        <div v-for="subject in gradeSubjectRows.filter((item) => gradeSubjectSelected.includes(item.subjectId || item.id))" :key="subject.subjectId || subject.id" class="config-list__item">
          <div class="config-list__item-main">
            <span class="config-list__item-dot"></span>
            <div>
              <strong class="config-list__item-name">{{ subject.subjectName }}</strong>
              <span class="config-list__item-meta">{{ subject.subjectCode || '已配置课程' }}</span>
            </div>
          </div>
          <span class="config-tag">{{ gradeLabel(gradeSubjectFilter.gradeLevel) }}</span>
        </div>
        <div v-if="gradeSubjectSelected.length === 0" class="config-empty">
          <span class="config-empty__icon">📘</span>
          <p>暂无年级课程配置，点击右上角"新增配置"创建</p>
        </div>
      </div>
    </section>

    <section class="config-card">
      <div class="config-card__head">
        <div class="config-card__title-row">
          <span class="config-card__icon config-card__icon--subjects">荣</span>
          <div class="config-card__title-text">
            <h2 class="config-card__title">荣誉类型管理</h2>
            <p class="config-card__desc">定义学生荣誉的分类类型，如体育比赛、歌唱比赛等，点击编辑按钮修改。</p>
          </div>
        </div>
        <button class="config-btn config-btn--primary" type="button" @click="openModal('honor')">新增荣誉类型</button>
      </div>
      <div class="config-list">
        <div v-for="item in honorTypes" :key="item.id" class="config-list__item">
          <div class="config-list__item-main">
            <span class="config-list__item-dot"></span>
            <div>
              <strong class="config-list__item-name">{{ fieldText(item, ['honorTypeName', 'honorName', 'name']) }}</strong>
              <span class="config-list__item-meta">{{ fieldText(item, ['honorTypeCode', 'code']) }} · 顺序: {{ item.sortOrder ?? 0 }}</span>
            </div>
          </div>
          <div class="config-list__item-extra">
            <span class="config-tag" :class="{ 'config-tag--muted': statusLabel(item) === '停用' }">{{ statusLabel(item) }}</span>
            <button class="config-btn config-btn--ghost config-btn--sm" type="button" @click="openModal('honor', item)">编辑</button>
          </div>
        </div>
        <div v-if="honorTypes.length === 0" class="config-empty">
          <span class="config-empty__icon">🏆</span>
          <p>暂无荣誉类型，点击右上角"新增荣誉类型"创建</p>
        </div>
      </div>
    </section>

    <section class="config-card">
      <div class="config-card__head">
        <div class="config-card__title-row">
          <span class="config-card__icon config-card__icon--teacher">师</span>
          <div class="config-card__title-text">
            <h2 class="config-card__title">班级课程教师</h2>
            <p class="config-card__desc">按学期和班级为每门课程分配任课教师，点击编辑按钮通过搜索下拉选择教师。</p>
          </div>
        </div>
      </div>
      <div class="config-form--teacher-bar">
        <select v-model="classSubjectFilter.academicTermId" class="config-input" @change="loadClassSubjectsForTeacher">
          <option v-for="item in terms" :key="item.id" :value="item.id">{{ item.termName }}</option>
        </select>
        <select v-model="classSubjectFilter.classId" class="config-input" @change="loadClassSubjectsForTeacher">
          <option v-for="item in classes" :key="item.id" :value="item.id">{{ item.className }}</option>
        </select>
        <button class="config-btn config-btn--ghost" type="button" @click="loadClassSubjectsForTeacher">加载</button>
      </div>
      <div class="config-list">
        <div v-for="item in classSubjectRows" :key="item.id" class="config-list__item">
          <div class="config-list__item-main">
            <span class="config-list__item-dot"></span>
            <div>
              <strong class="config-list__item-name">{{ item.subjectName }}</strong>
              <span class="config-list__item-meta">{{ item.teacherName ? `任课教师: ${item.teacherName}` : '未分配教师' }}</span>
            </div>
          </div>
          <div class="config-list__item-extra">
            <span v-if="item.teacherName" class="config-tag">{{ item.teacherName }}</span>
            <span v-else class="config-tag config-tag--muted">待分配</span>
            <button class="config-btn config-btn--ghost config-btn--sm" type="button" @click="openTeacherModal(item)">编辑</button>
          </div>
        </div>
        <div v-if="classSubjectRows.length === 0" class="config-empty">
          <span class="config-empty__icon">👨‍🏫</span>
          <p>请选择学期和班级后点击"加载"查看课程安排</p>
        </div>
      </div>
      <p class="config-hint">提示：先在"用户管理"页面创建教师账号，再回到这里分配任课教师。</p>
    </section>

    <Teleport to="body">
      <div v-if="modalVisible && modalType === 'role'" class="modal-backdrop" @mousedown.self="modalVisible = false">
        <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="role-modal-title">
          <div class="modal-head">
            <div>
              <p class="eyebrow">新增角色</p>
              <h2 id="role-modal-title">录入角色信息</h2>
            </div>
            <button class="button ghost" type="button" @click="modalVisible = false">关闭</button>
          </div>
          <form class="config-modal-form" @submit.prevent="submitModal">
            <p v-if="modalError" class="error">{{ modalError }}</p>
            <div class="config-modal__field">
              <label class="config-modal__label" for="roleCode">角色编码</label>
              <input id="roleCode" v-model.trim="form.roleCode" class="config-input" placeholder="如 HEAD_TEACHER" required />
            </div>
            <div class="config-modal__field">
              <label class="config-modal__label" for="roleName">角色名称</label>
              <input id="roleName" v-model.trim="form.roleName" class="config-input" placeholder="如 班主任" required />
            </div>
            <div class="modal-actions">
              <button class="button ghost" type="button" @click="modalVisible = false">取消</button>
              <button class="button primary" type="submit">保存角色</button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>

    <AppModal :visible="modalVisible && modalType !== 'role'" :title="modalTitle" :error="modalError" @close="modalVisible = false">
      <form class="config-modal-form" @submit.prevent="submitModal">
        <template v-if="modalType === 'term'">
          <div class="config-modal__field">
            <label class="config-modal__label">学期编码</label>
            <input v-model.trim="form.termCode" class="config-input" placeholder="如 FALL_2026" required />
          </div>
          <div class="config-modal__field">
            <label class="config-modal__label">学年</label>
            <input v-model.trim="form.academicYear" class="config-input" placeholder="如 2026-2027" required />
          </div>
          <div class="config-modal__field">
            <label class="config-modal__label">学期名称</label>
            <input v-model.trim="form.termName" class="config-input" placeholder="如 2026年秋季学期" required />
          </div>
          <div class="config-modal__row">
            <div class="config-modal__field">
              <label class="config-modal__label">开始日期</label>
              <input v-model="form.startDate" class="config-input" type="date" required />
            </div>
            <div class="config-modal__field">
              <label class="config-modal__label">结束日期</label>
              <input v-model="form.endDate" class="config-input" type="date" required />
            </div>
          </div>
        </template>
        <template v-else-if="modalType === 'subject'">
          <div class="config-modal__row">
            <div class="config-modal__field">
              <label class="config-modal__label">课程编码</label>
              <input v-model.trim="form.subjectCode" class="config-input" placeholder="如 MATH" :disabled="Boolean(editing)" required />
            </div>
            <div class="config-modal__field">
              <label class="config-modal__label">课程名称</label>
              <input v-model.trim="form.subjectName" class="config-input" placeholder="如 数学" required />
            </div>
          </div>
          <div class="config-modal__row config-modal__row--3">
            <div class="config-modal__field">
              <label class="config-modal__label">最小分</label>
              <input v-model.number="form.minScore" class="config-input" type="number" min="0" step="0.01" />
            </div>
            <div class="config-modal__field">
              <label class="config-modal__label">最大分</label>
              <input v-model.number="form.maxScore" class="config-input" type="number" min="0" step="0.01" />
            </div>
            <div class="config-modal__field">
              <label class="config-modal__label">状态</label>
              <select v-model.number="form.status" class="config-input">
                <option :value="1">启用</option>
                <option :value="0">停用</option>
              </select>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="config-modal__row">
            <div class="config-modal__field">
              <label class="config-modal__label">类型编码</label>
              <input
                v-if="modalType === 'honor'"
                v-model.trim="form.honorTypeCode"
                class="config-input"
                placeholder="如 SPORTS"
                :disabled="Boolean(editing)"
                required
              />
              <input
                v-else
                v-model.trim="form.examTypeCode"
                class="config-input"
                placeholder="如 MIDTERM"
                :disabled="Boolean(editing)"
                required
              />
            </div>
            <div class="config-modal__field">
              <label class="config-modal__label">类型名称</label>
              <input
                v-if="modalType === 'honor'"
                v-model.trim="form.honorTypeName"
                class="config-input"
                placeholder="如 体育比赛"
                required
              />
              <input
                v-else
                v-model.trim="form.examTypeName"
                class="config-input"
                placeholder="如 期中考试"
                required
              />
            </div>
          </div>
          <div class="config-modal__row config-modal__row--3">
            <div class="config-modal__field">
              <label class="config-modal__label">排序</label>
              <input v-model.number="form.sortOrder" class="config-input" type="number" min="0" />
            </div>
            <div class="config-modal__field">
              <label class="config-modal__label">状态</label>
              <select v-model.number="form.status" class="config-input">
                <option :value="1">启用</option>
                <option :value="0">停用</option>
              </select>
            </div>
          </div>
        </template>
        <div class="modal-actions">
          <button class="button ghost" type="button" @click="modalVisible = false">取消</button>
          <button class="button primary" type="submit">保存</button>
        </div>
      </form>
    </AppModal>

    <AppModal :visible="teacherModalVisible" title="选择任课教师" :error="teacherModalError" @close="closeTeacherModal">
      <form class="config-modal-form" @submit.prevent="submitTeacherAssignment">
        <div class="config-modal__field">
          <label class="config-modal__label">任课教师</label>
          <div class="teacher-search">
            <input
              v-model="teacherKeyword"
              class="config-input"
              autocomplete="off"
              placeholder="搜索教师姓名..."
              @input="onTeacherKeywordInput()"
              @focus="searchTeacherOptions()"
            />
            <div v-if="teacherSearchLoading" class="teacher-search-loading">搜索中...</div>
            <div v-if="selectedTeacherId" class="teacher-search-selected">
              <span class="teacher-search-selected-name">{{ teacherKeyword || '已选择教师' }}</span>
              <small>ID: {{ selectedTeacherId }}</small>
              <button class="teacher-search-clear" type="button" title="清除选择" @click="clearSelectedTeacher">×</button>
            </div>
            <ul v-if="teacherSearchRows.length > 0" class="teacher-search-list">
              <li
                v-for="teacher in teacherSearchRows"
                :key="teacher.id"
                class="teacher-search-item"
                @mousedown.prevent="selectTeacher(teacher)"
              >
                <strong>{{ teacher.realName || teacher.name }}</strong>
                <span>{{ teacher.loginName }}</span>
              </li>
            </ul>
            <ul v-else-if="teacherKeyword.trim() && !teacherSearchLoading && !selectedTeacherId" class="teacher-search-list">
              <li class="teacher-search-empty">未找到匹配的老师</li>
            </ul>
          </div>
        </div>
        <div class="modal-actions" style="margin-top: 16px">
          <button class="button ghost" type="button" @click="closeTeacherModal">取消</button>
          <button class="button primary" type="submit">保存教师</button>
        </div>
      </form>
    </AppModal>

    <Teleport to="body">
      <div v-if="gradeSubjectModalVisible" class="modal-backdrop" @mousedown.self="gradeSubjectModalVisible = false">
        <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="grade-subject-modal-title">
          <div class="modal-head">
            <div>
              <p class="eyebrow">新增配置</p>
              <h2 id="grade-subject-modal-title">年级课程配置</h2>
            </div>
            <button class="button ghost" type="button" @click="gradeSubjectModalVisible = false">关闭</button>
          </div>
          <form class="config-modal-form" @submit.prevent="submitGradeSubjectModal">
            <p v-if="gradeSubjectModalError" class="error">{{ gradeSubjectModalError }}</p>
            <div class="config-modal__row">
              <div class="config-modal__field">
                <label class="config-modal__label">学期</label>
                <select v-model="gradeSubjectForm.academicTermId" class="config-input" @change="loadGradeSubjectsForModal">
                  <option v-for="item in terms" :key="item.id" :value="item.id">{{ item.termName }}</option>
                </select>
              </div>
              <div class="config-modal__field">
                <label class="config-modal__label">年级</label>
                <select v-model.number="gradeSubjectForm.gradeLevel" class="config-input" @change="loadGradeSubjectsForModal">
                  <option v-for="grade in activeGradeLevels" :key="grade" :value="grade">{{ gradeLabel(grade) }}</option>
                  <option v-if="activeGradeLevels.length === 0" :value="0" disabled>请先配置招收年级</option>
                </select>
              </div>
            </div>
            <div class="grade-subject-picker grade-subject-picker--modal">
              <label
                v-for="subject in (gradeSubjectRows.length ? gradeSubjectRows : subjects)"
                :key="subject.subjectId || subject.id"
                class="grade-subject-chip"
                :class="{ 'grade-subject-chip--active': gradeSubjectSelected.includes(subject.subjectId || subject.id) }"
              >
                <input v-model="gradeSubjectSelected" type="checkbox" :value="subject.subjectId || subject.id" />
                <span>{{ subject.subjectName }}</span>
                <small>{{ subject.subjectCode || '' }}</small>
              </label>
            </div>
            <div class="modal-actions">
              <button class="button ghost" type="button" @click="gradeSubjectModalVisible = false">取消</button>
              <button class="button primary" type="submit">保存配置</button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>
  </section>
</template>
