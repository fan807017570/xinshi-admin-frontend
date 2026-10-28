<script setup lang="ts">
import { computed } from 'vue'
import type { DemoJobItem } from '../../api/teachingDemo'

const props = defineProps<{
  items: DemoJobItem[]
  page: number
  pageSize: number
  busy: boolean
}>()

const emit = defineEmits<{
  setPage: [page: number]
  openDetails: [item: DemoJobItem]
  repair: [itemId: string]
  retry: [itemId: string]
}>()

const pageCount = computed(() => Math.max(1, Math.ceil(props.items.length / props.pageSize)))
const pageItems = computed(() => props.items.slice((props.page - 1) * props.pageSize, props.page * props.pageSize))
const start = computed(() => props.items.length ? (props.page - 1) * props.pageSize + 1 : 0)
const end = computed(() => Math.min(props.page * props.pageSize, props.items.length))

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

function statusClass(status: string) {
  if (status === 'SUCCEEDED') return 'is-success'
  if (status === 'BLOCKED' || status === 'FAILED') return 'is-problem'
  if (status === 'CHECKING' || status === 'GENERATING') return 'is-running'
  if (status === 'CANCELED') return 'is-canceled'
  return 'is-pending'
}

function scoreText(item: DemoJobItem) {
  if (!item.selectionReady) return '待确认选课'
  return String(item.scoreCount) + '/' + String(item.subjectCount) + ' 科'
}
</script>

<template>
  <section class="report-roster" aria-label="学生生成任务明细">
    <div class="report-table-scroll">
      <table class="report-table">
        <caption class="visually-hidden">固定参评名单中每位学生的资料校验、任务状态与恢复操作</caption>
        <thead>
          <tr>
            <th>学生</th>
            <th>成绩完成</th>
            <th>等级规则</th>
            <th>评语</th>
            <th>未完成原因 / 最近状态</th>
            <th>任务状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody v-if="pageItems.length">
          <tr v-for="item in pageItems" :key="item.id">
            <td>
              <strong class="report-student-name">{{ item.name }}</strong>
              <small class="report-student-no">{{ item.studentNo }}</small>
            </td>
            <td><span class="report-data-value">{{ scoreText(item) }}</span></td>
            <td>{{ item.selectionReady ? (item.ruleReady ? '可用' : '待配置') : '—' }}</td>
            <td>{{ item.commentState }}<small class="report-optional"> · 可选</small></td>
            <td class="report-issue-cell">{{ item.issues.length ? item.issues.join('；') : '—' }}</td>
            <td>
              <span class="report-status" :class="statusClass(item.status)">
                <span class="report-status-mark" aria-hidden="true"></span>{{ statusLabel(item.status) }}
              </span>
            </td>
            <td>
              <div class="report-row-actions">
                <button type="button" class="report-action-link" @click="emit('openDetails', item)">详情</button>
                <button
                  v-if="item.status === 'BLOCKED'"
                  type="button"
                  class="report-action-recovery"
                  :disabled="busy"
                  @click="emit('repair', item.id)"
                >演示补齐并重验</button>
                <button
                  v-else-if="item.status === 'FAILED'"
                  type="button"
                  class="report-action-recovery"
                  :disabled="busy"
                  @click="emit('retry', item.id)"
                >仅重试该学生</button>
              </div>
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td colspan="7" class="report-empty">没有符合当前状态与姓名筛选的学生。</td></tr>
        </tbody>
      </table>
    </div>

    <footer class="report-table-footer">
      <span>显示 {{ start }}–{{ end }} 条，共 {{ items.length }} 人</span>
      <div>
        <button type="button" :disabled="page <= 1" @click="emit('setPage', page - 1)">上一页</button>
        <span>第 {{ page }} / {{ pageCount }} 页</span>
        <button type="button" :disabled="page >= pageCount" @click="emit('setPage', page + 1)">下一页</button>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.report-roster {
  min-width: 0;
  background: #fff;
}

.report-table-scroll {
  width: 100%;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
}

.report-table {
  width: 100%;
  min-width: 930px;
  border-collapse: collapse;
  font-size: 12px;
}

.report-table th,
.report-table td {
  padding: 11px 12px;
  text-align: left;
  border-bottom: 1px solid #edf1f4;
  vertical-align: middle;
}

.report-table th {
  color: var(--tw-muted);
  background: #f7f9fa;
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}

.report-table tbody tr:last-child td {
  border-bottom: 0;
}

.report-table tbody tr:hover {
  background: #fafcfc;
}

.report-student-name,
.report-student-no {
  display: block;
}

.report-student-name {
  color: var(--tw-ink);
  font-size: 12px;
  margin-bottom: 3px;
}

.report-student-no {
  color: var(--tw-faint);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.report-data-value {
  color: var(--tw-secondary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.report-optional {
  color: var(--tw-faint);
  font-size: 10px;
  white-space: nowrap;
}

.report-issue-cell {
  color: var(--tw-danger);
  max-width: 230px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.report-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  padding: 4px 7px;
  border: 1px solid currentColor;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}

.report-status-mark {
  width: 6px;
  height: 6px;
  background: currentColor;
  border-radius: 50%;
}

.report-status.is-success {
  color: var(--tw-success);
  background: var(--tw-success-soft);
}

.report-status.is-problem {
  color: var(--tw-danger);
  background: var(--tw-danger-soft);
}

.report-status.is-running {
  color: var(--tw-info);
  background: var(--tw-info-soft);
}

.report-status.is-canceled {
  color: var(--tw-muted);
  background: #f1f5f9;
}

.report-status.is-pending {
  color: var(--tw-warning);
  background: var(--tw-warning-soft);
}

.report-row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.report-action-link,
.report-action-recovery {
  min-height: 32px;
  color: var(--tw-primary-dark);
  background: transparent;
  border: 0;
  padding: 4px;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.report-action-link:hover,
.report-action-recovery:hover:not(:disabled) {
  text-decoration: underline;
}

.report-action-recovery {
  color: var(--tw-danger);
}

.report-action-recovery:disabled {
  color: var(--tw-faint);
  cursor: not-allowed;
}

.report-row-actions button:focus-visible,
.report-table-footer button:focus-visible {
  outline: 3px solid #0f766e55;
  outline-offset: 2px;
}

.report-empty {
  color: var(--tw-muted);
  text-align: center !important;
  padding: 42px 18px !important;
}

.report-table-footer {
  border-top: 1px solid var(--tw-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  min-height: 52px;
  padding: 9px 13px;
}

.report-table-footer > span,
.report-table-footer div span {
  color: var(--tw-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.report-table-footer div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.report-table-footer button {
  min-height: 34px;
  color: var(--tw-secondary);
  background: #fff;
  border: 1px solid var(--tw-border-strong);
  border-radius: 6px;
  padding: 5px 10px;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.report-table-footer button:hover:not(:disabled) {
  border-color: var(--tw-primary);
  color: var(--tw-primary-dark);
}

.report-table-footer button:disabled {
  color: var(--tw-faint);
  background: #f8fafc;
  cursor: not-allowed;
}

@media (max-width: 760px) {
  .report-table-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .report-table-footer button {
    min-height: 40px;
  }
}
</style>
