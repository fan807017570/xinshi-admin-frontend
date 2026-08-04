<template>
  <section class="page">
    <header class="page-header class-page-header">
      <div>
        <p class="eyebrow">Class Management</p>
        <h1>班级管理</h1>
        <p class="lead">维护班级基础信息、年级届次和班主任归属。</p>
      </div>
      <button v-if="isSuperAdmin" class="button primary" type="button" @click="openCreate">新增班级</button>
    </header>

    <div v-if="!isSuperAdmin" class="panel" style="margin-bottom: 18px;">
      <h2>只读模式</h2>
      <p class="lead">当前账号只能查看班级信息，不能调整班级基础配置。</p>
    </div>

    <div class="metrics class-metrics">
      <article class="metric">
        <span class="metric-icon">🏫</span>
        <div class="metric-body">
          <span class="metric-label">班级总数</span>
          <strong>{{ total }}</strong>
        </div>
        <span class="metric-foot">当前届次</span>
      </article>
      <article class="metric">
        <span class="metric-icon">✅</span>
        <div class="metric-body">
          <span class="metric-label">启用班级</span>
          <strong>{{ enabledCount }}</strong>
        </div>
        <span class="metric-foot">正常教学</span>
      </article>
      <article class="metric">
        <span class="metric-icon">⭐</span>
        <div class="metric-body">
          <span class="metric-label">重点班</span>
          <strong>{{ keyClassCount }}</strong>
        </div>
        <span class="metric-foot">培优体系</span>
      </article>
      <article class="metric">
        <span class="metric-icon">👨‍🏫</span>
        <div class="metric-body">
          <span class="metric-label">班主任数</span>
          <strong>{{ headTeacherCount }}</strong>
        </div>
        <span class="metric-foot">已分配</span>
      </article>
    </div>

    <section class="panel class-toolbar">
      <div class="panel-head">
        <div>
          <h2>按届次和年级筛选</h2>
          <p class="hint">选择自然届和年级查看对应班级，默认展示当前届。</p>
        </div>
      </div>
      <form class="class-query-form" @submit.prevent="search(true)">
        <select v-model="query.gradeSession">
          <option value="">全部届次</option>
          <option v-for="year in sessionYears" :key="year" :value="year">{{ year }}</option>
        </select>
        <select v-model="query.gradeLevel">
          <option value="">全部年级</option>
          <option v-for="item in gradeOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
        </select>
        <div class="class-query-actions">
          <button class="button primary" type="submit">查询</button>
          <button class="button ghost" type="button" @click="resetQuery">重置</button>
        </div>
      </form>
    </section>

    <div v-if="loading" class="class-grid-loading">
      <article v-for="item in 6" :key="item" class="class-skeleton">
        <span class="skeleton-line skeleton-name"></span>
        <span class="skeleton-line skeleton-meta"></span>
        <span class="skeleton-line skeleton-meta"></span>
        <span class="skeleton-line skeleton-action"></span>
      </article>
    </div>

    <div v-else-if="!classes.length" class="class-empty">
      <div class="class-empty-icon">🏫</div>
      <h2>当前届次暂无班级</h2>
      <p class="lead">切换届次查询，或点击<span v-if="isSuperAdmin">"新增班级"</span>创建第一个班级。</p>
    </div>

    <div v-else class="class-grid">
      <article
        v-for="item in classes"
        :key="item.id"
        class="class-card"
        :class="{ 'class-card--inactive': Number(item.status) !== 1 }"
      >
        <div class="class-card__head">
          <div>
            <div class="class-card__title-row">
              <h2 class="class-card__name">{{ classNameOf(item) }}</h2>
              <span
                class="class-card__badge"
                :class="Number(item.isKeyClass) === 1 ? 'class-card__badge--key' : 'class-card__badge--normal'"
              >
                {{ Number(item.isKeyClass) === 1 ? '重点班' : '普通班' }}
              </span>
            </div>
            <div class="class-card__code">
              {{ item.classCode || `CLASS-${item.id}` }}
              <span v-if="combinationLabel(item)" class="class-card__combo">{{ combinationLabel(item) }}</span>
            </div>
          </div>
          <span
            :class="['class-card__status-dot', Number(item.status) === 1 ? 'class-card__status-dot--active' : 'class-card__status-dot--inactive']"
          ></span>
        </div>

        <div class="class-card__body">
          <div class="class-card__info">
            <div class="class-card__info-item">
              <span class="class-card__info-label">届次</span>
              <span class="class-card__info-value">{{ item.gradeSession ? `${item.gradeSession}届` : '-' }}</span>
            </div>
            <div class="class-card__info-item">
              <span class="class-card__info-label">年级</span>
              <span class="class-card__info-value">{{ gradeLabel(item.gradeLevel) }}</span>
            </div>
            <div class="class-card__info-item">
              <span class="class-card__info-label">状态</span>
              <span class="class-card__info-value">{{ Number(item.status) === 1 ? '启用' : '停用' }}</span>
            </div>
          </div>
          <div class="class-card__teacher">
            <span class="class-card__teacher-avatar">{{ String(item.headTeacherName || '师').slice(0, 1) }}</span>
            <div class="class-card__teacher-info">
              <span class="class-card__teacher-label">班主任</span>
              <span class="class-card__teacher-name">{{ item.headTeacherName || '未分配' }}</span>
            </div>
          </div>
        </div>

        <div class="class-card__actions">
          <button class="button primary sm" type="button" @click="openCourseManage(item)">课程管理</button>
          <template v-if="isSuperAdmin">
            <button class="button ghost sm" type="button" @click="openEdit(item)">编辑</button>
            <button class="button ghost danger sm" type="button" @click="removeClass(item)">删除</button>
          </template>
        </div>
      </article>
    </div>

    <div v-if="!loading && total > 0" class="pagination class-pagination">
      <div class="pagination-left">
        <span class="pagination-info">共 {{ total }} 条，第 {{ page.current }}/{{ totalPages }} 页</span>
        <label class="pagination-size-label">
          每页
          <select v-model.number="page.size" class="pagination-size-select">
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
          条
        </label>
      </div>
      <div v-if="totalPages > 1" class="pagination-buttons">
        <button class="button ghost sm" type="button" :disabled="page.current <= 1" @click="goPage(page.current - 1)">上一页</button>
        <button
          v-for="num in pageNumbers"
          :key="num"
          :class="['button', 'sm', num === page.current ? 'primary' : 'ghost']"
          type="button"
          @click="goPage(num)"
        >
          {{ num }}
        </button>
        <button class="button ghost sm" type="button" :disabled="page.current >= totalPages" @click="goPage(page.current + 1)">下一页</button>
      </div>
    </div>

    <!-- Create/Edit Class Modal -->
    <Teleport to="body">
      <div v-if="modalVisible" class="modal-backdrop" @click.self="closeModal">
        <section class="modal-card" role="dialog" aria-modal="true" :aria-labelledby="editing ? 'edit-class-title' : 'create-class-title'">
          <div class="modal-head">
            <div>
              <p class="eyebrow">{{ editing ? '编辑班级' : '新增班级' }}</p>
              <h2 :id="editing ? 'edit-class-title' : 'create-class-title'">{{ editing ? '修改班级信息' : '录入班级信息' }}</h2>
            </div>
            <button class="button ghost sm" type="button" @click="closeModal">关闭</button>
          </div>
          <form class="student-form modal-form" @submit.prevent="submitClass">
            <p v-if="modalError" class="error student-form-full">{{ modalError }}</p>

            <!-- Basic Info Row -->
            <select v-model="form.classNo" required>
              <option value="">请选择班级编号</option>
              <option v-for="num in classNumbers" :key="num" :value="num">{{ num }}班</option>
            </select>
            <select v-model="form.gradeSession" required>
              <option value="">请选择届次</option>
              <option v-for="year in sessionYears" :key="year" :value="year">{{ year }}届</option>
            </select>
            <select v-model.number="form.gradeLevel" required>
              <option value="">请选择年级</option>
              <option v-for="item in gradeOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
            <select v-model="form.headTeacherUserId" required>
              <option value="">班主任（必选）</option>
              <option v-for="teacher in teachers" :key="teacher.id" :value="teacher.id">{{ teacher.realName || teacher.name }}</option>
            </select>
            <select v-model.number="form.isKeyClass">
              <option :value="0">普通班</option>
              <option :value="1">重点班</option>
            </select>
            <select v-model.number="form.status">
              <option :value="1">启用</option>
              <option :value="0">停用</option>
            </select>

            <!-- Course Combination: Three-Step Selection -->
            <div class="student-form-full course-combo-section">
              <p class="course-combo-section-title">选课配置</p>

              <!-- Step 1: Foreign Language -->
              <div class="course-combo-step">
                <span class="course-combo-step-label">外语</span>
                <div class="course-combo-options">
                  <label v-for="opt in foreignLangOptions" :key="opt.code" class="course-combo-chip" :class="{ 'course-combo-chip--active': form.foreignLanguage === opt.code }">
                    <input type="radio" :value="opt.code" v-model="form.foreignLanguage" />
                    <span>{{ opt.name }}</span>
                  </label>
                </div>
              </div>

              <!-- Step 2: Physics or History -->
              <div class="course-combo-step">
                <span class="course-combo-step-label">物理 / 历史</span>
                <div class="course-combo-options">
                  <label v-for="opt in phOrHiOptions" :key="opt.code" class="course-combo-chip" :class="{ 'course-combo-chip--active': form.phOrHi === opt.code }">
                    <input type="radio" :value="opt.code" v-model="form.phOrHi" />
                    <span>{{ opt.name }}</span>
                  </label>
                </div>
              </div>

              <!-- Step 3: Two electives from 4 -->
              <div class="course-combo-step">
                <span class="course-combo-step-label">
                  选修课程（4选2，已选 {{ form.electiveTwo.length }}/2）
                </span>
                <div class="course-combo-options">
                  <label
                    v-for="opt in electiveOptions"
                    :key="opt.code"
                    class="course-combo-chip"
                    :class="{
                      'course-combo-chip--active': form.electiveTwo.includes(opt.code),
                      'course-combo-chip--disabled': form.electiveTwo.length >= 2 && !form.electiveTwo.includes(opt.code)
                    }"
                  >
                    <input
                      type="checkbox"
                      :value="opt.code"
                      :checked="form.electiveTwo.includes(opt.code)"
                      :disabled="form.electiveTwo.length >= 2 && !form.electiveTwo.includes(opt.code)"
                      @change="toggleElective(opt.code)"
                    />
                    <span>{{ opt.name }}</span>
                  </label>
                </div>
              </div>

              <!-- Class Name Preview -->
              <div v-if="classNamePreview" class="course-combo-preview">
                预览班级名：<strong>{{ classNamePreview }}</strong>
              </div>
            </div>

            <div class="modal-actions student-form-full">
              <button class="button ghost" type="button" @click="closeModal">取消</button>
              <button class="button primary" type="submit">保存班级</button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>

    <!-- Course Management Modal -->
    <Teleport to="body">
      <div v-if="courseModalVisible" class="modal-backdrop" @click.self="closeCourseModal">
        <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="course-manage-title" style="max-width: 560px;">
          <div class="modal-head">
            <div>
              <p class="eyebrow">课程设置</p>
              <h2 id="course-manage-title">{{ courseClassName }}</h2>
            </div>
            <button class="button ghost sm" type="button" @click="closeCourseModal">关闭</button>
          </div>

          <div v-if="courseLoading" style="text-align: center; padding: 32px; color: #64748b;">加载中...</div>
          <template v-else>
            <!-- Semester selector -->
            <div style="margin-bottom: 16px;">
              <label style="display:block; font-size:13px; font-weight:600; color:#334155; margin-bottom:6px">学期</label>
              <select v-model="selectedTermId" @change="loadClassSubjects" style="max-width: 280px;">
                <option value="">请选择学期</option>
                <option v-for="term in academicTerms" :key="term.id" :value="term.id">{{ term.termName || term.termCode }}</option>
              </select>
            </div>

            <template v-if="selectedTermId">
              <!-- Combo info + mismatch -->
              <div v-if="courseClassCombination" class="course-combo-info-bar">
                <span>选课：<strong>{{ combinationLabel({ courseCombination: courseClassCombination }) }}</strong></span>
                <span class="course-combo-expected">（需配：{{ comboExpectedSubjectNames.join('、') }}）</span>
              </div>
              <div v-if="comboMismatchSubjects.length" class="course-combo-mismatch">
                缺少科目：{{ comboMismatchSubjects.join('、') }}
              </div>
              <div v-if="gradeSubjectsNotConfigured" class="course-combo-mismatch" style="background:#dbeafe; border-color:#3b82f633; color:#1e40af;">
                年级课程未配置，请先在「系统配置 → 年级课程配置」中设置。
              </div>

              <!-- Current courses list -->
              <div v-if="classSubjects.length" style="margin-bottom: 14px;">
                <div v-for="cs in classSubjects" :key="cs.id" class="course-item-row">
                  <div class="course-item-info">
                    <strong>{{ cs.subjectName }}</strong>
                    <span :class="cs.teacherName ? '' : 'muted-block'">{{ cs.teacherName || '未分配教师' }}</span>
                  </div>
                  <div class="course-item-actions">
                    <button class="button ghost sm" type="button" @click="openAssignTeacher(cs)">设教师</button>
                    <button class="button ghost danger sm" type="button" @click="removeClassSubject(cs)">删除</button>
                  </div>
                </div>
              </div>
              <p v-else style="color:#94a3b8; font-size:13px; margin-bottom:14px;">暂无课程</p>

              <!-- Add course form -->
              <div class="course-add-row">
                <select v-model="newSubjectId" class="course-add-select">
                  <option value="">选择科目</option>
                  <option v-for="sub in availableSubjects" :key="sub.id" :value="sub.id">{{ sub.subjectName || sub.name }}</option>
                </select>
                <div class="teacher-search teacher-search--inline">
                  <input
                    v-model="addTeacherKeyword"
                    class="config-input"
                    autocomplete="off"
                    placeholder="搜索老师..."
                    @input="onAddTeacherInput()"
                    @focus="doSearchAddTeachers()"
                  />
                  <div v-if="addTeacherSearchLoading" class="teacher-search-loading">搜索中...</div>
                  <div v-if="newTeacherId" class="teacher-search-selected teacher-search-selected--inline">
                    <span class="teacher-search-selected-name">{{ addTeacherKeyword || '已选择' }}</span>
                    <button class="teacher-search-clear" type="button" title="清除选择" @click="clearAddTeacherSelection">×</button>
                  </div>
                  <ul v-if="addTeacherSearchRows.length > 0" class="teacher-search-list">
                    <li
                      v-for="teacher in addTeacherSearchRows"
                      :key="teacher.id"
                      class="teacher-search-item"
                      @mousedown.prevent="selectAddTeacher(teacher)"
                    >
                      <strong>{{ teacher.realName || teacher.name }}</strong>
                      <span>{{ teacher.loginName }}</span>
                    </li>
                  </ul>
                  <ul v-else-if="addTeacherKeyword.trim() && !addTeacherSearchLoading && !newTeacherId" class="teacher-search-list">
                    <li class="teacher-search-empty">未找到匹配的老师</li>
                  </ul>
                </div>
                <button class="button primary sm" type="button" @click="addClassSubject" style="flex-shrink:0;">添加</button>
              </div>
              <p v-if="!availableSubjects.length" style="color:#94a3b8; font-size:12px; margin-top:6px;">没有可添加的科目</p>
            </template>
            <p v-else style="color:#94a3b8; font-size:13px; padding:20px 0; text-align:center;">请先选择学期</p>
          </template>
        </section>
      </div>
    </Teleport>

    <!-- Assign Teacher Modal -->
    <Teleport to="body">
      <div v-if="assignModalVisible" class="modal-backdrop" @click.self="closeAssignModal">
        <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="assign-teacher-title" style="max-width: 400px;">
          <div class="modal-head">
            <div>
              <p class="eyebrow">设置任课老师</p>
              <h2 id="assign-teacher-title">{{ assignSubjectName }}</h2>
            </div>
            <button class="button ghost sm" type="button" @click="closeAssignModal">关闭</button>
          </div>
          <div style="margin-top: 16px;">
            <div class="teacher-search">
              <input
                v-model="assignTeacherKeyword"
                class="config-input"
                autocomplete="off"
                placeholder="搜索教师姓名..."
                @input="onAssignTeacherInput()"
                @focus="doSearchAssignTeachers()"
              />
              <div v-if="assignTeacherSearchLoading" class="teacher-search-loading">搜索中...</div>
              <div v-if="assignTeacherId" class="teacher-search-selected">
                <span class="teacher-search-selected-name">{{ assignTeacherKeyword || '已选择教师' }}</span>
                <small>ID: {{ assignTeacherId }}</small>
                <button class="teacher-search-clear" type="button" title="清除选择" @click="clearAssignTeacherSelection">×</button>
              </div>
              <ul v-if="assignTeacherSearchRows.length > 0" class="teacher-search-list">
                <li
                  v-for="teacher in assignTeacherSearchRows"
                  :key="teacher.id"
                  class="teacher-search-item"
                  @mousedown.prevent="selectAssignTeacher(teacher)"
                >
                  <strong>{{ teacher.realName || teacher.name }}</strong>
                  <span>{{ teacher.loginName }}</span>
                </li>
              </ul>
              <ul v-else-if="assignTeacherKeyword.trim() && !assignTeacherSearchLoading && !assignTeacherId" class="teacher-search-list">
                <li class="teacher-search-empty">未找到匹配的老师</li>
              </ul>
            </div>
          </div>
          <div class="modal-actions" style="margin-top: 16px;">
            <button class="button ghost" type="button" @click="closeAssignModal">取消</button>
            <button class="button primary" type="button" @click="saveAssignTeacher">保存</button>
          </div>
        </section>
      </div>
    </Teleport>

    <!-- Error Modal -->
    <Teleport to="body">
      <div v-if="errorModalVisible" class="modal-backdrop" @click.self="errorModalVisible = false">
        <section class="modal-card" role="dialog" aria-modal="true" style="max-width: 440px;">
          <div class="modal-head">
            <h2>操作提示</h2>
            <button class="button ghost sm" type="button" @click="errorModalVisible = false">关闭</button>
          </div>
          <p class="error" style="margin: 0;">{{ errorModalMessage }}</p>
          <div class="modal-actions" style="margin-top: 16px;">
            <button class="button primary" type="button" @click="errorModalVisible = false">确定</button>
          </div>
        </section>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import * as schoolApi from '../api/school'
