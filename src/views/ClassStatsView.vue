<template>
  <section class="page class-stats-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">Analytics</p>
        <h1>班级成绩统计</h1>
        <p class="lead">从班级维度聚合分析成绩分布、各科统计与偏科情况。</p>
      </div>
    </header>

    <!-- Filter Panel -->
    <section class="panel">
      <h2>查询条件</h2>
      <div class="card-form compact">
        <select v-model="query.academicTermId">
          <option value="">选择学期</option>
          <option v-for="t in terms" :key="t.id" :value="t.id">{{ t.termName || t.name }}</option>
        </select>
        <select v-model="query.classId">
          <option value="">选择班级</option>
          <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.className || c.name }}</option>
        </select>
        <select v-model="query.examTypeId">
          <option value="">选择考试类型（必选）</option>
          <option v-for="et in examTypes" :key="et.id" :value="et.id">{{ et.examTypeName || et.name }}</option>
        </select>
        <select v-model="query.scoreMode">
          <option value="Raw">原始分</option>
          <option value="Scaled100">百分制折算</option>
        </select>
        <button
          class="button primary"
          type="button"
          :disabled="loading || !canQuery"
          @click="executeQuery"
        >
          {{ loading ? '查询中…' : '查询' }}
        </button>
      </div>
    </section>

    <!-- Error / Empty / Truncated -->
    <p v-if="error" class="error">{{ error }}</p>
    <div v-if="report && report.truncated" class="warning-banner">
      ⚠️ 数据量过大（{{ report.resultCount }} 条），仅展示前 {{ MAX_RESULTS }} 条结果，统计可能不完整。请缩小筛选范围。
    </div>
    <p v-if="showEmpty" class="empty-panel">该班级暂无成绩数据，请先录入成绩。</p>
    <p v-if="showIdle" class="idle-hint">
      请选择学期、班级和考试类型后，点击「查询」按钮查看统计结果。
      <br /><small style="color: #94a3b8">（学期 {{ terms.length }} 个，班级 {{ classes.length }} 个，考试类型 {{ examTypes.length }} 个）</small>
    </p>

    <!-- Overview Cards -->
    <div v-if="report" class="metrics">
      <div class="metric">
        <p class="metric-label">班级人数</p>
        <strong>{{ report.studentCount }}</strong>
      </div>
      <div class="metric">
        <p class="metric-label">科目数</p>
        <strong>{{ report.subjectCount }}</strong>
      </div>
      <div class="metric">
        <p class="metric-label">总分平均</p>
        <strong>{{ formatMark(report.totalAvg) }}</strong>
        <p class="metric-foot">{{ query.scoreMode === 'Scaled100' ? '百分制折算' : '原始分加总' }}</p>
      </div>
      <div class="metric">
        <p class="metric-label">总分中位数</p>
        <strong>{{ formatMark(report.totalMedian) }}</strong>
      </div>
    </div>

    <!-- Subject Statistics Table -->
    <section v-if="report && report.subjectStats.length" class="panel">
      <h2>各科统计</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>科目</th>
              <th>满分</th>
              <th>平均分</th>
              <th>中位数</th>
              <th>标准差</th>
              <th>最高</th>
              <th>最低</th>
              <th>及格率</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="stat in report.subjectStats" :key="stat.subjectId">
              <td><strong>{{ stat.subjectName }}</strong></td>
              <td>{{ stat.maxScore }}</td>
              <td>{{ formatMark(stat.avgScore) }}</td>
              <td>{{ formatMark(stat.medianScore) }}</td>
              <td>{{ formatMark(stat.stdDev) }}</td>
              <td>{{ formatMark(stat.maxResult) }}</td>
              <td>{{ formatMark(stat.minResult) }}</td>
              <td>
                <span :class="passRateClass(stat.passRate)">{{ stat.passRate }}%</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Bar Charts -->
    <section v-if="report && report.subjectStats.length" class="panel">
      <h2>分数分布</h2>
      <div class="chart-grid">
        <div v-for="stat in report.subjectStats" :key="'chart-' + stat.subjectId" class="chart-card">
          <p class="chart-title">{{ stat.subjectName }}</p>
          <svg :viewBox="'0 0 ' + chartWidth + ' ' + chartHeight" class="chart-svg" role="img">
            <!-- Y axis labels -->
            <text v-for="(label, i) in chartYLabels(stat)" :key="'y-' + i"
              :x="chartYLabelX" :y="chartYPos(i, chartYLabels(stat).length)" class="chart-axis-label"
              text-anchor="end">{{ label }}</text>
            <!-- Bars -->
            <g v-for="(bucket, bi) in stat.buckets" :key="'bar-' + bi">
              <rect
                :x="barX(bi)"
                :y="barTop(stat, bucket.count)"
                :width="barWidth"
                :height="barHeight(stat, bucket.count)"
                class="chart-bar"
              />
              <text
                :x="barX(bi) + barWidth / 2"
                :y="barTop(stat, bucket.count) - 4"
                class="chart-bar-label"
                text-anchor="middle"
                v-if="bucket.count > 0"
              >{{ bucket.count }}</text>
              <!-- X axis bucket labels (every other to prevent crowding) -->
              <text
                v-if="bi % labelSkip(stat) === 0 || bi === stat.buckets.length - 1"
                :x="barX(bi) + barWidth / 2"
                :y="chartHeight - 4"
                class="chart-axis-label"
                text-anchor="middle"
              >{{ bucket.label }}</text>
            </g>
          </svg>
        </div>
      </div>
    </section>

    <!-- Weakness Analysis -->
    <section v-if="report && report.forwardWeakness.length" class="panel">
      <h2>正向偏科（总分高于平均，但单科薄弱）</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>学生</th>
              <th>总分</th>
              <th>薄弱科目</th>
              <th>得分</th>
              <th>该科平均</th>
              <th>差距</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="w in report.forwardWeakness" :key="'fw-' + w.studentId + '-' + w.weakSubjectName">
              <td><strong>{{ w.studentName }}</strong></td>
              <td>{{ formatMark(w.totalScore) }}</td>
              <td>{{ w.weakSubjectName }}</td>
              <td>{{ formatMark(w.score) }}</td>
              <td>{{ formatMark(w.subjectAvg) }}</td>
              <td class="gap-cell gap-negative">-{{ formatMark(w.gap) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="report && report.reverseWeakness.length" class="panel">
      <h2>反向偏科（总分低于平均，但单科突出）</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>学生</th>
              <th>总分</th>
              <th>突出科目</th>
              <th>得分</th>
              <th>该科平均</th>
              <th>超出</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="w in report.reverseWeakness" :key="'rw-' + w.studentId + '-' + w.strongSubjectName">
              <td><strong>{{ w.studentName }}</strong></td>
              <td>{{ formatMark(w.totalScore) }}</td>
              <td>{{ w.strongSubjectName }}</td>
              <td>{{ formatMark(w.score) }}</td>
              <td>{{ formatMark(w.subjectAvg) }}</td>
              <td class="gap-cell gap-positive">+{{ formatMark(w.gap) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import * as schoolApi from '../api/school'

// ---- Types ----

type AnyRow = Record<string, any>

interface ScoreBucket {
  label: string
  min: number
  max: number
  count: number
  percent: number
}

interface SubjectStats {
  subjectId: number
  subjectName: string
  minScore: number
  maxScore: number
  avgScore: number
  medianScore: number
  stdDev: number
  maxResult: number
  minResult: number
  passLine: number
  passRate: number
  totalStudents: number
  buckets: ScoreBucket[]
}

interface WeaknessItem {
  studentId: number
  studentName: string
  totalScore: number
  weakSubjectName?: string
  strongSubjectName?: string
  score: number
  subjectAvg: number
  gap: number
}

interface ClassScoreReport {
  classId: number
  className: string
  academicTermId: number
  examTypeId: number
  studentCount: number
  subjectCount: number
  totalAvg: number
  totalMedian: number
  scoreMode: string
  resultCount: number
  truncated: boolean
  subjectStats: SubjectStats[]
  forwardWeakness: WeaknessItem[]
  reverseWeakness: WeaknessItem[]
}

// ---- Constants ----

const MAX_RESULTS = 2000
const THRESHOLD_MULTIPLIER = 1.0

// ---- Chart Constants ----

const chartWidth = 460
const chartHeight = 160
const chartMarginLeft = 32
const chartMarginRight = 12
const chartMarginTop = 18
const chartMarginBottom = 24
const chartPlotLeft = chartMarginLeft
const chartPlotWidth = chartWidth - chartMarginLeft - chartMarginRight
const chartPlotTop = chartMarginTop
const chartPlotHeight = chartHeight - chartMarginTop - chartMarginBottom
const chartYLabelX = chartMarginLeft - 4

// ---- Helpers (matching existing TranscriptsView pattern) ----

const payload = (res: any) => res?.data?.data ?? res?.data ?? res ?? {}
const rows = (value: any): AnyRow[] => {
  const data = payload(value)
  if (Array.isArray(data)) return data
  return data.items || data.records || data.list || data.content || []
}
const call = async (name: string, ...params: any[]) => {
  const fn = (schoolApi as AnyRow)[name]
  return fn ? fn(...params) : []
}

// ---- State ----

const terms = ref<AnyRow[]>([])
const classes = ref<AnyRow[]>([])
const examTypes = ref<AnyRow[]>([])
const loading = ref(false)
const error = ref('')
const report = ref<ClassScoreReport | null>(null)
const abortController = ref<AbortController | null>(null)

const query = reactive({
  academicTermId: '',
  classId: '',
  examTypeId: '',
  scoreMode: 'Raw' as 'Raw' | 'Scaled100'
})

const canQuery = computed(() =>
  query.academicTermId && query.classId && query.examTypeId
)

const showEmpty = computed(() =>
  !loading.value && !error.value && report.value && report.value.subjectStats.length === 0
)

const showIdle = computed(() =>
  !loading.value && !error.value && !report.value
)

// ---- Lifecycle ----

onMounted(async () => {
  try {
    const [termRes, classRes, examRes] = await Promise.all([
      call('listAcademicTerms').catch(() => []),
      call('listClasses', { page: 1, size: 200 }).catch(() => []),
      call('listExamTypes').catch(() => [])
    ])
    terms.value = rows(termRes)
    classes.value = rows(classRes)
    examTypes.value = rows(examRes)
  } catch {
    // silently ignore base data load failures; query will show errors
  }
})

// ---- Event handlers ----

async function executeQuery() {
  if (!canQuery.value || loading.value) return

  // Cancel previous in-flight request (MG-6)
  abortController.value?.abort()
  const controller = new AbortController()
  abortController.value = controller

  loading.value = true
  error.value = ''

  try {
    const res = await call('listStudentResults', {
      academicTermId: Number(query.academicTermId),
      classId: Number(query.classId),
      examTypeId: Number(query.examTypeId),
    }, controller.signal)

    const rawResults: AnyRow[] = rows(res)

    // R2: Builder-layer assert
    if (!query.examTypeId) {
      throw new Error('请选择考试类型')
    }

    report.value = buildReport(rawResults, query.scoreMode)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return
    error.value = err instanceof Error ? err.message : '查询失败'
  } finally {
    loading.value = false
    abortController.value = null
  }
}

// ---- Formatting ----

function formatMark(value: number): string {
  if (!Number.isFinite(value)) return '-'
  if (value === Math.floor(value)) return String(Math.floor(value))
  return value.toFixed(1)
}

function passRateClass(rate: number): string {
  if (rate >= 90) return 'pass-rate-good'
  if (rate >= 60) return 'pass-rate-ok'
  return 'pass-rate-low'
}

// ---- Builder: Domain Service Logic ----

function buildReport(rawResults: AnyRow[], scoreMode: string): ClassScoreReport {
  // R1: Truncation
  const totalResults = rawResults.length
  const truncated = totalResults > MAX_RESULTS
  const results = truncated ? rawResults.slice(0, MAX_RESULTS) : rawResults

  // Group by subject
  const subjectMap = new Map<number, AnyRow[]>()
  const studentMap = new Map<number, { id: number; name: string; scores: AnyRow[] }>()

  for (const r of results) {
    const sid = Number(r.subjectId) || 0
    if (sid === 0) continue
    if (!subjectMap.has(sid)) subjectMap.set(sid, [])
    subjectMap.get(sid)!.push(r)

    const studentId = Number(r.studentId) || 0
    if (studentId === 0) continue
    if (!studentMap.has(studentId)) {
      studentMap.set(studentId, { id: studentId, name: String(r.studentName || ''), scores: [] })
    }
    studentMap.get(studentId)!.scores.push(r)
  }

  // Step 2: Subject statistics
  const subjectStats: SubjectStats[] = []
  for (const [subjectId, subjectResults] of subjectMap) {
    const first = subjectResults[0]
    const maxScore = Number(first.maxScore) || 100
    const minScore = Number(first.minScore) || 0
    const passLine = maxScore * 0.6

    const scores = subjectResults.map(r => Number(r.score) || 0).sort((a, b) => a - b)
    const n = scores.length
    const sum = scores.reduce((a, b) => a + b, 0)
    const avg = n > 0 ? sum / n : 0
    const median = calcMedian(scores)
    const stdDev = calcStdDev(scores, avg)
    const maxResult = scores.length > 0 ? scores[scores.length - 1] : 0
    const minResult = scores.length > 0 ? scores[0] : 0
    const passCount = scores.filter(s => s >= passLine).length
    const passRate = n > 0 ? Math.round(passCount / n * 100) : 0
    const buckets = buildBuckets(scores, minScore, maxScore)

    subjectStats.push({
      subjectId,
      subjectName: String(first.subjectName || ''),
      minScore, maxScore,
      avgScore: avg,
      medianScore: median,
      stdDev,
      maxResult, minResult,
      passLine,
      passRate,
      totalStudents: n,
      buckets
    })
  }

  // Step 3: Student total scores
  const studentTotals: { id: number; name: string; scores: AnyRow[]; totalScore: number }[] = []
  for (const [, student] of studentMap) {
    let total = 0
    for (const s of student.scores) {
      const score = Number(s.score) || 0
      const maxS = Number(s.maxScore) || 100
      if (scoreMode === 'Scaled100') {
        total += maxS > 0 ? (score / maxS) * 100 : 0
      } else {
        total += score
      }
    }
    studentTotals.push({ ...student, totalScore: total })
  }

  // Step 4-5: Class overview
  const allTotals = studentTotals.map(s => s.totalScore).sort((a, b) => a - b)
  const totalAvg = allTotals.length > 0 ? allTotals.reduce((a, b) => a + b, 0) / allTotals.length : 0
  const totalMedian = calcMedian(allTotals)

  // Step 6: Weakness analysis (bidirectional)
  const { forwardWeakness, reverseWeakness } = findWeaknessItems(results, subjectStats, studentTotals, totalAvg)

  // Step 7: Assemble
  return {
    classId: Number(query.classId) || 0,
    className: '',
    academicTermId: Number(query.academicTermId) || 0,
    examTypeId: Number(query.examTypeId) || 0,
    studentCount: studentMap.size,
    subjectCount: subjectMap.size,
    totalAvg,
    totalMedian,
    scoreMode,
    resultCount: totalResults,
    truncated,
    subjectStats,
    forwardWeakness,
    reverseWeakness
  }
}

// ---- Builder: sub-algorithms ----

function calcMedian(sorted: number[]): number {
  if (sorted.length === 0) return 0
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

function calcStdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function buildBuckets(scores: number[], minScore: number, maxScore: number, binSize: number = 5): ScoreBucket[] {
  if (scores.length === 0) return []
  const binStart = Math.floor(minScore / binSize) * binSize
  const binEnd = Math.ceil(maxScore / binSize) * binSize
  const bins: ScoreBucket[] = []

  for (let low = binStart; low < binEnd; low += binSize) {
    const high = low + binSize
    const isLast = high >= binEnd
    const count = isLast
      ? scores.filter(s => s >= low && s <= high).length
      : scores.filter(s => s >= low && s < high).length
    bins.push({
      label: `${low}-${high}`,
      min: low,
      max: high,
      count,
      percent: Math.round(count / scores.length * 100)
    })
  }
  return bins
}

function findWeaknessItems(
  _rawResults: AnyRow[],
  subjectStats: SubjectStats[],
  studentTotals: { id: number; name: string; scores: AnyRow[]; totalScore: number }[],
  totalAvg: number
): { forwardWeakness: WeaknessItem[]; reverseWeakness: WeaknessItem[] } {
  const forward: WeaknessItem[] = []
  const reverse: WeaknessItem[] = []

  const statBySubject = new Map<number, SubjectStats>()
  for (const stat of subjectStats) {
    statBySubject.set(stat.subjectId, stat)
  }

  for (const student of studentTotals) {
    for (const score of student.scores) {
      const stat = statBySubject.get(Number(score.subjectId) || 0)
      if (!stat) continue

      const rawScore = Number(score.score) || 0
      const gap = rawScore - stat.avgScore
      const threshold = THRESHOLD_MULTIPLIER * stat.stdDev

      // Forward: total above avg but subject significantly below
      if (student.totalScore > totalAvg && -gap >= threshold) {
        forward.push({
          studentId: student.id,
          studentName: student.name,
          totalScore: student.totalScore,
          weakSubjectName: stat.subjectName,
          score: rawScore,
          subjectAvg: stat.avgScore,
          gap: -gap
        })
      }

      // Reverse: total below avg but subject significantly above
      if (student.totalScore < totalAvg && gap >= threshold) {
        reverse.push({
          studentId: student.id,
          studentName: student.name,
          totalScore: student.totalScore,
          strongSubjectName: stat.subjectName,
          score: rawScore,
          subjectAvg: stat.avgScore,
          gap
        })
      }
    }
  }

  forward.sort((a, b) => b.gap - a.gap)
  reverse.sort((a, b) => b.gap - a.gap)
  return { forwardWeakness: forward, reverseWeakness: reverse }
}

// ---- Chart helpers ----

function chartMaxCount(stat: SubjectStats): number {
  const max = Math.max(...stat.buckets.map(b => b.count), 1)
  return Math.ceil(max / 5) * 5 + 5 // round up with padding
}

function chartYLabels(stat: SubjectStats): string[] {
  const max = chartMaxCount(stat)
  const step = Math.max(1, Math.ceil(max / 4))
  const labels: string[] = []
  for (let v = 0; v <= max; v += step) {
    labels.push(String(v))
  }
  return labels
}

function chartYPos(labelIndex: number, totalLabels: number): number {
  const maxIdx = totalLabels > 1 ? totalLabels - 1 : 1
  const frac = labelIndex / maxIdx
  return chartPlotTop + chartPlotHeight * (1 - frac)
}

const barGap = 2

function computeBarWidth(): number {
  if (!report.value) return 14
  const maxBuckets = Math.max(...report.value.subjectStats.map(s => s.buckets.length), 1)
  const available = chartPlotWidth - (maxBuckets - 1) * barGap
  return Math.max(6, Math.min(22, available / maxBuckets))
}

const barWidth = computed(() => computeBarWidth())

function barX(index: number): number {
  return chartPlotLeft + index * (barWidth.value + barGap)
}

function barTop(stat: SubjectStats, count: number): number {
  const maxC = chartMaxCount(stat)
  const frac = maxC > 0 ? count / maxC : 0
  return chartPlotTop + chartPlotHeight * (1 - frac)
}

function barHeight(stat: SubjectStats, count: number): number {
  const top = barTop(stat, count)
  return chartPlotTop + chartPlotHeight - top
}

function labelSkip(stat: SubjectStats): number {
  const n = stat.buckets.length
  if (n <= 8) return 1
  if (n <= 16) return 2
  return 3
}
</script>

<style scoped>
.class-stats-page {
  display: grid;
  gap: 18px;
}

.warning-banner {
  color: #92400e;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 14px;
  padding: 14px 18px;
  font-size: 14px;
  font-weight: 600;
}

.empty-panel {
  color: #94a3b8;
  text-align: center;
  background: #ffffffeb;
  border: 1px solid #e2e8f0eb;
  border-radius: 20px;
  padding: 48px 20px;
  font-size: 15px;
  box-shadow: 0 18px 40px #0f172a0d;
}

.idle-hint {
  color: #94a3b8;
  text-align: center;
  padding: 64px 20px;
  font-size: 15px;
  line-height: 1.6;
}

.pass-rate-good {
  color: #065f46;
  background: #d1fae5;
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 700;
}

.pass-rate-ok {
  color: #92400e;
  background: #fef3c7;
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 700;
}

.pass-rate-low {
  color: #b91c1c;
  background: #fee2e2;
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 700;
}

/* Chart styles */
.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18px;
}

.chart-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 16px;
}

.chart-title {
  color: #0f172a;
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 700;
}

.chart-svg {
  width: 100%;
  height: auto;
  display: block;
}

.chart-bar {
  fill: #0f766e;
  rx: 2;
  ry: 2;
}

.chart-bar-label {
  fill: #475569;
  font-size: 10px;
  font-family: Inter, Noto Sans SC, sans-serif;
}

.chart-axis-label {
  fill: #94a3b8;
  font-size: 10px;
  font-family: Inter, Noto Sans SC, sans-serif;
}

/* Weakness table */
.gap-cell {
  font-weight: 700;
  font-size: 14px;
}

.gap-negative {
  color: #b91c1c;
}

.gap-positive {
  color: #0f766e;
}

/* Responsive */
@media (max-width: 860px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }
}
</style>
