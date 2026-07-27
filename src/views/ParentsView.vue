<template>
  <section class="parents-page">
    <div class="page-hero">
      <div>
        <p class="eyebrow">Parent Portal</p>
        <h1>家长查看</h1>
        <p>按学期、班级和学生查看成绩、评价与成绩单。</p>
      </div>
      <button class="ghost-btn" type="button" @click="loadAll">刷新</button>
    </div>

    <div class="panel">
      <div class="filter-grid">
        <label>
          <span>学期</span>
          <select v-model="query.academicTermId" @change="loadAll">
            <option value="">全部学期</option>
            <option v-for="term in terms" :key="term.id" :value="term.id">{{ term.termName || term.name }}</option>
          </select>
        </label>
        <label>
          <span>班级</span>
          <select v-model="query.classId" @change="onClassChange">
            <option value="">全部班级</option>
            <option v-for="klass in classes" :key="klass.id" :value="klass.id">{{ klass.className || klass.name }}</option>
          </select>
        </label>
        <label>
          <span>学生</span>
          <select v-model="query.studentId" @change="loadStudentData">
            <option value="">请选择学生</option>
            <option v-for="student in students" :key="student.id" :value="student.id">{{ student.studentName || student.name }}</option>
          </select>
        </label>
      </div>
    </div>

    <div class="metric-grid">
      <article class="metric-card"><span>学生</span><strong>{{ selectedStudentName }}</strong></article>
      <article class="metric-card"><span>课程成绩</span><strong>{{ scoreRows.length }}</strong></article>
      <article class="metric-card"><span>总体评价</span><strong>{{ comments.length }}</strong></article>
      <article class="metric-card"><span>成绩单</span><strong>{{ transcripts.length }}</strong></article>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>课程成绩</h2></div>
      <table class="data-table">
        <thead><tr><th>课程</th><th>成绩</th><th>等级</th><th>考试类型</th></tr></thead>
        <tbody>
          <tr v-for="row in scoreRows" :key="row.id || `${row.subjectName}-${row.examTypeName}`">
            <td>{{ row.subjectName || row.courseName || '-' }}</td>
            <td>{{ row.score ?? row.scoreValue ?? '-' }}</td>
            <td>{{ row.gradeLevel || row.scoreLevel || '-' }}</td>
            <td>{{ row.examTypeName || '-' }}</td>
          </tr>
          <tr v-if="!scoreRows.length"><td colspan="4" class="empty">暂无课程成绩</td></tr>
        </tbody>
      </table>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>总体评价</h2></div>
      <div class="comment-list">
        <article v-for="item in comments" :key="item.id" class="comment-card">
          <strong>{{ item.examTypeName || item.termName || '评价' }}</strong>
          <p>{{ item.comment || item.content || '暂无内容' }}</p>
        </article>
        <p v-if="!comments.length" class="empty-text">暂无总体评价</p>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>成绩单</h2></div>
      <table class="data-table">
        <thead><tr><th>学生</th><th>学期</th><th>考试类型</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="item in transcripts" :key="item.id">
            <td>{{ item.studentName || '-' }}</td>
            <td>{{ item.termName || item.academicTermName || '-' }}</td>
            <td>{{ item.examTypeName || '-' }}</td>
            <td>{{ item.statusName || item.status || '-' }}</td>
            <td><button class="link-btn" type="button" @click="download(item)">下载</button></td>
          </tr>
          <tr v-if="!transcripts.length"><td colspan="5" class="empty">暂无成绩单</td></tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import * as schoolApi from '../api/school'

type AnyRow = Record<string, any>
const terms = ref<AnyRow[]>([])
const classes = ref<AnyRow[]>([])
const students = ref<AnyRow[]>([])
const scoreRows = ref<AnyRow[]>([])
const comments = ref<AnyRow[]>([])
const transcripts = ref<AnyRow[]>([])
const query = reactive({ academicTermId: '', classId: '', studentId: '' })

const payload = (res: any) => res?.data?.data ?? res?.data ?? res ?? {}
const rows = (value: any): AnyRow[] => {
  const data = payload(value)
  if (Array.isArray(data)) return data
  return data.records || data.list || data.items || data.content || []
}
const call = async (name: string, ...params: any[]) => {
  const fn = (schoolApi as AnyRow)[name]
  return fn ? fn(...params) : []
}
const selectedStudentName = computed(() => {
  const student = students.value.find((item) => String(item.id) === String(query.studentId))
  return student?.studentName || student?.name || '未选择'
})