import { useAuthStore } from '../stores/auth'

type AnyRow = Record<string, any>

const auth = useAuthStore()

const isSuperAdmin = computed(() => auth.isSuperAdmin)

// --- Class list state ---
const classes = ref<AnyRow[]>([])
const teachers = ref<AnyRow[]>([])
const total = ref(0)
const explicitTotalPages = ref(0)
const loading = ref(false)
const modalVisible = ref(false)
const editing = ref<AnyRow | null>(null)
const modalError = ref('')
const query = reactive({ gradeSession: '', gradeLevel: '' })
const page = reactive({ current: 1, size: 10 })
const form = reactive({
  id: '' as string | number,
  classNo: '' as number | string,
  gradeSession: '' as number | string,
  gradeLevel: '' as number | string,
  headTeacherUserId: '' as number | string,
  isKeyClass: 0,
  status: 1,
  foreignLanguage: 'EN' as string,
  phOrHi: 'PH' as string,
  electiveTwo: [] as string[]
})

// Course combination option constants
const foreignLangOptions = [
  { code: 'EN', name: '英语', short: '英' },
  { code: 'JA', name: '日语', short: '日' }
]
const phOrHiOptions = [
  { code: 'PH', name: '物理', short: '物' },
  { code: 'HI', name: '历史', short: '史' }
]
const electiveOptions = [
  { code: 'CH', name: '化学', short: '化' },
  { code: 'BI', name: '生物', short: '生' },
  { code: 'GE', name: '地理', short: '地' },
  { code: 'PO', name: '政治', short: '政' }
]

