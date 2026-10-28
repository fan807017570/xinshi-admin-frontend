<script setup lang="ts">
import { ref, watch } from 'vue';
import { polishComment } from '../../api/school';
import { teachingGet, teachingPost, teachingRequest, errorMessage, type Assessment, type Version, type TeachingComment, type DefaultComment, type Attention } from '../../api/teaching';
import { useTeachingScope } from './useTeaching';
import TeachingScope from './TeachingScope.vue';
import TeachingDialog from './TeachingDialog.vue';
const { metadata, classId, termId, canManageClass, canManageSubject } = useTeachingScope();
const assessments = ref<Assessment[]>([]), assessmentId = ref(''), versions = ref<Version[]>([]), versionId = ref(''), subjects = ref<{
    id: string;
    name: string;
}[]>([]), scope = ref('OVERALL'), subjectId = ref('');
const comments = ref<TeachingComment[]>([]), attention = ref<Attention[]>([]), students = ref<{
    studentId: string;
    name: string;
    studentNo: string;
}[]>([]), error = ref(''), success = ref(''), busy = ref(false), loading = ref(false);
const preview = ref<DefaultComment[]>([]), previewOpen = ref(false), edited = ref<TeachingComment | null>(null), body = ref(''), editError = ref(''), polished = ref(''), beforePolish = ref(''), acceptedPolish = ref(false);
const noteOpen = ref(false), noteStudent = ref(''), note = ref('');
watch([classId, termId], () => void loadScope(), { immediate: true });
watch(assessmentId, () => void loadAssessment());
async function loadScope() {
    if (!classId.value)
        return;
    loading.value = true;
    error.value = '';
    try {
        assessments.value = (await teachingGet<Assessment[]>('/assessments', { classId: classId.value })).filter(a => a.termId === termId.value);
        assessmentId.value = assessments.value[0]?.id || '';
        scope.value = canManageClass.value ? 'OVERALL' : 'SUBJECT';
        await loadAssessment();
        attention.value = await teachingGet<Attention[]>('/attention', { classId: classId.value, termId: termId.value });
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        loading.value = false;
    }
}
async function loadAssessment() {
    if (!assessmentId.value) {
        comments.value = [];
        students.value = [];
        return;
    }
    try {
        const detail = await teachingGet<Assessment>(`/assessments/${assessmentId.value}`, { classId: classId.value });
        versions.value = (detail.versions || []).filter(v => v.status === 'FROZEN');
        versionId.value = versions.value[0]?.id || '';
        subjects.value = (detail.subjects || []).filter(s => canManageSubject(s.subjectId, detail.termId)).map(s => ({ id: s.subjectId, name: s.name }));
        subjectId.value = subjects.value[0]?.id || '';
        students.value = detail.roster || [];
        comments.value = await teachingGet<TeachingComment[]>('/comments', { assessmentId: assessmentId.value, classId: classId.value });
    }
    catch (e) {
        error.value = errorMessage(e);
    }
}
function payload() { return { classId: classId.value, resultVersionId: versionId.value, scope: scope.value, ...(scope.value === 'SUBJECT' ? { subjectId: subjectId.value } : {}) }; }
async function defaultPreview() {
    busy.value = true;
    error.value = '';
    try {
        preview.value = await teachingPost<DefaultComment[]>('/comments/default-previews', payload());
        previewOpen.value = true;
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
async function generate() {
    busy.value = true;
    error.value = '';
    try {
        const result = await teachingPost<{
            created: number;
            skipped: number;
        }>('/comments/defaults', payload());
        previewOpen.value = false;
        await loadAssessment();
        success.value = `已生成 ${result.created} 份草稿，跳过 ${result.skipped} 项。已有或人工锁定评语不会被覆盖。`;
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
function edit(comment: TeachingComment) { edited.value = comment; body.value = comment.body; editError.value = ''; polished.value = ''; beforePolish.value = ''; acceptedPolish.value = false; }
async function save() {
    if (!edited.value)
        return;
    busy.value = true;
    editError.value = '';
    try {
        await teachingRequest('put', `/comments/${edited.value.id}`, { body: body.value, editVersion: edited.value.editVersion, source: acceptedPolish.value ? 'AI_POLISHED' : 'MANUAL' });
        edited.value = null;
        await loadAssessment();
        success.value = '评语已保存为人工保护的草稿，请检查后发布。';
    }
    catch (e) {
        editError.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
async function polish() {
    busy.value = true;
    editError.value = '';
    try {
        const result = await polishComment(body.value) as {
            polishedText: string;
        };
        polished.value = result.polishedText;
    }
    catch (e) {
        editError.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
function acceptPolish() { beforePolish.value = body.value; body.value = polished.value; acceptedPolish.value = true; polished.value = ''; }
async function publish(comment: TeachingComment) {
    busy.value = true;
    error.value = '';
    try {
        await teachingPost(`/comments/${comment.id}/publication`, { editVersion: comment.editVersion, withdraw: comment.status === 'PUBLISHED' });
        await loadAssessment();
        success.value = comment.status === 'PUBLISHED' ? '评语已撤回，关联已发布报告同时撤回。' : '评语已发布。';
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
function openNote() { noteStudent.value = students.value[0]?.studentId || ''; note.value = ''; noteOpen.value = true; }
watch(noteStudent, id => { note.value = attention.value.find(n => n.studentId === id)?.note || ''; });
async function saveNote() {
    busy.value = true;
    editError.value = '';
    try {
        await teachingRequest('put', '/attention', { studentId: noteStudent.value, termId: termId.value, note: note.value });
        noteOpen.value = false;
        attention.value = await teachingGet<Attention[]>('/attention', { classId: classId.value, termId: termId.value });
        success.value = '本人内部关注备注已更新。';
    }
    catch (e) {
        editError.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
</script>
<template><section><header class="tw-head"><div><h2>默认评语与重点关注</h2><p>从一个确定考试结果版本生成温和评语；人工调整始终保护，内部关注仅本人可见。</p></div><button class="tw-button" :disabled="!students.length" @click="openNote">维护本人关注备注</button></header><TeachingScope v-model:class-id="classId" v-model:term-id="termId"><label>成绩依据考试<select v-model="assessmentId"><option value="">请选择考试</option><option v-for="a in assessments" :key="a.id" :value="a.id">{{a.name}}</option></select></label></TeachingScope>
<div v-if="error" class="tw-alert is-error" role="alert">{{error}} <button @click="loadScope">重试</button></div><div v-if="success" class="tw-alert" role="status">{{success}}</div><div v-if="loading" class="tw-loading" aria-busy="true">正在读取评语与关注…</div><template v-else><div class="tw-scope"><label>固定结果版本<select v-model="versionId"><option value="" disabled>请选择已冻结版本</option><option v-for="v in versions" :key="v.id" :value="v.id">V{{v.versionNo}} · {{v.reason}}</option></select></label><label>评语层次<select v-model="scope"><option v-if="canManageClass" value="OVERALL">学期综合评语</option><option value="SUBJECT">单科评语</option></select></label><label v-if="scope==='SUBJECT'">科目<select v-model="subjectId"><option v-for="s in subjects" :key="s.id" :value="s.id">{{s.name}}</option></select></label><button class="tw-button primary" :disabled="busy||!versionId" @click="defaultPreview">预览默认评语草稿</button></div><p class="tw-muted">仅生成空白项。成绩变化时请用新版本预览“依据已更新”；原文本不会自动被重写。</p>
<div class="tw-table-wrap"><table class="tw-table"><thead><tr><th>学生 / 层次</th><th>评语内容</th><th>来源 / 依据</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="c in comments" :key="c.id"><td>{{c.name}}<small>{{c.scope==='OVERALL'?'综合':subjects.find(s=>s.id===c.subjectId)?.name||'单科'}}</small></td><td style="max-width:45ch;white-space:pre-wrap">{{c.body}}</td><td>{{c.source==='AUTO_TEMPLATE'?'温和模板':c.source==='AI_POLISHED'?'人工接受润色':'人工调整'}}<small>结果 #{{c.resultVersionId}} · {{c.manualLocked?'人工保护':'自动草稿'}}</small></td><td><span class="tw-badge" :class="c.status==='PUBLISHED'?'good':'private'">{{c.status==='PUBLISHED'?'已发布':'草稿'}}</span></td><td><template v-if="c.scope==='OVERALL'?canManageClass:canManageSubject(c.subjectId)"><button class="tw-link" @click="edit(c)">调整 / 润色</button><button class="tw-link" :disabled="busy" @click="publish(c)">{{c.status==='PUBLISHED'?'显式撤回':'发布'}}</button></template><span v-else class="tw-muted">仅查看</span></td></tr><tr v-if="!comments.length"><td colspan="5">尚无此考试的评语。先选择冻结结果并预览默认草稿。</td></tr></tbody></table></div>
<section class="tw-section"><h3>本人内部关注 <span class="tw-muted">不进入家长端或报告文件</span></h3><div v-if="!attention.length" class="tw-empty">当前没有本人关注备注。</div><div v-for="n in attention" :key="n.id" class="tw-thread"><strong>{{n.name}}</strong><p>{{n.note}}</p><button class="tw-link" @click="noteStudent=n.studentId;note=n.note;editError='';noteOpen=true">维护备注</button></div></section></template>
<TeachingDialog :open="previewOpen" title="默认评语生成预览" :busy="busy" wide @close="previewOpen=false"><p>只依据当前所选考试的有效原分；不从分数推断性格、努力程度或课堂表现。</p><div class="tw-table-wrap"><table class="tw-table"><thead><tr><th>学生</th><th>处理结果</th><th>拟生成内容</th></tr></thead><tbody><tr v-for="p in preview" :key="p.studentId"><td>{{p.name}}</td><td>{{p.skipReason||'新增空白草稿'}}<small v-if="p.basisUpdated">成绩依据已更新，原评语保持</small></td><td>{{p.skipReason?'—':p.text}}</td></tr></tbody></table></div><div v-if="error" class="tw-alert is-error">{{error}}</div><template #footer><button class="tw-button" @click="previewOpen=false">取消</button><button class="tw-button primary" :disabled="busy||!preview.some(p=>!p.skipReason)" @click="generate">生成缺少的草稿</button></template></TeachingDialog>
<TeachingDialog :open="!!edited" title="调整评语 · 保存后人工保护" :busy="busy" @close="edited=null"><label>评语内容 *<textarea v-model="body" maxlength="1000" rows="7"/></label><div class="tw-actions"><button class="tw-button" :disabled="busy||!body.trim()" @click="polish">调用现有润色服务</button><button v-if="beforePolish" class="tw-button" @click="body=beforePolish;beforePolish='';acceptedPolish=false">撤销接受润色</button></div><div v-if="polished" class="tw-alert"><strong>润色建议，请核对后接受</strong><p>{{polished}}</p><button @click="acceptPolish">接受建议</button> <button @click="polished=''">忽略</button></div><div v-if="editError" class="tw-alert is-error" role="alert">{{editError}}</div><template #footer><button class="tw-button" @click="edited=null">取消</button><button class="tw-button primary" :disabled="busy||!body.trim()" @click="save">保存为草稿</button></template></TeachingDialog>
<TeachingDialog :open="noteOpen" title="本人重点关注与内部备注" :busy="busy" @close="noteOpen=false"><label>学生<select v-model="noteStudent"><option v-for="s in students" :key="s.studentId" :value="s.studentId">{{s.name}} · {{s.studentNo}}</option></select></label><label>内部备注<textarea v-model="note" maxlength="1000"/></label><p class="tw-muted">清空并保存可取消关注；该内容仅本人在合法教学范围内可见。</p><div v-if="editError" class="tw-alert is-error">{{editError}}</div><template #footer><button class="tw-button" @click="noteOpen=false">取消</button><button class="tw-button primary" :disabled="busy||!noteStudent" @click="saveNote">保存内部备注</button></template></TeachingDialog>
</section></template>
