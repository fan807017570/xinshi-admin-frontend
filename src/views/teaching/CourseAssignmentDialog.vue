<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { CourseCombination, SelectionStudent } from '../../api/teachingDemo'

const props = defineProps<{
  open: boolean
  students: SelectionStudent[]
  combinations: CourseCombination[]
  selectedCode: string
  saving: boolean
  error: string
}>()

const emit = defineEmits<{
  close: []
  updateCode: [combinationCode: string]
  confirm: [combinationCode: string]
}>()

const dialog = ref<HTMLDialogElement | null>(null)
const combination = computed(() => props.combinations.find((item) => item.code === props.selectedCode))
const changedStudents = computed(() => props.students.filter((student) => student.selectionCode !== props.selectedCode))
const unchangedCount = computed(() => props.students.length - changedStudents.value.length)

function requestClose() {
  if (props.saving) return
  if (dialog.value?.open) dialog.value.close()
  else emit('close')
}

function confirm() {
  if (props.saving || !props.selectedCode) return
  emit('confirm', props.selectedCode)
}

watch(() => props.open, async (open) => {
  await nextTick()
  if (!dialog.value) return
  if (open && !dialog.value.open) dialog.value.showModal()
  if (!open && dialog.value.open) dialog.value.close()
})

onMounted(() => {
  if (props.open) dialog.value?.showModal()
})
</script>

<template>
  <dialog ref="dialog" class="assignment-dialog" aria-labelledby="assignment-dialog-title" @close="emit('close')" @click.self="requestClose">
    <header class="assignment-dialog-head">
      <div>
        <p class="assignment-dialog-kicker">批量操作预览</p>
        <h2 id="assignment-dialog-title">确认学期选课分配</h2>
      </div>
      <button type="button" class="assignment-close" aria-label="关闭预览" :disabled="saving" @click="requestClose">×</button>
    </header>

    <div class="assignment-dialog-body">
      <p class="assignment-scope">将对当前学期、当前行政班中选中的 <strong>{{ students.length }}</strong> 名学生执行分配。</p>
      <label class="assignment-field">
        <span>修读组合 <b aria-hidden="true">*</b></span>
        <select :value="selectedCode" required :disabled="saving" @change="emit('updateCode', ($event.target as HTMLSelectElement).value)">
          <option value="" disabled>请选择组合</option>
          <option v-for="item in combinations" :key="item.code" :value="item.code">{{ item.label }}</option>
        </select>
        <small v-if="combination">科目：{{ combination.subjects.join('、') }}</small>
      </label>

      <div class="assignment-counts" aria-label="分配预览统计">
        <p><strong>{{ changedStudents.length }}</strong><span>将新增或调整</span></p>
        <p><strong>{{ unchangedCount }}</strong><span>组合不变</span></p>
      </div>

      <div v-if="changedStudents.length" class="assignment-preview-list">
        <p class="assignment-list-label">变更名单预览</p>
        <ul>
          <li v-for="student in changedStudents.slice(0, 6)" :key="student.id">
            <span>{{ student.name }}</span>
            <small>{{ student.selectionCode ? student.selectionCode.replaceAll('-', ' · ') : '待确认选课' }} → {{ selectedCode.replaceAll('-', ' · ') }}</small>
          </li>
        </ul>
        <p v-if="changedStudents.length > 6" class="assignment-list-more">另有 {{ changedStudents.length - 6 }} 名学生，保存后统一更新。</p>
      </div>

      <p v-if="error" class="assignment-error" role="alert">{{ error }}</p>
      <p class="assignment-note">该演示操作会更新本浏览器中的示例名单；正式环境需由后端完成全批校验与事务提交。</p>
    </div>

    <footer class="assignment-dialog-actions">
      <button type="button" class="assignment-secondary" :disabled="saving" @click="requestClose">返回名单</button>
      <button type="button" class="assignment-primary" :disabled="saving || changedStudents.length === 0" @click="confirm">
        {{ saving ? '保存中…' : '确认分配 ' + changedStudents.length + ' 人' }}
      </button>
    </footer>
  </dialog>
</template>

<style scoped>
.assignment-dialog {
  color: var(--tw-ink);
  background: var(--tw-paper);
  width: min(560px, calc(100vw - 32px));
  max-height: min(760px, calc(100dvh - 36px));
  padding: 0;
  border: 1px solid var(--tw-border-strong);
  border-radius: 10px;
  overflow: auto;
}

.assignment-dialog::backdrop {
  background: rgb(15 23 42 / 48%);
}

.assignment-dialog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 22px 16px;
  border-bottom: 1px solid var(--tw-border);
}