// Computed: class name preview with combination
const classNamePreview = computed(() => {
  if (!form.classNo || !form.gradeLevel) return ''
  const grade = gradeLabel(form.gradeLevel)
  const fl = foreignLangOptions.find(o => o.code === form.foreignLanguage)
  const ph = phOrHiOptions.find(o => o.code === form.phOrHi)
  const el1 = electiveOptions.find(o => o.code === form.electiveTwo[0])
  const el2 = electiveOptions.find(o => o.code === form.electiveTwo[1])
  const comboParts = [fl?.short, ph?.short, el1?.short, el2?.short].filter(Boolean)
  return `${grade}(${form.classNo}班)-${comboParts.join('-')}`
})

function toggleElective(code: string) {
  const idx = form.electiveTwo.indexOf(code)
  if (idx >= 0) {
    form.electiveTwo.splice(idx, 1)
  } else if (form.electiveTwo.length < 2) {
    form.electiveTwo.push(code)
    form.electiveTwo.sort()
  }
}

function combinationLabel(item: AnyRow) {
  if (!item.courseCombination) return ''
  const parts = (item.courseCombination as string).split('-')
  if (parts.length < 4) return item.courseCombination
  const fl = foreignLangOptions.find(o => o.code === parts[0])
  const ph = phOrHiOptions.find(o => o.code === parts[1])
  const e1 = electiveOptions.find(o => o.code === parts[2])
  const e2 = electiveOptions.find(o => o.code === parts[3])
  return [fl?.short, ph?.short, e1?.short, e2?.short].filter(Boolean).join('-')
}

