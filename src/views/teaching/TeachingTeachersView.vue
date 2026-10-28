<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { teachingGet, teachingRequest, requestKey, errorMessage, type Teacher, type DeletionImpact } from '../../api/teaching';
import { useTeaching } from './useTeaching';
import TeachingDialog from './TeachingDialog.vue';
const { metadata } = useTeaching();
const rows = ref<Teacher[]>([]), keyword = ref(''), loading = ref(false), busy = ref(false), error = ref(''), success = ref(''), impact = ref<DeletionImpact | null>(null), confirmation = ref(''), deletionKey = ref(''), employmentTarget = ref<Teacher | null>(null);
const filtered = computed(() => rows.value.filter(r => [r.name, r.loginName].some(s => s.includes(keyword.value.trim()))));
onMounted(load);
async function load() {
    if (!metadata.value?.admin)
        return;
    loading.value = true;
    error.value = '';
    try {
        rows.value = await teachingGet<Teacher[]>('/teachers');
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        loading.value = false;
    }
}
async function inspect(row: Teacher) {
    busy.value = true;
    error.value = '';
    try {
        impact.value = await teachingGet<DeletionImpact>(`/teachers/${row.id}/deletion-impact`);
        confirmation.value = '';
        deletionKey.value = requestKey();
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
async function employment() {
    if (!employmentTarget.value)
        return;
    busy.value = true;
    try {
        await teachingRequest('put', `/teachers/${employmentTarget.value.id}/employment`, { status: employmentTarget.value.employmentStatus === 'ACTIVE' ? 'DEPARTED' : 'ACTIVE' });
        employmentTarget.value = null;
        await load();
        success.value = '任职状态已更新。账号启停与任职状态分别管理。';
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
async function remove() {
    if (!impact.value)
        return;
    busy.value = true;
    error.value = '';
    try {
        await teachingRequest('delete', `/teachers/${impact.value.id}`, { requestKey: deletionKey.value, confirmLoginName: confirmation.value });
        impact.value = null;
        await load();
        success.value = '离职教师账号及登录关系已物理删除，历史教学内容与署名保留。';
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
</script>
<template><section><header class="tw-head"><div><h2>离职教师交接与删除</h2><p>先交接当前班主任与任课关系，再预检历史引用。删除账号保留历史教学事实和署名。</p></div></header><div v-if="!metadata?.admin" class="tw-empty" role="alert">仅管理员可查看教师交接与物理删除。</div><template v-else><div v-if="error" class="tw-alert is-error" role="alert">{{error}} <button @click="load">重试</button></div><div v-if="success" class="tw-alert" role="status">{{success}}</div><div class="tw-scope"><label>查找教师<input v-model="keyword" type="search" placeholder="姓名或登录账号"/></label><button class="tw-button" @click="load">刷新</button></div><div v-if="loading" class="tw-loading" aria-busy="true">正在读取教师任职情况…</div><div v-else class="tw-table-wrap"><table class="tw-table"><thead><tr><th>教师</th><th>账号</th><th>任职状态</th><th>账号状态</th><th>操作</th></tr></thead><tbody><tr v-for="teacher in filtered" :key="teacher.id"><td>{{teacher.name}}</td><td>{{teacher.loginName}}</td><td><span class="tw-badge" :class="teacher.employmentStatus==='ACTIVE'?'good':'private'">{{teacher.employmentStatus==='ACTIVE'?'在职':'已离职'}}</span></td><td>{{teacher.status?'启用':'停用'}}</td><td><button class="tw-link" :disabled="busy||teacher.id===metadata.userId" @click="employmentTarget=teacher">{{teacher.employmentStatus==='ACTIVE'?'标记离职':'恢复在职'}}</button><button class="tw-link" :disabled="busy" @click="inspect(teacher)">删除依赖预检</button></td></tr><tr v-if="!filtered.length"><td colspan="5">没有符合条件的教师。</td></tr></tbody></table></div></template>
<TeachingDialog :open="!!employmentTarget" title="确认任职状态变更" :busy="busy" @close="employmentTarget=null"><p>{{employmentTarget?.name}} 将标记为{{employmentTarget?.employmentStatus==='ACTIVE'?'离职':'在职'}}。任职状态不会自动关闭账号，也不会自动解除任课关系。</p><template #footer><button class="tw-button" @click="employmentTarget=null">取消</button><button class="tw-button primary" :disabled="busy" @click="employment">确认变更</button></template></TeachingDialog>
<TeachingDialog :open="!!impact" title="物理删除预检与确认" :busy="busy" wide @close="impact=null"><template v-if="impact"><h3>{{impact.name}} · {{impact.loginName}}</h3><p>当前班主任关系 {{impact.currentClasses}} 项，任课关系 {{impact.currentCourses}} 项。</p><div v-if="impact.blockers.length" class="tw-alert is-warning"><strong>当前禁止删除</strong><ul><li v-for="b in impact.blockers" :key="b">{{b}}</li></ul></div><div class="tw-table-wrap"><table class="tw-table"><thead><tr><th>引用表</th><th>引用字段</th><th>数量</th></tr></thead><tbody><tr v-for="r in impact.references.filter(r=>r.count>0)" :key="r.tableName+r.columnName"><td>{{r.tableName}}</td><td>{{r.columnName}}</td><td>{{r.count}}</td></tr></tbody></table></div><p>账号、会话及纯用户关系会删除；教学历史保留署名快照并清除用户外键。执行时会再次检查，预检通过不代表免于并发校验。</p><label v-if="impact.canDelete">输入登录账号确认不可恢复的物理删除<input v-model="confirmation" autocomplete="off"/></label><div v-if="error" class="tw-alert is-error">{{error}}</div></template><template #footer><button class="tw-button" @click="impact=null">返回交接</button><button class="tw-button danger" :disabled="busy||!impact?.canDelete||confirmation!==impact.loginName" @click="remove">确认物理删除账号</button></template></TeachingDialog>
</section></template>
