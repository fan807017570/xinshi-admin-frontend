<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { teachingGet, teachingPost, teachingRequest, requestKey, errorMessage, type Combination, type SelectionStudent, type SelectionPreview } from '../../api/teaching';
import { useTeachingScope } from './useTeaching';
import TeachingScope from './TeachingScope.vue';
import TeachingDialog from './TeachingDialog.vue';
const { metadata, classId, termId, currentClass } = useTeachingScope(true);
const rows = ref<SelectionStudent[]>([]), combinations = ref<Combination[]>([]), selected = ref<string[]>([]);
const loading = ref(false), busy = ref(false), error = ref(''), success = ref(''), keyword = ref(''), status = ref('ALL'), code = ref('ALL'), page = ref(1), descending = ref(false);
const assignment = ref(false), combinationId = ref(''), preview = ref<SelectionPreview | null>(null), previewError = ref(''), previewing = ref(false), operationKey = ref('');
const scopesOpen = ref(false), enabled = ref<string[]>([]), scopeError = ref('');
let loadSequence = 0, previewSequence = 0;
const filtered = computed(() => rows.value.filter(s => (status.value === 'ALL' || (status.value === 'ASSIGNED') === !!s.combinationId) && (code.value === 'ALL' || s.combinationId === code.value) && (!keyword.value || [s.name, s.studentNo].some(value => value.includes(keyword.value.trim())))).sort((a, b) => (descending.value ? -1 : 1) * a.name.localeCompare(b.name, 'zh-CN')));
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / 8))), visible = computed(() => filtered.value.slice((page.value - 1) * 8, page.value * 8)), assigned = computed(() => rows.value.filter(s => s.combinationId).length);
const pageSelected = computed(() => visible.value.length > 0 && visible.value.every(s => selected.value.includes(s.id)));
watch([classId, termId], () => { selected.value = []; page.value = 1; assignment.value = false; void load(); }, { immediate: true });
watch([keyword, status, code], () => page.value = 1);
watch(combinationId, () => {
    preview.value = null;
    if (assignment.value)
        void loadPreview();
});
async function load() {
    if (!classId.value || !termId.value || !currentClass.value)
        return;
    const sequence = ++loadSequence;
    loading.value = true;
    error.value = '';
    try {
        const [roster, combos] = await Promise.all([teachingGet<{
                students: SelectionStudent[];
            }>(`/classes/${classId.value}/selections`, { termId: termId.value }), teachingGet<Combination[]>('/combinations', { termId: termId.value, gradeLevel: currentClass.value.gradeLevel })]);
        if (sequence === loadSequence) {
            rows.value = roster.students;
            combinations.value = combos;
            enabled.value = combos.filter(c => c.enabled).map(c => c.id);
            combinationId.value = combos.find(c => c.enabled)?.id || '';
        }
    }
    catch (e) {
        if (sequence === loadSequence)
            error.value = errorMessage(e);
    }
    finally {
        if (sequence === loadSequence)
            loading.value = false;
    }
}
function toggle(id: string) { selected.value = selected.value.includes(id) ? selected.value.filter(s => s !== id) : [...selected.value, id]; }
function togglePage() { const ids = visible.value.map(s => s.id); selected.value = pageSelected.value ? selected.value.filter(id => !ids.includes(id)) : [...new Set([...selected.value, ...ids])]; }
function payload() { return { termId: termId.value, combinationId: combinationId.value, students: rows.value.filter(s => selected.value.includes(s.id)).map(s => ({ id: s.id, editVersion: s.editVersion })) }; }
async function openAssignment() {
    if (!selected.value.length) {
        error.value = '请先选择需要分配的学生。';
        return;
    }
    assignment.value = true;
    success.value = '';
    await loadPreview();
}
async function loadPreview() {
    if (!combinationId.value) {
        previewError.value = '当前学期年级尚未启用可用组合，请联系管理员配置。';
        return;
    }
    const sequence = ++previewSequence;
    previewing.value = true;
    previewError.value = '';
    try {
        const result = await teachingPost<SelectionPreview>(`/classes/${classId.value}/selection-previews`, payload());
        if (sequence === previewSequence) {
            preview.value = result;
            operationKey.value = requestKey();
        }
    }
    catch (e) {
        if (sequence === previewSequence)
            previewError.value = errorMessage(e);
    }
    finally {
        if (sequence === previewSequence)
            previewing.value = false;
    }
}
async function save() {
    if (!preview.value || preview.value.conflicts)
        return;
    busy.value = true;
    previewError.value = '';
    try {
        const result = await teachingRequest<SelectionPreview>('put', `/classes/${classId.value}/selections`, { ...payload(), requestKey: operationKey.value });
        assignment.value = false;
        selected.value = [];
        success.value = `保存完成：${result.changed} 人新增或调整，${result.unchanged} 人保持不变。`;
        await load();
    }
    catch (e) {
        previewError.value = errorMessage(e);
        preview.value = null;
    }
    finally {
        busy.value = false;
    }
}
function reset() { keyword.value = ''; status.value = 'ALL'; code.value = 'ALL'; page.value = 1; }
async function bootstrap() {
    busy.value = true;
    error.value = '';
    try {
        const result = await teachingPost<{
            message: string;
        }>('/bootstrap');
        success.value = result.message;
        await load();
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
async function saveScopes() {
    busy.value = true;
    scopeError.value = '';
    try {
        await teachingRequest('put', '/combination-scopes', { termId: termId.value, gradeLevel: currentClass.value?.gradeLevel, combinations: enabled.value.map(id => ({ id })) });
        scopesOpen.value = false;
        success.value = '本学期年级的组合启用范围已保存。';
        await load();
    }
    catch (e) {
        scopeError.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
</script>
<template><section>
 <header class="tw-head"><div><h2>学期选课分配</h2><p>行政班保持不变；按学生与学期保存修读组合，考试使用独立的冻结名单。</p></div><div class="tw-actions"><button v-if="metadata?.admin" class="tw-button" @click="scopesOpen=true">组合启用配置</button><button v-if="metadata?.admin&&!combinations.length" class="tw-button" :disabled="busy" @click="bootstrap">建立固定组合字典</button></div></header>
 <TeachingScope manage-only v-model:class-id="classId" v-model:term-id="termId"/>
 <div v-if="error" class="tw-alert is-error" role="alert">{{error}} <button @click="load">重新加载</button></div><div v-if="success" class="tw-alert" role="status">{{success}}</div>
 <div class="tw-metrics"><div><span>班级人数</span><strong>{{rows.length}}</strong><small>当前在班学生</small></div><div><span>已确认选课</span><strong>{{assigned}}</strong><small>学生 × 学期</small></div><div><span>待确认选课</span><strong>{{rows.length-assigned}}</strong><small>不会作为 0 分参与计算</small></div></div>
 <div class="tw-scope"><label>查找学生<input v-model="keyword" placeholder="姓名或学号" type="search"/></label><label>选课状态<select v-model="status"><option value="ALL">全部状态</option><option value="ASSIGNED">已确认</option><option value="UNASSIGNED">待确认</option></select></label><label>修读组合<select v-model="code"><option value="ALL">全部组合</option><option v-for="c in combinations" :key="c.id" :value="c.id">{{c.code}}</option></select></label><button class="tw-button" @click="reset">重置</button></div>
 <div class="tw-head"><p><strong>{{selected.length}}</strong> 名学生已选中 <small class="tw-muted">跨页保留；切换行政班或学期会清空。</small></p><button class="tw-button primary" :disabled="loading||busy" @click="openAssignment">预览批量分配</button></div>
 <div v-if="loading" class="tw-loading" aria-busy="true">正在读取选课名单…</div><div v-else-if="!error" class="tw-table-wrap"><table class="tw-table"><caption class="tw-muted">{{currentClass?.name}} · 共 {{filtered.length}} 名学生符合筛选条件</caption><thead><tr><th><input type="checkbox" :checked="pageSelected" :indeterminate="!pageSelected&&visible.some(s=>selected.includes(s.id))" aria-label="选择或取消本页学生" @change="togglePage"/></th><th>学号</th><th :aria-sort="descending?'descending':'ascending'"><button class="tw-link" @click="descending=!descending">学生姓名 {{descending?'↓':'↑'}}</button></th><th>修读组合</th><th>状态</th><th>版本</th></tr></thead><tbody><tr v-for="student in visible" :key="student.id"><td><input type="checkbox" :aria-label="`选择 ${student.name}`" :checked="selected.includes(student.id)" @change="toggle(student.id)"/></td><td class="number">{{student.studentNo}}</td><td>{{student.name}}</td><td><strong>{{student.selectionCode||'待确认'}}</strong><small>{{student.combinationName}}</small></td><td><span class="tw-badge" :class="student.combinationId?'good':'problem'">{{student.combinationId?'已确认':'未选课'}}</span></td><td>{{student.editVersion?'V'+student.editVersion:'—'}}</td></tr><tr v-if="!visible.length"><td colspan="6">没有符合条件的学生，请调整筛选条件或重置。</td></tr></tbody></table></div>
 <footer class="tw-pagination"><span>共 {{filtered.length}} 人 · 已选 {{selected.length}} 人</span><div class="tw-actions"><button class="tw-button" :disabled="page===1" @click="page--">上一页</button><span>第 {{page}} / {{pages}} 页</span><button class="tw-button" :disabled="page===pages" @click="page++">下一页</button></div></footer>
 <TeachingDialog :open="assignment" title="确认学期选课分配" :busy="busy" @close="assignment=false"><p>范围：{{currentClass?.name}}，共 {{selected.length}} 名学生。</p><label>修读组合<select v-model="combinationId" :disabled="busy"><option value="" disabled>请选择已启用组合</option><option v-for="c in combinations.filter(c=>c.enabled)" :key="c.id" :value="c.id">{{c.name}}</option></select></label><div v-if="previewError" class="tw-alert is-error" role="alert">{{previewError}}</div><p v-if="previewing" aria-busy="true">正在校验归属、开课范围与学生版本…</p><template v-if="preview"><div class="tw-metrics"><div><span>新增 / 调整</span><strong>{{preview.changed}}</strong></div><div><span>不变</span><strong>{{preview.unchanged}}</strong></div><div><span>冲突</span><strong>{{preview.conflicts}}</strong></div></div><ul><li v-for="change in preview.changes" :key="change.id">{{change.name||'学生已转班'}} · {{ {NEW:'首次分配',CHANGED:'调整组合',UNCHANGED:'组合不变',CONFLICT:'归属或版本冲突'}[change.kind] }}</li></ul></template><p class="tw-muted">整批重新校验并原子提交。已冻结考试的历史名单保持原有版本。</p><template #footer><button class="tw-button" :disabled="busy" @click="assignment=false">取消</button><button v-if="previewError" class="tw-button" :disabled="previewing" @click="loadPreview">重新预览</button><button class="tw-button primary" :disabled="busy||previewing||!preview||preview.conflicts>0" @click="save">{{busy?'正在保存…':'确认分配'}}</button></template></TeachingDialog>
 <TeachingDialog :open="scopesOpen" title="配置组合启用范围" :busy="busy" wide @close="scopesOpen=false"><p>{{currentClass?.cohort}} · {{currentClass?.gradeLevel}} 年级 · 当前学期</p><p class="tw-muted">启用前会校验 6 门科目均在该年级开课。禁用组合仍可解释历史选课。</p><div v-if="scopeError" class="tw-alert is-error" role="alert">{{scopeError}}</div><div v-if="!combinations.length" class="tw-empty">请先建立组合字典，并在基础配置中设置完整科目。</div><div class="tw-check-list"><label v-for="c in combinations" :key="c.id"><input v-model="enabled" :value="c.id" type="checkbox"/>{{c.name}}</label></div><template #footer><button class="tw-button" @click="scopesOpen=false">取消</button><button class="tw-button primary" :disabled="busy||!combinations.length" @click="saveScopes">保存启用范围</button></template></TeachingDialog>
</section></template>