const currentYear = new Date().getFullYear()
const sessionYears = Array.from({ length: 11 }, (_, index) => currentYear + index)
const classNumbers = Array.from({ length: 20 }, (_, index) => index + 1)
const gradeOptions = [
  { value: 1, label: '小学一年级' },
  { value: 2, label: '小学二年级' },
  { value: 3, label: '小学三年级' },
  { value: 4, label: '小学四年级' },
  { value: 5, label: '小学五年级' },
  { value: 6, label: '小学六年级' },
  { value: 7, label: '初中一年级' },
  { value: 8, label: '初中二年级' },
  { value: 9, label: '初中三年级' },
  { value: 10, label: '高中一年级' },
  { value: 11, label: '高中二年级' },
  { value: 12, label: '高中三年级' }
]

const defaultSession = sessionYears[0] ?? currentYear

// --- Course management state ---
const courseModalVisible = ref(false)
const courseClassName = ref('')
const courseClassId = ref<string | number>('')
const courseClassGradeLevel = ref<number>(0)
const courseClassCombination = ref('')
const courseClassForeignLang = ref('')
const courseClassPhOrHi = ref('')
const courseClassElectiveTwo = ref('')
const courseLoading = ref(false)
const academicTerms = ref<AnyRow[]>([])
const classSubjects = ref<AnyRow[]>([])
const gradeSubjects = ref<AnyRow[]>([])
const allSubjects = ref<AnyRow[]>([])
const allTeachers = ref<AnyRow[]>([])
const selectedTermId = ref<string | number>('')
const newSubjectId = ref('')
const newTeacherId = ref('')

