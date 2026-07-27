<template>
  <section class="page transcripts-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">Reports</p>
        <h1>成绩单</h1>
        <p class="lead">生成并下载学生成绩单 PDF。</p>
      </div>
      <button class="button" type="button" :disabled="loading" @click="loadPage">刷新</button>
    </header>

    <section class="panel">
      <h2>筛选条件</h2>
      <div class="card-form compact">
        <select v-model="query.academicTermId" @change="search(true)">
          <option value="">学期</option>
          <option v-for="term in terms" :key="term.id" :value="term.id">{{ term.termName || term.name }}</option>
        </select>
        <select v-model="query.classId" @change="handleClassChange">
          <option value="">班级</option>
          <option v-for="klass in classes" :key="klass.id" :value="klass.id">{{ klass.className || klass.name }}</option>
        </select>
        <select v-model="query.studentId" @change="search(true)">
          <option value="">学生</option>
          <option v-for="student in students" :key="student.id" :value="student.id">{{ student.studentName || student.name }}</option>
        </select>
        <select v-model="query.examTypeId">
          <option value="">考试类型（可选）</option>
          <option v-for="type in examTypes" :key="type.id" :value="type.id">{{ type.examTypeName || type.name }}</option>
        </select>
        <button class="button" type="button" @click="search(false)">查询</button>
      </div>
    </section>

    <form v-if="canManageTranscripts" class="card-form compact generate-form" @submit.prevent="submitGenerate">
      <input v-model.trim="query.generatedByUserId" placeholder="生成人用户ID（可选）" />
      <button class="button primary" type="submit">生成成绩单</button>
    </form>
    <section v-else class="panel">
      <h2>只读模式</h2>
      <p class="lead">当前账号只能查看和下载成绩单，不能生成新的成绩单。</p>
    </section>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="success">{{ success }}</p>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>成绩单编号</th>
            <th>学生</th>
            <th>班级</th>
            <th>文件</th>
            <th>生成时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in transcripts" :key="item.id">
            <td>{{ item.transcriptNo || '-' }}</td>
            <td>{{ item.studentName || '-' }}</td>
            <td>{{ item.className || '-' }}</td>
            <td>{{ item.pdfFileName || '-' }}</td>
            <td>{{ item.generatedAt || '-' }}</td>
            <td>
              <button
                class="button ghost sm"
                type="button"
                :disabled="downloadingIds.has(item.id)"
                @click="downloadById(item.id)"
              >
                {{ downloadingIds.has(item.id) ? '下载中...' : '下载' }}
              </button>
              <button
                v-if="canManageTranscripts"
                class="button ghost sm regenerate-button"
                type="button"
                :disabled="regeneratingIds.has(item.id)"
                @click="submitRegenerate(item.id)"
              >
                {{ regeneratingIds.has(item.id) ? '重新生成中…' : '重新生成' }}
              </button>
            </td>
          </tr>
          <tr v-if="!transcripts.length">
            <td colspan="6" class="empty">暂无成绩单数据</td>
          </tr>
        </tbody>
      </table>
      <div class="pagination">
        <div class="pagination-left">
          <span class="pagination-info">共 {{ total }} 条，第 {{ page.current }}/{{ totalPages }} 页</span>
          <label class="pagination-size-label">
            每页
            <select v-model.number="page.size" class="pagination-size-select" @change="changePageSize">
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
            条
          </label>
        </div>
        <div class="pagination-buttons">
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
    </div>

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
import { computed, defineComponent, h, onMounted, reactive, ref } from 'vue'
import DownloadProgress from '../components/DownloadProgress.vue'
import { useAuthStore } from '../stores/auth'
import * as schoolApi from '../api/school'

type AnyRow = Record<string, any>

const auth = useAuthStore()
const canManageTranscripts = computed(() => auth.canManageTranscripts)
const terms = ref<AnyRow[]>([])
const classes = ref<AnyRow[]>([])
const students = ref<AnyRow[]>([])
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
  classId: '',
  studentId: '',
  examTypeId: '',
  generatedByUserId: ''
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
  const [termRes, classRes, examRes] = await Promise.all([
    call('listAcademicTerms'),
    call('listClasses', { page: 1, size: 200 }),
    call('listExamTypes').catch(() => [])
  ])
  terms.value = rows(termRes)
  classes.value = rows(classRes)
  examTypes.value = rows(examRes)
}

async function loadStudents() {
  if (!query.classId) {
    students.value = []
    return
  }
  students.value = rows(await call('listStudents', { classId: Number(query.classId), page: 1, size: 200 }))
  if (query.studentId && !students.value.some((student) => String(student.id) === String(query.studentId))) {
    query.studentId = ''
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

async function search(resetPage = false) {
  if (resetPage) {
    page.current = 1
  }
  loading.value = true
  error.value = ''
  try {
    if (query.classId) {
      await loadStudents()
    }
    const res = await call('listTranscripts', {
      academicTermId: query.academicTermId ? Number(query.academicTermId) : undefined,
      classId: query.classId ? Number(query.classId) : undefined,
      studentId: query.studentId ? Number(query.studentId) : undefined,
      page: page.current,
      size: page.size
    })
    transcripts.value = rows(res)
    total.value = totalOf(res)
    explicitTotalPages.value = totalPagesOf(res)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function handleClassChange() {
  query.studentId = ''
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

async function submitGenerate() {
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

onMounted(loadPage)
</script>

<style scoped>
.transcripts-page {
  display: grid;
  gap: 18px;
}
.generate-form {
  background: transparent;
}
.regenerate-button {
  margin-left: 6px;
}
.pagination {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
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
.empty {
  color: #64748b;
  text-align: center;
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
  background: linear-gradient(135deg, #0f766e, #0f9f8e);
  transition: width .15s ease;
}
:global(.progress-text) {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 14px;
  font-weight: 700;
  text-align: center;
}
@media (max-width: 760px) {
  .pagination,
  .pagination-left,
  .pagination-buttons {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
