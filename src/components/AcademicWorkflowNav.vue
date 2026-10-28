<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/auth'

type WorkflowStep = 'students' | 'scores' | 'transcripts'

const props = withDefaults(defineProps<{
  current: WorkflowStep
  context?: Record<string, string | number | null | undefined>
  contextText?: string
}>(), {
  context: () => ({}),
  contextText: ''
})

const auth = useAuthStore()
const steps: Array<{
  key: WorkflowStep
  path: string
  menuKey: string
  index: string
  title: string
  description: string
}> = [
  { key: 'students', path: '/students', menuKey: 'students', index: '01', title: '学生档案', description: '定位学生与班级' },
  { key: 'scores', path: '/scores', menuKey: 'scores', index: '02', title: '成绩记录', description: '录入成绩与评价' },
  { key: 'transcripts', path: '/transcripts', menuKey: 'transcripts', index: '03', title: '成绩单', description: '生成、下载与归档' }
]

const flowQuery = computed(() => Object.fromEntries(
  Object.entries(props.context)
    .filter(([, value]) => value !== '' && value !== null && value !== undefined)
    .map(([key, value]) => [key, String(value)])
))

function canAccess(step: (typeof steps)[number]) {
  if (step.key === props.current) return true
  return (auth.user?.menus ?? []).includes(step.menuKey)
}
</script>

<template>
  <nav class="academic-flow" aria-label="学生成绩工作流">
    <div class="academic-flow__intro">
      <p>教务流程</p>
      <strong>学生 → 成绩 → 成绩单</strong>
    </div>
    <ol class="academic-flow__steps">
      <li
        v-for="step in steps"
        :key="step.key"
        :class="['academic-flow__step', { 'is-current': step.key === current, 'is-disabled': !canAccess(step) }]"
      >
        <RouterLink
          v-if="step.key !== current && canAccess(step)"
          class="academic-flow__step-content"
          :to="{ path: step.path, query: flowQuery }"
        >
          <span class="academic-flow__index">{{ step.index }}</span>
          <span class="academic-flow__copy">
            <strong>{{ step.title }}</strong>
            <small>{{ step.description }}</small>
          </span>
          <svg class="academic-flow__arrow" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </RouterLink>
        <div v-else class="academic-flow__step-content" :aria-current="step.key === current ? 'step' : undefined">
          <span class="academic-flow__index">{{ step.index }}</span>
          <span class="academic-flow__copy">
            <strong>{{ step.title }}</strong>
            <small>{{ step.key === current ? step.description : '当前账号暂无入口权限' }}</small>
          </span>
          <span v-if="step.key === current" class="academic-flow__current">当前</span>
        </div>
      </li>
    </ol>
    <div v-if="contextText" class="academic-flow__context" aria-live="polite">
      <span>当前上下文</span>
      <strong>{{ contextText }}</strong>
    </div>
  </nav>
</template>

<style scoped>
.academic-flow {
  --flow-ink: #0f172a;
  --flow-muted: #64748b;
  --flow-line: #e2e8f0;
  --flow-primary: #0f766e;
  --flow-primary-soft: #ecfdf5;
  align-items: stretch;
  background: rgba(255, 255, 255, .92);
  border: 1px solid var(--flow-line);
  border-radius: 18px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(180px, auto);
  min-width: 0;
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(15, 23, 42, .05);
}

.academic-flow__intro,
.academic-flow__context {
  align-content: center;
  display: grid;
  gap: 4px;
  padding: 14px 18px;
}

.academic-flow__intro {
  background: var(--flow-ink);
  color: #fff;
  min-width: 168px;
}

.academic-flow__intro p,
.academic-flow__context span {
  color: #94a3b8;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .12em;
  margin: 0;
  text-transform: uppercase;
}

.academic-flow__intro strong,
.academic-flow__context strong {
  font-size: 12px;
  line-height: 1.4;
}

.academic-flow__steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  list-style: none;
  margin: 0;
  min-width: 0;
  padding: 0;
}

.academic-flow__step {
  border-right: 1px solid var(--flow-line);
  min-width: 0;
  position: relative;
}

.academic-flow__step.is-current::after {
  background: var(--flow-primary);
  bottom: 0;
  content: "";
  height: 3px;
  left: 12px;
  position: absolute;
  right: 12px;
}

.academic-flow__step-content {
  align-items: center;
  color: inherit;
  display: grid;
  gap: 10px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  min-height: 68px;
  padding: 10px 14px;
  text-decoration: none;
  transition: background-color .16s ease, color .16s ease;
}

a.academic-flow__step-content:hover {
  background: #f8fafc;
}

a.academic-flow__step-content:focus-visible {
  outline: 3px solid rgba(20, 184, 166, .28);
  outline-offset: -3px;
}

.academic-flow__step.is-current .academic-flow__step-content {
  background: var(--flow-primary-soft);
}

.academic-flow__index {
  color: #94a3b8;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
}

.academic-flow__step.is-current .academic-flow__index,
.academic-flow__step.is-current .academic-flow__copy strong {
  color: var(--flow-primary);
}

.academic-flow__copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.academic-flow__copy strong {
  color: var(--flow-ink);
  font-size: 13px;
}

.academic-flow__copy small {
  color: var(--flow-muted);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.academic-flow__arrow {
  fill: none;
  height: 15px;
  stroke: #94a3b8;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
  width: 15px;
}

.academic-flow__current {
  color: var(--flow-primary);
  font-size: 10px;
  font-weight: 800;
}

.academic-flow__step.is-disabled {
  opacity: .52;
}

.academic-flow__context {
  background: #f8fafc;
  min-width: 0;
}

.academic-flow__context strong {
  color: #334155;
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1120px) {
  .academic-flow {
    grid-template-columns: 1fr;
  }

  .academic-flow__intro {
    align-items: center;
    display: flex;
    justify-content: space-between;
    min-width: 0;
  }

  .academic-flow__context {
    border-top: 1px solid var(--flow-line);
  }

  .academic-flow__context strong {
    max-width: none;
  }
}

@media (max-width: 640px) {
  .academic-flow__steps {
    grid-template-columns: 1fr;
  }

  .academic-flow__step {
    border-bottom: 1px solid var(--flow-line);
    border-right: 0;
  }

  .academic-flow__step:last-child {
    border-bottom: 0;
  }

  .academic-flow__step.is-current::after {
    bottom: 10px;
    height: auto;
    left: 0;
    right: auto;
    top: 10px;
    width: 3px;
  }

  .academic-flow__step-content {
    min-height: 58px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .academic-flow__step-content {
    transition-duration: .01ms;
  }
}
</style>