// --- Assign teacher state ---
const assignModalVisible = ref(false)
const assignClassSubjectId = ref<string | number>('')
const assignSubjectName = ref('')
const assignTeacherId = ref('')

// Teacher search state for "设教师" modal
const assignTeacherKeyword = ref('')
const assignTeacherSearchRows = ref<AnyRow[]>([])
const assignTeacherSearchLoading = ref(false)
let assignTeacherSearchTimer: ReturnType<typeof setTimeout> | null = null

// Teacher search state for "添加课程" inline form
const addTeacherKeyword = ref('')
const addTeacherSearchRows = ref<AnyRow[]>([])
const addTeacherSearchLoading = ref(false)
let addTeacherSearchTimer: ReturnType<typeof setTimeout> | null = null

// --- Error modal ---
const errorModalVisible = ref(false)
const errorModalMessage = ref('')

// --- Computed ---
const totalPages = computed(() => Math.max(1, explicitTotalPages.value || Math.ceil(total.value / page.size)))
const pageNumbers = computed(() => {
  const start = Math.max(1, page.current - 2)
  const end = Math.min(totalPages.value, page.current + 2)
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
})
const enabledCount = computed(() => classes.value.filter((item) => Number(item.status) === 1).length)
const keyClassCount = computed(() => classes.value.filter((item) => Number(item.isKeyClass) === 1).length)
const headTeacherCount = computed(() => new Set(classes.value.map((item) => item.headTeacherUserId || item.headTeacherName).filter(Boolean)).size)

// Expected subject names for the class's course combination (for display)
const comboExpectedSubjectNames = computed(() => {
  if (!courseClassCombination.value) return [] as string[]
  const names: string[] = []
  // Fixed: 数学, 语文
  names.push('数学', '语文')
  // Foreign language
  const fl = foreignLangOptions.find(o => o.code === courseClassForeignLang.value)
  if (fl) names.push(fl.name)
  // Physics or History
  const ph = phOrHiOptions.find(o => o.code === courseClassPhOrHi.value)
  if (ph) names.push(ph.name)
  // Two electives
  const electives = (courseClassElectiveTwo.value || '').split(',').filter(Boolean)
  electives.forEach(code => {
    const e = electiveOptions.find(o => o.code === code)
    if (e) names.push(e.name)
  })
  return names
})

// Check if a subject name matches one of the expected combination subjects
// Handles naming variations like 外语↔英语, 外语↔日语
function subjectMatchesCombo(subjectName: string): boolean {
  if (!courseClassCombination.value) return true // No combination, show all
  const s = (subjectName || '').trim()
  if (!s) return false

  // Always allow fixed subjects
  if (s === '数学' || s === '语文') return true

  // Direct match against expected names
  for (const name of comboExpectedSubjectNames.value) {
    if (s === name || s.includes(name) || name.includes(s)) return true
  }

  // Flexible matching for foreign language:
  // "外语" category subjects should match if the class expects any foreign language
  if (s === '外语' || s.includes('外语') || s === '英语' || s === '日语' ||
      s.includes('英语') || s.includes('日语') || s.includes('英文') || s.includes('日文')) {
    const fl = foreignLangOptions.find(o => o.code === courseClassForeignLang.value)
    if (fl) {
      // Accept any foreign language subject when the class expects this language
      if (s === fl.name || fl.name.includes(s) || s.includes(fl.name)) return true
      // Also accept generic "外语" when a specific language is configured
      if (s.includes('外语')) return true
      // Accept the specific language when generic "外语" is the subject name
      if (fl.name.includes('英语') || fl.name.includes('日语')) return true
    }
  }

  return false
}

// Available subjects not yet assigned to the class
const assignedSubjectIds = computed(() => new Set(classSubjects.value.map((cs) => cs.subjectId)))

