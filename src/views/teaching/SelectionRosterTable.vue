<script setup lang="ts">
import { computed } from 'vue'
import type { SelectionStudent } from '../../api/teachingDemo'

const props = defineProps<{
  rows: SelectionStudent[]
  selectedIds: string[]
  page: number
  pageSize: number
  sortDirection: 'asc' | 'desc'
}>()

const emit = defineEmits<{
  toggleStudent: [studentId: string]
  togglePage: []
  setPage: [page: number]
  toggleSort: []
}>()

const pageCount = computed(() => Math.max(1, Math.ceil(props.rows.length / props.pageSize)))
const pageRows = computed(() => {
  const start = (props.page - 1) * props.pageSize
  return props.rows.slice(start, start + props.pageSize)
})
const selectedOnPage = computed(() => pageRows.value.filter((row) => props.selectedIds.includes(row.id)).length)
const allOnPageSelected = computed(() => pageRows.value.length > 0 && selectedOnPage.value === pageRows.value.length)
const startRow = computed(() => props.rows.length === 0 ? 0 : (props.page - 1) * props.pageSize + 1)
const endRow = computed(() => Math.min(props.page * props.pageSize, props.rows.length))

function combinationName(code: string | null) {
  if (!code) return '待确认选课'
  return code.replaceAll('-', ' · ')
}
</script>

<template>
  <section class="selection-roster" aria-label="学生选课名单">
    <div class="selection-table-scroll">
      <table class="selection-table">
        <caption class="visually-hidden">当前学期与行政班的学生选课状态</caption>
        <thead>
          <tr>
            <th class="selection-check-col">
              <input
                type="checkbox"
                :checked="allOnPageSelected"
                :indeterminate="selectedOnPage > 0 && !allOnPageSelected"
                :aria-label="allOnPageSelected ? '取消选择本页学生' : '选择本页学生'"
                @change="emit('togglePage')"
              />
            </th>
            <th>学号</th>
            <th><button class="selection-sort" type="button" @click="emit('toggleSort')">学生姓名 <span aria-hidden="true">{{ sortDirection === 'asc' ? '↑' : '↓' }}</span></button></th>
            <th>修读组合</th>
            <th>选课状态</th>
            <th>版本</th>
          </tr>
        </thead>
        <tbody v-if="pageRows.length">
          <tr v-for="row in pageRows" :key="row.id">
            <td class="selection-check-col">
              <input
                type="checkbox"
                :checked="selectedIds.includes(row.id)"
                :aria-label="'选择 ' + row.name + '（' + row.studentNo + '）'"
                @change="emit('toggleStudent', row.id)"
              />
            </td>
            <td class="selection-student-no">{{ row.studentNo }}</td>
            <td class="selection-student-name">{{ row.name }}</td>
            <td>
              <span v-if="row.selectionCode" class="selection-combination">{{ combinationName(row.selectionCode) }}</span>
              <span v-else class="selection-unassigned">待确认</span>
            </td>
            <td>
              <span class="selection-status" :class="row.selectionCode ? 'is-assigned' : 'is-unassigned'">
                <span class="selection-status-dot" aria-hidden="true"></span>
                {{ row.selectionCode ? '已选课' : '未选课' }}
              </span>
            </td>
            <td class="selection-version">{{ row.selectionVersion ? 'V' + row.selectionVersion : '—' }}</td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr><td class="selection-empty" colspan="6">没有符合条件的学生。请调整筛选条件或重置查询。</td></tr>
        </tbody>
      </table>
    </div>

    <footer class="selection-pagination">
      <span class="selection-page-count">显示 {{ startRow }}–{{ endRow }} 条，共 {{ rows.length }} 名学生</span>
      <div class="selection-page-controls" aria-label="名单分页">
        <button type="button" class="selection-page-button" :disabled="page <= 1" @click="emit('setPage', page - 1)">上一页</button>
        <span class="selection-page-number">第 {{ page }} / {{ pageCount }} 页</span>
        <button type="button" class="selection-page-button" :disabled="page >= pageCount" @click="emit('setPage', page + 1)">下一页</button>
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

.selection-roster {
  min-width: 0;
  background: var(--tw-paper);
}

.selection-table-scroll {
  width: 100%;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
}

.selection-table {
  width: 100%;
  min-width: 790px;
  border-collapse: collapse;
  font-size: 13px;
}

.selection-table th,
.selection-table td {
  text-align: left;
  padding: 11px 14px;
  border-bottom: 1px solid #edf1f4;
  vertical-align: middle;
}

.selection-table th {
  height: 42px;
  color: var(--tw-muted);
  background: #f7f9fa;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.selection-table tbody tr:last-child td {
  border-bottom: 0;
}

.selection-table tbody tr:hover {
  background: #fafcfc;
}

.selection-table input[type="checkbox"] {
  accent-color: var(--tw-primary);
  width: 17px;
  height: 17px;
  margin: 0;
  vertical-align: middle;
  cursor: pointer;
}

.selection-check-col {
  width: 44px;
  text-align: center !important;
}

.selection-student-no,
.selection-version {
  color: var(--tw-muted);
  font-variant-numeric: tabular-nums;
}

.selection-student-name {
  color: var(--tw-ink);
  font-weight: 600;
}

.selection-combination {
  color: var(--tw-secondary);
  letter-spacing: .01em;
  white-space: nowrap;
}

.selection-unassigned {
  color: var(--tw-warning);
  font-weight: 600;
}

.selection-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
}

.selection-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.selection-status.is-assigned {
  color: var(--tw-success);
}

.selection-status.is-unassigned {
  color: var(--tw-warning);
}

.selection-sort {
  color: inherit;
  border: 0;
  background: transparent;
  padding: 3px 0;
  font: inherit;
  cursor: pointer;
}

.selection-sort:hover {
  color: var(--tw-ink);
}

.selection-sort:focus-visible,
.selection-table input:focus-visible {
  outline: 3px solid #0f766e55;
  outline-offset: 2px;
}

.selection-empty {
  color: var(--tw-muted);
  text-align: center !important;
  padding: 44px 20px !important;
}

.selection-pagination {
  border-top: 1px solid var(--tw-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  min-height: 54px;
  padding: 9px 14px;
}

.selection-page-count,
.selection-page-number {
  color: var(--tw-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.selection-page-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.selection-page-button {
  min-height: 34px;
  color: var(--tw-secondary);
  background: var(--tw-paper);
  border: 1px solid var(--tw-border-strong);
  border-radius: 6px;
  padding: 5px 10px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.selection-page-button:hover:not(:disabled) {
  color: var(--tw-primary-dark);
  border-color: var(--tw-primary);
}

.selection-page-button:focus-visible {
  outline: 3px solid #0f766e55;
  outline-offset: 2px;
}

.selection-page-button:disabled {
  color: var(--tw-faint);
  background: #f8fafc;
  cursor: not-allowed;
}

@media (max-width: 760px) {
  .selection-pagination {
    align-items: flex-start;
    flex-direction: column;
    padding: 12px;
  }

  .selection-table th,
  .selection-table td {
    padding: 10px 11px;
  }

  .selection-page-button {
    min-height: 40px;
  }
}
</style>