async function loadBase() {
  const [termRes, classRes] = await Promise.all([call('listAcademicTerms'), call('listClasses', { page: 1, size: 200 })])
  terms.value = rows(termRes)
  classes.value = rows(classRes)
}
async function onClassChange() {
  query.studentId = ''
  await loadStudents()
  await loadStudentData()
}
async function loadStudents() {
  const params: AnyRow = { page: 1, size: 500 }
  if (query.classId) params.classId = query.classId
  students.value = rows(await call('listStudents', params))
}
async function loadStudentData() {
  if (!query.studentId) {
    scoreRows.value = []
    comments.value = []
    transcripts.value = []
    return
  }
  const params = { academicTermId: query.academicTermId || undefined, studentId: query.studentId }
  const [scoreRes, commentRes, transcriptRes] = await Promise.all([
    call('listStudentResults', params),
    call('listOverallComments', params),
    call('listTranscripts', params)
  ])
  scoreRows.value = rows(scoreRes)
  comments.value = rows(commentRes)
  transcripts.value = rows(transcriptRes)
}
async function loadAll() {
  await loadBase()
  await loadStudents()
  await loadStudentData()
}
async function download(item: AnyRow) {
  const fn = (schoolApi as AnyRow).downloadTranscript
  if (!fn || !item.id) return
  const res = await fn(item.id)
  const blob = res?.data instanceof Blob ? res.data : new Blob([res?.data ?? res], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = item.fileName || `${item.studentName || '成绩单'}.pdf`
  link.click()
  URL.revokeObjectURL(url)
}
onMounted(loadAll)
</script>

<style scoped>
.parents-page { display: grid; gap: 20px; }
.page-hero, .panel, .metric-card {
  border: 1px solid #e2e8f0eb;
  border-radius: 20px;
  background: #ffffffeb;
  box-shadow: 0 18px 40px #0f172a0d;
}
.page-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 28px 32px;
}
.page-hero h1 { margin: 6px 0 8px; color: #111827; font-size: 30px; }
.page-hero p, .empty-text { margin: 0; color: #6b7280; }
.eyebrow { margin: 0; color: #0f766e; font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.panel { padding: 22px; }
.panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.panel-head h2 { margin: 0; color: #111827; font-size: 20px; }
.filter-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
label { display: grid; gap: 7px; color: #374151; font-weight: 800; }
select, input {
  height: 40px;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  padding: 0 12px;
  color: #111827;
  background: #fff;
}
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.metric-card { padding: 18px; }
.metric-card span { color: #4b5563; font-weight: 800; }
.metric-card strong { display: block; margin-top: 8px; color: #0f172a; font-size: 24px; }
.data-table { width: 100%; border-collapse: collapse; color: #1f2937; }
.data-table th { text-align: center; color: #64748b; font-weight: 800; background: #f8fafc; }
.data-table td { text-align: left; }
.data-table th, .data-table td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
.empty { text-align: center !important; color: #9ca3af; }
.comment-list { display: grid; gap: 12px; }
.comment-card { padding: 14px; border-radius: 14px; background: #f8fafc; }
.comment-card strong { color: #111827; }
.comment-card p { margin: 8px 0 0; color: #374151; }
.ghost-btn, .link-btn {
  border: 1px solid #dbe3ee;
  border-radius: 10px;
  background: #fff;
  color: #374151;
  font-weight: 700;
  cursor: pointer;
}
.ghost-btn { height: 38px; padding: 0 16px; }
.link-btn { height: 32px; padding: 0 12px; color: #0f766e; border-color: #dbe3ee; }
.page-hero { padding: 24px; }
.page-hero h1 { margin: 4px 0 0; color: #0f172a; font-size: 32px; line-height: 1.15; }
.page-hero p { margin: 10px 0 0; color: #64748b; font-size: 14px; }
.empty-text { color: #64748b; font-size: 13px; }
.panel { padding: 18px; }
.panel-head { align-items: flex-start; margin-bottom: 14px; }
.panel-head h2 { margin: 0 0 14px; color: #0f172a; font-size: 18px; }
label { color: #475569; font-size: 13px; font-weight: 700; }
select, input { height: auto; min-height: 42px; border: 1px solid #dbe3ee; border-radius: 14px; padding: 11px 13px; font-size: 14px; }
select:focus, input:focus { border-color: #0f766e; outline: 3px solid #14b8a629; }
.metric-card span { color: #64748b; font-size: 13px; font-weight: 700; }
.data-table th { color: #64748b; font-size: 13px; font-weight: 700; }
.data-table th, .data-table td { padding: 14px 16px; border-bottom: 1px solid #e5e7eb; }
.comment-card strong { color: #0f172a; }
.comment-card p { color: #334155; font-size: 14px; line-height: 1.6; }
.ghost-btn, .link-btn { border-radius: 11px; color: #0f172a; font-size: 13px; font-weight: 700; background: #f8fafc; }
.ghost-btn { height: auto; padding: 9px 13px; }
.link-btn { height: auto; border-radius: 9px; padding: 6px 11px; font-size: 12px; }
@media (max-width: 900px) {
  .filter-grid, .metric-grid { grid-template-columns: 1fr; }
  .page-hero { align-items: flex-start; flex-direction: column; }
}
</style>