// Source list: merge grade subjects with global subjects.
// Grade subjects appear first (preferred); global subjects not already
// covered by grade-level configuration are appended so that newly created
// courses in 基础配置 immediately appear in the dropdown.
const subjectSource = computed((): any[] => {
  const gradeSubjectIdSet = new Set(
    gradeSubjects.value.map((s: any) => Number(s.subjectId || s.id))
  )
  // Normalize grade subject rows: they carry id = school_grade_subject.id
  // (join table PK).  Replace with subjectId so the dropdown :value="sub.id"
  // emits the correct school_subject.id for both row types.
  const normalized = gradeSubjects.value.map((s: any) => ({
    ...s,
    id: s.subjectId || s.id,
  }))
  const merged = [...normalized]
  for (const sub of allSubjects.value) {
    if (!gradeSubjectIdSet.has(Number(sub.id))) {
      merged.push(sub)
    }
  }
  return merged
})

// Whether grade-level course configuration is missing entirely
const gradeSubjectsNotConfigured = computed(() =>
  gradeSubjects.value.length === 0 && allSubjects.value.length > 0
)

const availableSubjects = computed(() => {
  const source = subjectSource.value
  // If no combination set on the class, show all unassigned subjects
  if (!courseClassCombination.value) {
    return source.filter((sub) => !assignedSubjectIds.value.has(sub.id))
  }
  // With combination: filter to only show subjects matching the combination
  return source.filter((sub) =>
    !assignedSubjectIds.value.has(sub.id) && subjectMatchesCombo(sub.subjectName || sub.name || '')
  )
})

// Validation: check if current courses match the expected combination
const comboMismatchSubjects = computed(() => {
  if (!courseClassCombination.value || !classSubjects.value.length) return [] as string[]
  const currentNames = classSubjects.value.map((cs: AnyRow) => (cs.subjectName || '') as string)
  const missing: string[] = []
  for (const name of comboExpectedSubjectNames.value) {
    const found = currentNames.some(cn => {
      // Direct match
      if (cn === name || cn.includes(name) || name.includes(cn)) return true
      // 外语 ↔ 英语/日语 match
      if (name === '英语' || name === '日语') {
        if (cn === '外语' || cn.includes('外语')) return true
      }
      return false
    })
    if (!found) missing.push(name)
  }
  return missing
})

// --- Helpers ---
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

function gradeLabel(value: any) {
  return gradeOptions.find((item) => Number(item.value) === Number(value))?.label || '-'
}

function extractClassNo(className: string) {
  const match = className?.match(/\((\d+)\)班$/)
  return match ? match[1] : ''
}

function classNameOf(item: AnyRow) {
  if (item.className || item.name) return item.className || item.name
  const grade = gradeLabel(item.gradeLevel)
  const no = item.classNo ? `${item.classNo}班` : ''
  return `${grade}(${no})` || '-'
}

// --- Class list ---
async function loadTeachers() {
  if (isSuperAdmin.value) {
    try {
      const res = await call('listUsers', { roleCode: 'HEAD_TEACHER', page: 1, size: 200 })
      teachers.value = rows(res)
    } catch {
      teachers.value = []
    }
  } else {
    teachers.value = []
  }
}