.assignment-dialog-kicker {
  color: var(--tw-primary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .1em;
  margin: 0 0 5px;
}

.assignment-dialog-head h2 {
  color: var(--tw-ink);
  font-size: 19px;
  margin: 0;
}

.assignment-close {
  color: var(--tw-muted);
  width: 38px;
  height: 38px;
  background: transparent;
  border: 1px solid var(--tw-border);
  border-radius: 6px;
  font-size: 23px;
  line-height: 1;
  cursor: pointer;
}

.assignment-close:hover:not(:disabled) {
  color: var(--tw-ink);
  background: #f8fafc;
}

.assignment-close:focus-visible,
.assignment-dialog button:focus-visible,
.assignment-dialog select:focus-visible {
  outline: 3px solid #0f766e55;
  outline-offset: 2px;
}

.assignment-dialog-body {
  padding: 18px 22px 20px;
}

.assignment-scope {
  color: var(--tw-secondary);
  font-size: 13px;
  line-height: 1.6;
  margin: 0 0 18px;
}

.assignment-scope strong {
  color: var(--tw-primary-dark);
  font-variant-numeric: tabular-nums;
}

.assignment-field {
  display: grid;
  gap: 7px;
}

.assignment-field > span {
  color: var(--tw-secondary);
  font-size: 12px;
  font-weight: 600;
}

.assignment-field b {
  color: var(--tw-danger);
}

.assignment-field select {
  min-height: 42px;
  color: var(--tw-ink);
  background: var(--tw-paper);
  border: 1px solid var(--tw-border-strong);
  border-radius: 6px;
  padding: 8px 10px;
  font: inherit;
  font-size: 13px;
}

.assignment-field select:focus-visible {
  border-color: var(--tw-primary);
}

.assignment-field small {
  color: var(--tw-muted);
  font-size: 12px;
  line-height: 1.5;
}

.assignment-counts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 18px 0;
}

.assignment-counts p {
  border-left: 2px solid var(--tw-primary);
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 5px 0 5px 10px;
}

.assignment-counts p + p {
  border-left-color: var(--tw-border-strong);
}

.assignment-counts strong {
  color: var(--tw-ink);
  font-size: 22px;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.assignment-counts span {
  color: var(--tw-muted);
  font-size: 11px;
}

.assignment-preview-list {
  padding-top: 14px;
  border-top: 1px solid var(--tw-border);
}

.assignment-list-label {
  color: var(--tw-secondary);
  font-size: 12px;
  font-weight: 600;
  margin: 0 0 6px;
}

.assignment-preview-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.assignment-preview-list li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 0;
  border-bottom: 1px solid #edf1f4;
  font-size: 12px;
}

.assignment-preview-list li span {
  color: var(--tw-ink);
  font-weight: 600;
}

.assignment-preview-list li small {
  color: var(--tw-muted);
  text-align: right;
}

.assignment-list-more {
  color: var(--tw-muted);
  font-size: 11px;
  margin: 8px 0 0;
}

.assignment-error {
  color: var(--tw-danger);
  background: var(--tw-danger-soft);
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 9px 11px;
  font-size: 12px;
  margin: 14px 0 0;
}

.assignment-note {
  color: var(--tw-muted);
  font-size: 11px;
  line-height: 1.5;
  margin: 16px 0 0;
}

.assignment-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 13px 22px 18px;
  border-top: 1px solid var(--tw-border);
}

.assignment-dialog-actions button {
  min-height: 40px;
  border-radius: 6px;
  padding: 8px 14px;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.assignment-secondary {
  color: var(--tw-secondary);
  background: #fff;
  border: 1px solid var(--tw-border-strong);
}

.assignment-primary {
  color: #fff;
  background: var(--tw-primary);
  border: 1px solid var(--tw-primary);
}

.assignment-secondary:hover:not(:disabled) {
  background: #f8fafc;
}

.assignment-primary:hover:not(:disabled) {
  background: var(--tw-primary-dark);
}

.assignment-dialog-actions button:disabled,
.assignment-close:disabled {
  opacity: .55;
  cursor: not-allowed;
}

@media (max-width: 520px) {
  .assignment-dialog-head {
    padding: 17px 16px 14px;
  }

  .assignment-dialog-body {
    padding: 16px;
  }

  .assignment-dialog-actions {
    flex-direction: column-reverse;
    padding: 12px 16px 16px;
  }

  .assignment-dialog-actions button {
    width: 100%;
    min-height: 44px;
  }

  .assignment-preview-list li {
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
  }

  .assignment-preview-list li small {
    text-align: left;
  }
}
</style>
