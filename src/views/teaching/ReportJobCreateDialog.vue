<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  className: string
  termLabel: string
  examName: string
  targetCount: number
  readyCount: number
  creating: boolean
  error: string
}>()

const emit = defineEmits<{
  close: []
  confirm: []
}>()

const dialog = ref<HTMLDialogElement | null>(null)

function requestClose() {
  if (props.creating) return
  if (dialog.value?.open) dialog.value.close()
  else emit('close')
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
  <dialog ref="dialog" class="report-create-dialog" aria-labelledby="create-job-title" @close="emit('close')" @click.self="requestClose">
    <header class="report-create-head">
      <div>
        <p>固定目标名单</p>
        <h2 id="create-job-title">创建班级生成任务</h2>
      </div>
      <button type="button" class="report-create-close" aria-label="关闭创建确认" :disabled="creating" @click="requestClose">×</button>
    </header>
    <div class="report-create-body">
      <dl class="report-create-scope">
        <div><dt>学期</dt><dd>{{ termLabel }}</dd></div>
        <div><dt>行政班</dt><dd>{{ className }}</dd></div>
        <div><dt>考试</dt><dd>{{ examName }}</dd></div>
      </dl>
      <div class="report-create-count">
        <span><strong>{{ targetCount }}</strong>名目标学生</span>
        <span><strong>{{ readyCount }}</strong>名资料完整</span>
        <span><strong>{{ targetCount - readyCount }}</strong>名待补齐</span>
      </div>
      <p class="report-create-note">名单在创建时固定。本次为浏览器本地演示任务，刷新可保留状态；页面关闭时不会有后台执行器继续处理，也不会生成真实 PDF。</p>
      <p v-if="error" class="report-create-error" role="alert">{{ error }}</p>
    </div>
    <footer class="report-create-actions">
      <button type="button" class="report-create-secondary" :disabled="creating" @click="requestClose">返回预检</button>
      <button type="button" class="report-create-primary" :disabled="creating || targetCount === 0" @click="emit('confirm')">
        {{ creating ? '创建中…' : '确认创建演示任务' }}
      </button>
    </footer>
  </dialog>
</template>

<style scoped>
.report-create-dialog {
  width: min(520px, calc(100vw - 32px));
  max-height: min(720px, calc(100dvh - 32px));
  color: var(--tw-ink);
  background: var(--tw-paper);
  border: 1px solid var(--tw-border-strong);
  border-radius: 10px;
  padding: 0;
  overflow: auto;
}

.report-create-dialog::backdrop {
  background: rgb(15 23 42 / 48%);
}

.report-create-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 19px 21px 16px;
  border-bottom: 1px solid var(--tw-border);
}

.report-create-head p {
  color: var(--tw-primary);
  margin: 0 0 5px;
  font-size: 11px;
  font-weight: 700;
}

.report-create-head h2 {
  color: var(--tw-ink);
  font-size: 19px;
  margin: 0;
}

.report-create-close {
  width: 38px;
  height: 38px;
  color: var(--tw-muted);
  background: #fff;
  border: 1px solid var(--tw-border);
  border-radius: 6px;
  font-size: 22px;
  cursor: pointer;
}

.report-create-body {
  padding: 18px 21px 20px;
}

.report-create-scope {
  display: grid;
  gap: 12px;
  margin: 0;
}

.report-create-scope > div {
  display: grid;
  grid-template-columns: 58px 1fr;
  gap: 8px;
}

.report-create-scope dt {
  color: var(--tw-muted);
  font-size: 12px;
}

.report-create-scope dd {
  color: var(--tw-secondary);
  margin: 0;
  font-size: 12px;
  font-weight: 600;
}

.report-create-count {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  border-block: 1px solid var(--tw-border);
  padding: 13px 0;
  margin: 17px 0;
}

.report-create-count span {
  color: var(--tw-muted);
  font-size: 11px;
}

.report-create-count strong {
  color: var(--tw-ink);
  font-size: 18px;
  margin-right: 4px;
  font-variant-numeric: tabular-nums;
}

.report-create-note {
  color: var(--tw-muted);
  background: #f7f9fa;
  padding: 10px 11px;
  margin: 0;
  font-size: 11px;
  line-height: 1.6;
}

.report-create-error {
  color: var(--tw-danger);
  background: var(--tw-danger-soft);
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 9px 11px;
  margin: 12px 0 0;
  font-size: 12px;
}

.report-create-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid var(--tw-border);
  padding: 13px 21px 18px;
}

.report-create-actions button {
  min-height: 40px;
  border-radius: 6px;
  padding: 8px 12px;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.report-create-secondary {
  color: var(--tw-secondary);
  background: #fff;
  border: 1px solid var(--tw-border-strong);
}

.report-create-primary {
  color: #fff;
  background: var(--tw-primary);
  border: 1px solid var(--tw-primary);
}

.report-create-close:focus-visible,
.report-create-actions button:focus-visible {
  outline: 3px solid #0f766e55;
  outline-offset: 2px;
}

.report-create-actions button:disabled,
.report-create-close:disabled {
  opacity: .55;
  cursor: not-allowed;
}

@media (max-width: 520px) {
  .report-create-head,
  .report-create-body {
    padding-inline: 16px;
  }

  .report-create-actions {
    flex-direction: column-reverse;
    padding-inline: 16px;
  }

  .report-create-actions button {
    width: 100%;
    min-height: 44px;
  }
}
</style>