async function search(resetPage = false) {
  if (resetPage) page.current = 1
  loading.value = true
  try {
    const res = await call('listClasses', {
      page: page.current,
      size: page.size,
      gradeSession: query.gradeSession || undefined,
      gradeLevel: query.gradeLevel || undefined
    })
    classes.value = rows(res)
    total.value = totalOf(res)
    explicitTotalPages.value = totalPagesOf(res)
    await loadTeachers()
  } catch (e: any) {
    classes.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function resetQuery() {
  query.gradeSession = ''
  query.gradeLevel = ''
  search(true)
}

function goPage(num: number) { page.current = num; search(false) }
watch(() => page.size, () => { page.current = 1; search(false) })

// --- Create/Edit modal ---
function resetForm() {
  form.id = ''
  form.classNo = ''
  form.gradeSession = defaultSession
  form.gradeLevel = '' as any
  form.headTeacherUserId = ''
  form.isKeyClass = 0
  form.status = 1
  form.foreignLanguage = 'EN'
  form.phOrHi = 'PH'
  form.electiveTwo = []
  modalError.value = ''
}

async function openCreate() {
  editing.value = null
  resetForm()
  await loadTeachers()
  modalVisible.value = true
}

async function openEdit(item: AnyRow) {
  editing.value = item
  resetForm()
  await loadTeachers()
  form.id = item.id
  form.classNo = extractClassNo(item.className || '') || item.classNo || ''
  form.gradeSession = item.gradeSession || defaultSession
  form.gradeLevel = item.gradeLevel || ''
  form.headTeacherUserId = item.headTeacherUserId || ''
  form.isKeyClass = Number(item.isKeyClass || 0)
  form.status = Number(item.status ?? 1)
  form.foreignLanguage = (item.foreignLanguage as string) || 'EN'
  form.phOrHi = (item.phOrHi as string) || 'PH'
  form.electiveTwo = item.electiveTwo ? (item.electiveTwo as string).split(',').filter(Boolean) : []
  modalVisible.value = true
}

function closeModal() { modalVisible.value = false }

function validateForm() {
  if (!form.classNo) return '请选择班级编号'
  if (!form.gradeSession) return '请选择届次'
  if (!form.gradeLevel) return '请选择年级'
  if (!form.headTeacherUserId) return '请选择班主任'
  return ''
}

async function submitClass() {
  modalError.value = validateForm()
  if (modalError.value) return
  if (form.electiveTwo.length !== 2) {
    modalError.value = '请选择 2 门选修科目（当前已选 ' + form.electiveTwo.length + ' 门）'
    return
  }
  const body: AnyRow = {
    classNo: form.classNo,
    gradeSession: form.gradeSession,
    gradeLevel: Number(form.gradeLevel),
    headTeacherUserId: Number(form.headTeacherUserId),
    isKeyClass: form.isKeyClass,
    status: form.status,
    foreignLanguage: form.foreignLanguage,
    phOrHi: form.phOrHi,
    electiveTwo: [...form.electiveTwo].sort().join(',')
  }
  try {
    if (editing.value) await call('updateClass', form.id, body)
    else await call('createClass', body)
    modalVisible.value = false
    await search(false)
  } catch (e: any) {
    modalError.value = e?.message || (editing.value ? '保存班级失败' : '创建班级失败')
  }
}

async function removeClass(item: AnyRow) {
  if (!window.confirm(`确定删除${classNameOf(item)}吗？`)) return
  try {
    await call('deleteClass', item.id)
    await search(false)
  } catch (e: any) {
    errorModalMessage.value = e?.message || '删除班级失败'
    errorModalVisible.value = true
  }
}

// --- Course management ---
async function loadAcademicTerms() {
  try {
    academicTerms.value = rows(await call('listAcademicTerms'))
  } catch {
    academicTerms.value = []
  }
}

async function loadAllSubjects() {
  try {
    allSubjects.value = rows(await call('listSubjects'))
  } catch {
    allSubjects.value = []
  }
}

async function loadGradeSubjects(gradeLevel: number) {
  if (!selectedTermId.value || !gradeLevel) {
    gradeSubjects.value = []
    allSubjects.value = []
    return
  }
  try {
    gradeSubjects.value = rows(await call('listGradeSubjects', selectedTermId.value, gradeLevel))
  } catch {
    gradeSubjects.value = []
  }
  // Always load the global subject master data so the merged dropdown
  // includes subjects that exist globally but are not yet at grade level.
  await loadAllSubjects()
}

async function loadClassSubjects() {
  if (!selectedTermId.value || !courseClassId.value) { classSubjects.value = []; return }
  courseLoading.value = true
  try {
    const res = await call('listClassSubjects', selectedTermId.value, courseClassId.value)
    classSubjects.value = rows(res)
    await loadGradeSubjects(courseClassGradeLevel.value)
  } catch (e: any) {
    showError(e?.message || '加载课程信息失败')
  } finally {
    courseLoading.value = false
  }
}

async function loadAllTeachers() {
  try {
    const res = await call('searchTeachers', '')
    allTeachers.value = rows(res)
  } catch {
    allTeachers.value = []
  }
}

async function openCourseManage(item: AnyRow) {
  courseClassId.value = item.id
  courseClassName.value = classNameOf(item)
  courseClassGradeLevel.value = Number(item.gradeLevel || 0)
  courseClassCombination.value = (item.courseCombination as string) || ''
  courseClassForeignLang.value = (item.foreignLanguage as string) || ''
  courseClassPhOrHi.value = (item.phOrHi as string) || ''
  courseClassElectiveTwo.value = (item.electiveTwo as string) || ''
  newSubjectId.value = ''
  newTeacherId.value = ''
  classSubjects.value = []
  gradeSubjects.value = []
  selectedTermId.value = ''
  courseLoading.value = false

  await Promise.all([loadAcademicTerms(), loadAllTeachers()])
  courseModalVisible.value = true

  // Auto-select first term
  if (academicTerms.value.length > 0) {
    const active = academicTerms.value.find((t: AnyRow) => Number(t.status) === 1) || academicTerms.value[0]
    selectedTermId.value = active.id
    await loadClassSubjects()
  }
}

function closeCourseModal() {
  courseModalVisible.value = false
}

async function addClassSubject() {
  if (!newSubjectId.value) {
    showError('请选择科目')
    return
  }
  try {
    await call('createClassSubject', {
      academicTermId: Number(selectedTermId.value),
      classId: Number(courseClassId.value),
      subjectId: Number(newSubjectId.value),
      teacherUserId: newTeacherId.value ? Number(newTeacherId.value) : undefined
    })
    newSubjectId.value = ''
    newTeacherId.value = ''
    await loadClassSubjects()
  } catch (e: any) {
    showError(e?.message || '添加课程失败')
  }
}

async function removeClassSubject(cs: AnyRow) {
  if (!confirm(`确定要删除"${cs.subjectName}"课程吗？`)) return
  try {
    await call('deleteClassSubject', cs.id)
    await loadClassSubjects()
  } catch (e: any) {
    showError(e?.message || '删除课程失败')
  }
}

function showError(msg: string) {
  errorModalMessage.value = msg
  errorModalVisible.value = true
}

// --- Teacher search helpers ---
async function doSearchAssignTeachers(keyword = assignTeacherKeyword.value) {
  if (assignTeacherSearchTimer) clearTimeout(assignTeacherSearchTimer)
  assignTeacherSearchLoading.value = true
  assignTeacherSearchTimer = setTimeout(async () => {
    try {
      assignTeacherSearchRows.value = rows(await call('searchTeachers', keyword.trim()))
    } catch {
      assignTeacherSearchRows.value = []
    } finally {
      assignTeacherSearchLoading.value = false
    }
  }, 300)
}

function onAssignTeacherInput() {
  if (assignTeacherId.value) assignTeacherId.value = ''
  doSearchAssignTeachers()
}

function selectAssignTeacher(teacher: AnyRow) {
  assignTeacherId.value = teacher.id
  assignTeacherKeyword.value = teacher.realName || teacher.name || teacher.loginName || ''
  assignTeacherSearchRows.value = []
}

function clearAssignTeacherSelection() {
  assignTeacherId.value = ''
  assignTeacherKeyword.value = ''
  doSearchAssignTeachers()
}

async function doSearchAddTeachers(keyword = addTeacherKeyword.value) {
  if (addTeacherSearchTimer) clearTimeout(addTeacherSearchTimer)
  addTeacherSearchLoading.value = true
  addTeacherSearchTimer = setTimeout(async () => {
    try {
      addTeacherSearchRows.value = rows(await call('searchTeachers', keyword.trim()))
    } catch {
      addTeacherSearchRows.value = []
    } finally {
      addTeacherSearchLoading.value = false
    }
  }, 300)
}

function onAddTeacherInput() {
  if (newTeacherId.value) newTeacherId.value = ''
  doSearchAddTeachers()
}

function selectAddTeacher(teacher: AnyRow) {
  newTeacherId.value = teacher.id
  addTeacherKeyword.value = teacher.realName || teacher.name || teacher.loginName || ''
  addTeacherSearchRows.value = []
}

function clearAddTeacherSelection() {
  newTeacherId.value = ''
  addTeacherKeyword.value = ''
  doSearchAddTeachers()
}

// --- Assign teacher ---
function openAssignTeacher(cs: AnyRow) {
  assignClassSubjectId.value = cs.id
  assignSubjectName.value = cs.subjectName
  assignTeacherId.value = cs.teacherUserId || ''
  assignTeacherKeyword.value = cs.teacherName || ''
  assignTeacherSearchRows.value = []
  assignTeacherSearchLoading.value = false
  assignModalVisible.value = true
  doSearchAssignTeachers()
}

function closeAssignModal() {
  assignModalVisible.value = false
  assignClassSubjectId.value = ''
  assignSubjectName.value = ''
  assignTeacherId.value = ''
  assignTeacherKeyword.value = ''
  assignTeacherSearchRows.value = []
}

async function saveAssignTeacher() {
  if (!assignTeacherId.value) {
    showError('请选择任课老师')
    return
  }
  try {
    await call('updateClassSubjectTeacher', assignClassSubjectId.value, Number(assignTeacherId.value))
    assignModalVisible.value = false
    await loadClassSubjects()
  } catch (e: any) {
    showError(e?.message || '设置任课老师失败')
  }
}

// --- Init ---
onMounted(async () => {
  await search(false)
})
</script>

<style scoped>
/* Course combination selection UI */
.course-combo-section {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 16px;
  margin-top: 4px;
}
.course-combo-section-title {
  margin: 0 0 12px;
  color: #0f172a;
  font-size: 14px;
  font-weight: 700;
}
.course-combo-step {
  margin-bottom: 12px;
}
.course-combo-step:last-of-type {
  margin-bottom: 0;
}
.course-combo-step-label {
  display: block;
  margin-bottom: 6px;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
}
.course-combo-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.course-combo-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid #dbe3ee;
  border-radius: 10px;
  cursor: pointer;
  background: #fff;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  transition: all .15s;
  user-select: none;
}
.course-combo-chip input {
  display: none;
}
.course-combo-chip:hover {
  border-color: #0f766e;
  background: #f0fdf9;
}
.course-combo-chip--active {
  background: #ecfdf5;
  border-color: #0f766e;
  color: #0f766e;
}
.course-combo-chip--disabled {
  opacity: .45;
  cursor: not-allowed;
}
.course-combo-preview {
  margin-top: 12px;
  padding: 8px 12px;
  background: #fff;
  border: 1px dashed #dbe3ee;
  border-radius: 8px;
  color: #475569;
  font-size: 13px;
}
.course-combo-preview strong {
  color: #0f172a;
}
.class-card__combo {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  background: #ecfdf5;
  color: #0f766e;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
}

/* Course combination info bar in course management modal */
.course-combo-info-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #f0fdf9;
  border: 1px solid #0f766e33;
  border-radius: 10px;
  margin-bottom: 14px;
  font-size: 13px;
  color: #334155;
}
.course-combo-info-bar strong {
  color: #0f766e;
}
.course-combo-expected {
  color: #64748b;
  font-size: 12px;
}

.course-combo-mismatch {
  padding: 8px 12px;
  background: #fef3c7;
  border: 1px solid #f59e0b33;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 12px;
  color: #92400e;
  font-weight: 600;
}

/* Course item rows (simplified) */
.course-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 6px;
}
.course-item-info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.course-item-info strong {
  font-size: 14px;
  white-space: nowrap;
}
.course-item-info span {
  font-size: 12px;
  color: #64748b;
}
.course-item-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

/* Add course row */
.course-add-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: #f0fdf9;
  border: 1px dashed #0f766e40;
  border-radius: 8px;
}
.course-add-select {
  flex: 1;
  min-width: 100px;
  height: 34px;
  font-size: 13px;
  padding: 4px 8px;
}
@media (max-width: 580px) {
  .course-add-row {
    flex-wrap: wrap;
  }
  .course-add-select {
    flex: 1 1 100%;
  }
}
</style>
