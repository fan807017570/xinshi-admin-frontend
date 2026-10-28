<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import type { DemoJobItem } from '../../api/teachingDemo'

const props = defineProps<{
  open: boolean
  item: DemoJobItem | null
}>()

const emit = defineEmits<{
  close: []
}>()

const dialog = ref<HTMLDialogElement | null>(null)

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: '待处理',
    CHECKING: '校验中',
    BLOCKED: '资料待补',
    GENERATING: '演示处理中',
    SUCCEEDED: '演示完成',
    FAILED: '技术失败',
    CANCELED: '已取消'
  }
  return labels[status] ?? status
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
  <dialog ref="dialog" class="report-detail-dialog" aria-labelledby="report-detail-title" @close="emit('close')" @click.self="dialog?.close()">
    <header class="report-detail-head">
      <div>
        <p>学生任务详情</p>
        <h2 id="report-detail-title">{{ item?.name ?? '任务条目' }}</h2>
      </div>
      <button type="button" class="report-detail-close" aria-label="关闭学生详情" @click="dialog?.close()">×</button>
    </header>

    <div v-if="item" class="report-detail-body">
      <dl class="report-detail-meta">
        <div><dt>学号</dt><dd>{{ item.studentNo }}</dd></div>
        <div><dt>任务状态</dt><dd>{{ statusLabel(item.status) }}</dd></div>
        <div><dt>成绩</dt><dd>{{ item.scoreCount === null ? '待确认选课' : item.scoreCount + '/' + item.subjectCount + ' 科' }}</dd></div>
        <div><dt>等级规则</dt><dd>{{ item.ruleReady ? '已配置' : '待配置' }}</dd></div>
        <div><dt>评语</dt><dd>{{ item.commentState }}（可选）</dd></div>
        <div><dt>最近更新</dt><dd>{{ item.lastUpdated }}</dd></div>
      </dl>

      <section v-if="item.issues.length" class="report-detail-issues" aria-labelledby="report-issues-title">
        <h3 id="report-issues-title">当前问题</h3>
        <ul><li v-for="issue in item.issues" :key="issue">{{ issue }}</li></ul>
      </section>
      <section class="report-attempts" aria-labelledby="report-attempts-title">
        <h3 id="report-attempts-title">处理与恢复记录 <span>{{ item.attempts.length }}</span></h3>
        <ol v-if="item.attempts.length">
          <li v-for="(attempt, index) in item.attempts" :key="attempt.time + attempt.action + index">
            <div><strong>{{ attempt.action }}</strong><time>{{ attempt.time }}</time></div>
            <p><b>{{ attempt.outcome }}</b> · {{ attempt.detail }}</p>
          </li>
        </ol>
        <p v-else class="report-attempt-empty">该学生尚未进入校验队列。</p>
      </section>

      <p class="report-detail-notice">上述记录只保存在本浏览器演示数据中，不代表后端任务日志或文件状态。</p>
    </div>
  </dialog>
</template>

<style scoped>
.report-detail-dialog {
  width: min(600px, calc(100vw - 30px));
  max-height: min(760px, calc(100dvh - 30px));
  color: var(--tw-ink);
  background: var(--tw-paper);
  border: 1px solid var(--tw-border-strong);
  border-radius: 10px;
  padding: 0;
  overflow: auto;
}

.report-detail-dialog::backdrop {
  background: rgb(15 23 42 / 48%);
}

.report-detail-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px 15px;
  border-bottom: 1px solid var(--tw-border);
}

.report-detail-head p {
  color: var(--tw-primary);
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 700;
}

.report-detail-head h2 {
  margin: 0;
  font-size: 19px;
}

.report-detail-close {
  width: 38px;
  height: 38px;
  color: var(--tw-muted);
  background: #fff;
  border: 1px solid var(--tw-border);
  border-radius: 6px;
  font-size: 22px;
  cursor: pointer;
}

.report-detail-close:focus-visible {
  outline: 3px solid #0f766e55;
  outline-offset: 2px;
}

.report-detail-body {
  padding: 17px 20px 20px;
}

.report-detail-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 11px 18px;
  padding: 0 0 16px;
  margin: 0;
  border-bottom: 1px solid var(--tw-border);
}

.report-detail-meta > div {
  min-width: 0;
}

.report-detail-meta dt {
  color: var(--tw-muted);
  font-size: 11px;
  margin-bottom: 3px;
}

.report-detail-meta dd {
  color: var(--tw-secondary);
  font-size: 12px;
  font-weight: 600;
  margin: 0;
  overflow-wrap: anywhere;
}

.report-detail-issues,
.report-attempts {
  margin-top: 16px;
}

.report-detail-issues h3,
.report-attempts h3 {
  color: var(--tw-ink);
  font-size: 13px;
  margin: 0 0 9px;
}

.report-detail-issues ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding-left: 18px;
  color: var(--tw-danger);
  font-size: 12px;
  line-height: 1.5;
}

.report-attempts h3 span {
  color: var(--tw-muted);
  font-size: 11px;
  font-weight: 500;
  margin-left: 4px;
}

.report-attempts ol {
  list-style: none;
  padding: 0;
  margin: 0;
  border-top: 1px solid var(--tw-border);
}

.report-attempts li {
  padding: 11px 0;
  border-bottom: 1px solid var(--tw-border);
}

.report-attempts li > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.report-attempts li strong {
  color: var(--tw-secondary);
  font-size: 12px;
}

.report-attempts time {
  color: var(--tw-faint);
  font-size: 10px;
  flex: 0 0 auto;
}

.report-attempts li p {
  color: var(--tw-muted);
  margin: 5px 0 0;
  font-size: 11px;
  line-height: 1.55;
}

.report-attempts li p b {
  color: var(--tw-primary-dark);
}

.report-attempt-empty {
  color: var(--tw-muted);
  background: #f8fafc;
  padding: 11px;
  font-size: 12px;
  margin: 0;
}

.report-detail-notice {
  color: var(--tw-muted);
  font-size: 10px;
  line-height: 1.5;
  border-top: 1px solid var(--tw-border);
  padding-top: 12px;
  margin: 17px 0 0;
}

@media (max-width: 520px) {
  .report-detail-head,
  .report-detail-body {
    padding-inline: 15px;
  }

  .report-detail-meta {
    grid-template-columns: 1fr 1fr;
    gap: 10px 12px;
  }
}
</style>
