<script setup lang="ts">
import { computed, onMounted, provide, ref } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { errorMessage, type TeachingMetadata } from '../../api/teaching';
import { TeachingKey, loadMetadata } from './useTeaching';
import './teaching.css';
const route = useRoute(), router = useRouter(), metadata = ref<TeachingMetadata | null>(null), loading = ref(false), error = ref('');
async function refresh() {
    loading.value = true;
    error.value = '';
    try {
        metadata.value = await loadMetadata();
        if (!metadata.value.classes.some(c => c.canManage) && route.path.endsWith('/course-selection'))
            await router.replace({ path: '/teaching/assessments', query: route.query });
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        loading.value = false;
    }
}
provide(TeachingKey, { metadata, refresh });
onMounted(refresh);
const tabs = computed(() => [...(metadata.value?.classes.some(c => c.canManage) ? [{ path: 'course-selection', label: '学期选课' }] : []), { path: 'assessments', label: '考试与等级' }, ...(metadata.value?.classes.some(c => c.canManage) ? [{ path: 'report-jobs', label: '班级报告' }] : []), { path: 'comments', label: '评语与关注' }, { path: 'research', label: '老师教研' }, ...(metadata.value?.admin ? [{ path: 'teachers', label: '教师交接' }] : [])]);
const currentLabel = computed(() => tabs.value.find(tab => route.path.includes(tab.path))?.label || '教学管理');
</script>
<template>
 <div class="teaching-workspace">
  <nav class="teaching-breadcrumb" aria-label="面包屑"><RouterLink to="/dashboard">工作台</RouterLink><span aria-hidden="true">/</span><span>教学管理与教研</span><span aria-hidden="true">/</span><span aria-current="page">{{currentLabel}}</span></nav>
  <header class="teaching-heading"><div><p class="teaching-eyebrow">教学管理 · 教研协作</p><h1>班级教学工作台</h1><p class="teaching-intro">按学期组织选课，以固定考试版本记录成果，让教学过程有据可循。</p></div><span class="teaching-scope-mark">{{currentLabel}}</span></header>
  <div v-if="error" class="tw-alert is-error" role="alert">{{error}} <button type="button" @click="refresh">重新加载</button></div>
  <div v-else-if="loading&&!metadata" class="tw-loading" aria-busy="true">正在读取学校教学数据…</div>
  <div v-else-if="metadata&&!metadata.schemaReady" class="tw-empty"><h2>教学模块等待初始化</h2><p>数据库迁移尚未完成，请联系管理员完成部署后重新加载。</p><button class="tw-button" type="button" @click="refresh">重新检查</button></div>
  <template v-else-if="metadata"><nav class="teaching-tabs" aria-label="教学管理模块"><RouterLink v-for="(tab,index) in tabs" :key="tab.path" :to="{path:'/teaching/'+tab.path,query:route.query}" :class="{'is-active':route.path.includes(tab.path)}"><span class="teaching-tab-index">{{String(index+1).padStart(2,'0')}}</span><span>{{tab.label}}</span></RouterLink></nav><div v-if="!metadata.classes.length&&!route.path.includes('research')" class="tw-empty">当前账号没有可访问的行政班，请联系管理员分配教学关系。</div><RouterView v-else/></template>
 </div>
</template>
<style scoped>
.teaching-workspace {
  --tw-canvas: #f8fafc;
  --tw-paper: #fff;
  --tw-inset: #f1f5f6;
  --tw-ink: #0f172a;
  --tw-secondary: #334155;
  --tw-muted: #64748b;
  --tw-faint: #94a3b8;
  --tw-primary: #0f766e;
  --tw-primary-dark: #115e59;
  --tw-primary-soft: #e8f4f2;
  --tw-border: #e2e8f0;
  --tw-border-strong: #cbd5e1;
  --tw-success: #166534;
  --tw-success-soft: #f0fdf4;
  --tw-warning: #92400e;
  --tw-warning-soft: #fffbeb;
  --tw-danger: #b91c1c;
  --tw-danger-soft: #fef2f2;
  --tw-info: #1d4ed8;
  --tw-info-soft: #eff6ff;
  color: var(--tw-ink);
  min-width: 0;
  font-family: "PingFang SC", "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif;
}

:global(.app-shell--teaching .main) {
  min-width: 0;
}

.teaching-breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--tw-muted);
  font-size: 12px;
  margin: 4px 0 14px;
}

.teaching-breadcrumb [aria-current="page"] {
  color: var(--tw-secondary);
  font-weight: 600;
}

.teaching-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  margin-bottom: 22px;
}

.teaching-eyebrow {
  color: var(--tw-primary);
  font-size: 11px;
  letter-spacing: .12em;
  font-weight: 700;
  margin: 0 0 6px;
}

.teaching-heading h1 {
  color: var(--tw-ink);
  font-size: 25px;
  line-height: 1.25;
  letter-spacing: -.025em;
  margin: 0;
  font-weight: 700;
}

.teaching-intro {
  color: var(--tw-muted);
  margin: 7px 0 0;
  font-size: 14px;
  line-height: 1.55;
  max-width: 700px;
}

.teaching-scope-mark {
  border-left: 2px solid var(--tw-primary);
  padding: 4px 0 4px 10px;
  color: var(--tw-secondary);
  font-size: 12px;
  font-weight: 600;
  flex: 0 0 auto;
}

.teaching-demo-note {
  border: 1px solid #c5ded9;
  border-left: 3px solid var(--tw-primary);
  background: #f2f8f7;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 13px;
  margin-bottom: 18px;
}

.teaching-demo-mark {
  width: 18px;
  height: 18px;
  border: 1px solid #76a9a2;
  color: var(--tw-primary-dark);
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 700;
  flex: 0 0 auto;
  margin-top: 1px;
}

.teaching-demo-note p {
  display: grid;
  gap: 2px;
  margin: 0;
  color: var(--tw-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.teaching-demo-note strong {
  color: var(--tw-primary-dark);
  font-size: 12px;
}

.teaching-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  border-bottom: 1px solid var(--tw-border);
  margin-bottom: 18px;
}

.teaching-tabs a {
  color: var(--tw-muted);
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  text-decoration: none;
  border-bottom: 2px solid transparent;
  padding: 0 12px;
  margin-bottom: -1px;
  font-size: 13px;
  font-weight: 600;
  transition: color .16s ease, border-color .16s ease, background .16s ease;
}

.teaching-tabs a:hover {
  color: var(--tw-ink);
  background: #f1f5f6;
}

.teaching-tabs a:focus-visible {
  outline: 3px solid #0f766e55;
  outline-offset: 2px;
}

.teaching-tabs a.is-active {
  color: var(--tw-primary-dark);
  border-bottom-color: var(--tw-primary);
}

.teaching-tab-index {
  color: var(--tw-faint);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  letter-spacing: .06em;
}

.teaching-tabs a.is-active .teaching-tab-index {
  color: var(--tw-primary);
}

@media (max-width: 760px) {
  :global(.app-shell--teaching) {
    grid-template-columns: minmax(0, 1fr) !important;
  }

  :global(.app-shell--teaching .sidebar) {
    width: 100%;
    min-width: 0;
    height: auto;
    padding: 10px 12px 8px;
  }

  :global(.app-shell--teaching .brand) {
    gap: 9px;
    margin-bottom: 8px;
  }

  :global(.app-shell--teaching .sidebar-logo) {
    width: 38px;
    height: 38px;
  }

  :global(.app-shell--teaching .nav) {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    scrollbar-width: thin;
  }

  :global(.app-shell--teaching .nav a) {
    flex: 0 0 auto;
    min-height: 40px;
    padding: 8px 10px;
    white-space: nowrap;
    font-size: 12px;
  }

  :global(.app-shell--teaching .sidebar-resize-handle) {
    display: none;
  }

  :global(.app-shell--teaching .main) {
    width: 100%;
    min-width: 0;
    padding: 12px;
  }

  .teaching-breadcrumb {
    margin-top: 0;
  }

  .teaching-heading {
    display: block;
    margin-bottom: 16px;
  }

  .teaching-heading h1 {
    font-size: 22px;
  }

  .teaching-scope-mark {
    display: inline-block;
    margin-top: 12px;
  }

  .teaching-demo-note {
    padding: 10px;
    margin-bottom: 14px;
  }

  .teaching-tabs {
    width: 100%;
    gap: 0;
    overflow-x: auto;
    scrollbar-width: thin;
  }

  .teaching-tabs a {
    white-space: nowrap;
    min-height: 46px;
    padding: 0 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .teaching-tabs a {
    transition: none;
  }
}
</style>
