<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { teachingGet, teachingPost, teachingRequest, teachingDownload, requestKey, errorMessage, type Assessment, type ScoreEntry, type ResultDetail, type Band } from '../../api/teaching';
import { useTeaching, useTeachingScope } from './useTeaching';
import TeachingScope from './TeachingScope.vue';
import TeachingDialog from './TeachingDialog.vue';
const { metadata, refresh } = useTeaching(), { classId, termId, currentClass, canManageSubject } = useTeachingScope(), route = useRoute();
const list = ref<Assessment[]>([]), assessmentId = ref(String(route.query.assessmentId || '')), assessment = ref<Assessment | null>(null), tab = ref('roster'), subjectId = ref(''), scores = ref<ScoreEntry[]>([]), resultId = ref(''), result = ref<ResultDetail | null>(null);
const loading = ref(false), busy = ref(false), error = ref(''), success = ref(''), dialogError = ref(''), createOpen = ref(false), ruleOpen = ref(false), freezeOpen = ref(false), resultOpen = ref(false), reason = ref(''), versionKey = ref(''), voidEntry = ref<ScoreEntry | null>(null);
const form = reactive({ name: '', examTypeId: '', ruleVersionId: '', subjects: [] as {
        id: string;
        selected: boolean;
        paperCode: string;
        maxScore: number;
        ruleVersionId: string;
    }[] });
const rule = reactive({ code: '', mode: 'ABSOLUTE', basis: 'PERCENTAGE', bands: [] as Band[] });
const importOpen = ref(false), importPreview = ref<{
    valid: boolean;
    token?: string;
    count: number;
    errors: {
        row: number;
        studentNo: string;
        message: string;
    }[];
} | null>(null);
const activeRules = computed(() => metadata.value?.rules.filter(r => r.status === 'ACTIVE') || []), dirty = computed(() => scores.value.filter(s => s.dirty));
let timer: ReturnType<typeof setTimeout> | undefined, disposed = false, loadSequence = 0;
const scoreSubjects = computed(() => assessment.value?.subjects?.filter(s => canManageSubject(s.subjectId, assessment.value?.termId)) || []);
watch([classId, termId], () => void loadList(), { immediate: true });
watch(assessmentId, () => void loadDetail());
watch(subjectId, () => void loadScores());
watch(resultId, () => void loadResult());
onUnmounted(() => { disposed = true; clearTimeout(timer); });
async function loadList() {
    if (!classId.value)
        return;
    loading.value = true;
    error.value = '';
    try {
        list.value = (await teachingGet<Assessment[]>('/assessments', { classId: classId.value })).filter(a => a.termId === termId.value);
        if (!list.value.some(a => a.id === assessmentId.value))
            assessmentId.value = list.value[0]?.id || '';
        await loadDetail();
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        loading.value = false;
    }
}
async function loadDetail() {
    clearTimeout(timer);
    if (!assessmentId.value) {
        assessment.value = null;
        return;
    }
    const seq = ++loadSequence;
    try {
        const detail = await teachingGet<Assessment>(`/assessments/${assessmentId.value}`, { classId: classId.value });
        if (seq !== loadSequence || disposed)
            return;
        assessment.value = detail;
        if (!scoreSubjects.value.some(s => s.id === subjectId.value))
            subjectId.value = scoreSubjects.value[0]?.id || '';
        if (!detail.versions?.some(v => v.id === resultId.value))
            resultId.value = detail.versions?.find(v => v.status === 'FROZEN')?.id || '';
        if (detail.versions?.some(v => v.status === 'BUILDING'))
            timer = setTimeout(() => void loadDetail(), 2000);
        if (tab.value === 'scores')
            await loadScores();
    }
    catch (e) {
        error.value = errorMessage(e);
    }
}
async function loadScores() {
    if (!assessmentId.value || !subjectId.value)
        return;
    try {
        scores.value = await teachingGet<ScoreEntry[]>(`/assessments/${assessmentId.value}/scores`, { classId: classId.value, assessmentSubjectId: subjectId.value });
    }
    catch (e) {
        error.value = errorMessage(e);
        scores.value = [];
    }
}
async function loadResult() {
    if (!resultId.value) {
        result.value = null;
        return;
    }
    try {
        result.value = await teachingGet<ResultDetail>(`/result-versions/${resultId.value}`, { classId: classId.value });
    }
    catch (e) {
        error.value = errorMessage(e);
    }
}
function openCreate() { dialogError.value = ''; form.name = ''; form.examTypeId = metadata.value?.examTypes[0]?.id || ''; form.ruleVersionId = activeRules.value[0]?.id || ''; form.subjects = (metadata.value?.subjects || []).map(s => ({ id: s.id, selected: false, paperCode: 'PAPER-' + s.code, maxScore: s.maxScore, ruleVersionId: '' })); createOpen.value = true; }
async function create() {
    busy.value = true;
    dialogError.value = '';
    try {
        const created = await teachingPost<{
            id: string;
        }>('/assessments', { termId: termId.value, cohort: currentClass.value?.cohort, gradeLevel: currentClass.value?.gradeLevel, name: form.name, examTypeId: form.examTypeId, ruleVersionId: form.ruleVersionId, subjects: form.subjects.filter(s => s.selected).map(s => ({ ...s, ruleVersionId: s.ruleVersionId || form.ruleVersionId })) });
        createOpen.value = false;
        assessmentId.value = created.id;
        await loadList();
        success.value = '考试已建立，请检查科目与名单后冻结。';
    }
    catch (e) {
        dialogError.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
function presetRule() { rule.basis = rule.mode === 'RELATIVE' ? 'RANK' : 'PERCENTAGE'; rule.bands = rule.mode === 'RELATIVE' ? [{ label: 'A', lowerValue: 0, upperValue: .2 }, { label: 'B', lowerValue: .2, upperValue: .5 }, { label: 'C', lowerValue: .5, upperValue: .8 }, { label: 'D', lowerValue: .8, upperValue: 1 }] : [{ label: 'A', lowerValue: 90, upperValue: 100 }, { label: 'B', lowerValue: 80, upperValue: 90 }, { label: 'C', lowerValue: 70, upperValue: 80 }, { label: 'D', lowerValue: 60, upperValue: 70 }, { label: 'E', lowerValue: 0, upperValue: 60 }]; }
function openRule() { dialogError.value = ''; rule.code = ''; rule.mode = 'ABSOLUTE'; presetRule(); ruleOpen.value = true; }
async function saveRule() {
    busy.value = true;
    dialogError.value = '';
    try {
        await teachingPost('/grade-rules', rule);
        await refresh();
        ruleOpen.value = false;
        success.value = '规则草稿已保存，请显式启用后供新考试使用。';
    }
    catch (e) {
        dialogError.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
async function activate(id: string) {
    busy.value = true;
    error.value = '';
    try {
        await teachingPost(`/grade-rules/${id}/activate`);
        await refresh();
        success.value = '规则已启用；被考试引用后内容保持不可变。';
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
async function freeze() {
    if (!assessment.value)
        return;
    busy.value = true;
    dialogError.value = '';
    try {
        await teachingPost(`/assessments/${assessmentId.value}/roster-freeze`, { editVersion: assessment.value.editVersion, reason: reason.value });
        freezeOpen.value = false;
        await loadDetail();
        success.value = '参评主名单与科目修读快照已冻结。';
    }
    catch (e) {
        dialogError.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
function openVersion() { dialogError.value = ''; reason.value = assessment.value?.versions?.length ? '补录或修订后的更正版本' : '首次结果冻结'; versionKey.value = requestKey(); resultOpen.value = true; }
async function buildVersion() {
    busy.value = true;
    dialogError.value = '';
    try {
        await teachingPost(`/assessments/${assessmentId.value}/result-versions`, { reason: reason.value, requestKey: versionKey.value });
        resultOpen.value = false;
        success.value = '结果构建任务已提交；所有科目快照完整后才发布新版本。';
        await loadDetail();
    }
    catch (e) {
        dialogError.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
async function saveScores() {
    busy.value = true;
    error.value = '';
    try {
        await teachingRequest('put', `/assessments/${assessmentId.value}/scores`, { classId: classId.value, assessmentSubjectId: subjectId.value, scores: dirty.value.map(s => ({ studentId: s.studentId, resultKind: s.resultKind, score: s.resultKind === 'NORMAL' ? s.score : null, editVersion: s.editVersion, comment: s.comment })) });
        await loadScores();
        success.value = '成绩已保存。已有结果版本不会改变，需要更正时请构建新版本。';
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
async function downloadTemplate() {
    try {
        await teachingDownload(`/assessments/${assessmentId.value}/score-template`, '考试成绩录入模板.csv', { classId: classId.value, assessmentSubjectId: subjectId.value });
    }
    catch (e) {
        error.value = errorMessage(e);
    }
}
async function upload(event: Event) {
    const input = event.target as HTMLInputElement, file = input.files?.[0];
    if (!file)
        return;
    busy.value = true;
    dialogError.value = '';
    try {
        const data = new FormData();
        data.append('file', file);
        importPreview.value = await teachingRequest('post', `/assessments/${assessmentId.value}/score-imports`, data, { classId: classId.value, assessmentSubjectId: subjectId.value });
        importOpen.value = true;
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
        input.value = '';
    }
}
async function commitImport() {
    if (!importPreview.value?.token)
        return;
    busy.value = true;
    dialogError.value = '';
    try {
        await teachingPost(`/score-imports/${importPreview.value.token}/commit`);
        importOpen.value = false;
        await loadScores();
        success.value = '导入已完成。';
    }
    catch (e) {
        dialogError.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
async function voidScore() {
    if (!voidEntry.value?.id)
        return;
    busy.value = true;
    try {
        await teachingPost(`/scores/${voidEntry.value.id}/void`, { editVersion: voidEntry.value.editVersion });
        voidEntry.value = null;
        await loadScores();
        success.value = '成绩已逻辑作废，历史快照保留，关联对外报告已撤回。';
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
async function republishScore(score: ScoreEntry) {
    if (!score.id)
        return;
    busy.value = true;
    try {
        await teachingPost(`/scores/${score.id}/republish`, { editVersion: score.editVersion });
        await loadScores();
        success.value = '源成绩已重新发布；旧撤回代次的报告仍不能恢复发布。';
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
async function retryResult(id: string) {
    busy.value = true;
    try {
        await teachingPost(`/result-versions/${id}/retry`);
        await loadDetail();
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
</script>
<template><section><header class="tw-head"><div><h2>考试与等级结果</h2><p>区分考试类型与具体考试。先冻结名单，再按同考试、年级、科目和试卷建立完整排名版本。</p></div><div v-if="metadata?.admin" class="tw-actions"><button class="tw-button" @click="openRule">新增规则版本</button><button class="tw-button primary" :disabled="!activeRules.length" @click="openCreate">建立考试</button></div></header>
<TeachingScope v-model:class-id="classId" v-model:term-id="termId"><label>考试实例<select v-model="assessmentId"><option value="">请选择考试</option><option v-for="a in list" :key="a.id" :value="a.id">{{a.name}}</option></select></label></TeachingScope>
<div v-if="error" class="tw-alert is-error" role="alert">{{error}} <button @click="loadList">重新加载</button></div><div v-if="success" class="tw-alert" role="status">{{success}}</div>
<nav class="tw-filters" aria-label="考试工作区"><button v-for="t in [{id:'roster',label:'考试与名单'},{id:'scores',label:'成绩录入 / 导入'},{id:'results',label:'等级结果版本'},{id:'rules',label:'规则版本字典'}]" :key="t.id" :class="{active:tab===t.id}" @click="tab=t.id;t.id==='scores'?loadScores():t.id==='results'?loadResult():undefined">{{t.label}}</button></nav>
<div v-if="loading" class="tw-loading" aria-busy="true">正在读取考试…</div><template v-else-if="tab==='rules'"><p class="tw-muted">规则启用后不可原地修改。需要调整档位时，以相同规则编码建立新版本。绝对分不先四舍五入；相对规则使用竞赛名次与向上取整累计边界。</p><div class="tw-table-wrap"><table class="tw-table"><thead><tr><th>规则</th><th>模式 / 基准</th><th>档位范围</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="r in metadata?.rules" :key="r.id"><td>{{r.code}} · V{{r.versionNo}}</td><td>{{r.mode==='RELATIVE'?'相对等级':'绝对等级'}} / {{r.basis}}</td><td>{{r.bands.map(b=>`${b.label}: ${b.lowerValue}—${b.upperValue}`).join('；')}}</td><td>{{r.status==='ACTIVE'?'已启用':'草稿'}}</td><td><button v-if="metadata?.admin&&r.status==='DRAFT'" class="tw-link" :disabled="busy" @click="activate(r.id)">显式启用</button></td></tr><tr v-if="!metadata?.rules.length"><td colspan="5">尚无等级规则，请先建立并启用规则。</td></tr></tbody></table></div></template>
<div v-else-if="!assessment" class="tw-empty">尚未选择考试。管理员可先配置规则，再建立考试实例。</div><template v-else>
<div v-if="tab==='roster'"><div class="tw-head"><div><h3>{{assessment.name}}</h3><p class="tw-muted">{{assessment.cohort}} · {{assessment.gradeLevel}} 年级 · 名单 V{{assessment.rosterVersion}} · {{assessment.status==='DRAFT'?'草稿，尚未冻结':'参评名单已冻结'}}</p></div><button v-if="metadata?.admin" class="tw-button primary" :disabled="busy" @click="reason='';dialogError='';freezeOpen=true">{{assessment.status==='DRAFT'?'检查并冻结参评名单':'更正选课身份并建立新名单版本'}}</button></div><p class="tw-alert">未知选课学生仍保留在主名单中，不臆造科目。后续转班或换科不会修改旧名单与旧结果。</p><div class="tw-table-wrap"><table class="tw-table"><thead><tr><th>科目</th><th>试卷</th><th>合法满分</th><th>规则版本 ID</th></tr></thead><tbody><tr v-for="s in assessment.subjects" :key="s.id"><td>{{s.name}}</td><td>{{s.paperCode}}</td><td>{{s.maxScore}}</td><td>#{{s.ruleVersionId}}</td></tr></tbody></table></div><section class="tw-section"><h3>当前行政班参评主名单</h3><div class="tw-table-wrap"><table class="tw-table"><thead><tr><th>学号</th><th>学生</th><th>选课状态</th></tr></thead><tbody><tr v-for="s in assessment.roster" :key="s.studentId"><td>{{s.studentNo}}</td><td>{{s.name}}</td><td><span class="tw-badge" :class="s.selectionState==='CONFIRMED'?'good':'problem'">{{s.selectionState==='CONFIRMED'?'已确认':'待确认选课'}}</span></td></tr><tr v-if="!assessment.roster?.length"><td colspan="3">尚未冻结名单，或当前行政班没有参评学生。</td></tr></tbody></table></div></section></div>
<div v-if="tab==='scores'"><div class="tw-scope"><label>考试科目 / 试卷<select v-model="subjectId"><option v-for="s in scoreSubjects" :key="s.id" :value="s.id">{{s.name}} · {{s.paperCode}} · 满分 {{s.maxScore}}</option></select></label><button class="tw-button" :disabled="busy||!subjectId" @click="downloadTemplate">下载录入模板</button><label class="tw-button">上传 CSV / XLSX<input type="file" accept=".csv,.xlsx" :disabled="busy||assessment.status==='DRAFT'" @change="upload"/></label><button class="tw-button primary" :disabled="busy||!dirty.length" @click="saveScores">保存 {{dirty.length}} 项变更</button></div><p class="tw-muted">名单仅显示该学生应修的考试科目；正常 0 分、缺考、免考和未录入分别表示。导入先预检，再按版本整批提交。</p><div class="tw-table-wrap"><table class="tw-table"><thead><tr><th>学号 / 学生</th><th>成绩状态</th><th>原始分</th><th>单科评语</th><th>版本</th><th>操作</th></tr></thead><tbody><tr v-for="s in scores" :key="s.studentId"><td>{{s.name}}<small>{{s.studentNo}}</small></td><td><select v-model="s.resultKind" :aria-label="`${s.name} 成绩状态`" @change="s.dirty=true"><option value="MISSING" disabled>未录入</option><option value="NORMAL">正常成绩</option><option value="ABSENT">缺考</option><option value="EXEMPT">免考</option></select></td><td><input v-model.number="s.score" type="number" min="0" step="0.0001" class="tw-grade-input" :disabled="s.resultKind!=='NORMAL'" :aria-label="`${s.name} 分数`" @input="s.dirty=true"/></td><td><input v-model="s.comment" :aria-label="`${s.name} 单科评语`" maxlength="1000" @input="s.dirty=true"/></td><td>V{{s.editVersion}} <span v-if="s.recordState==='VOIDED'" class="tw-badge problem">已作废</span></td><td><button v-if="s.id&&s.recordState!=='VOIDED'" class="tw-link" @click="voidEntry=s">逻辑作废</button><button v-if="s.id&&s.recordState==='ACTIVE'&&s.explicitlyWithdrawn" class="tw-link" :disabled="busy" @click="republishScore(s)">重新发布源成绩</button></td></tr><tr v-if="!scores.length"><td colspan="6">当前科目没有可录入学生，请确认名单冻结与任课权限。</td></tr></tbody></table></div></div>
<div v-if="tab==='results'"><div class="tw-head"><p>更正生成新结果版本，原排名及原报告保持可查。</p><button v-if="metadata?.admin" class="tw-button primary" :disabled="busy||assessment.status==='DRAFT'" @click="openVersion">构建首次 / 更正结果版本</button></div><div class="tw-table-wrap"><table class="tw-table"><thead><tr><th>结果版本</th><th>名单依据</th><th>状态</th><th>原因</th><th>操作</th></tr></thead><tbody><tr v-for="v in assessment.versions" :key="v.id"><td>V{{v.versionNo}} · #{{v.id}}</td><td>名单 V{{v.rosterVersion}}</td><td>{{v.status==='FROZEN'?'已冻结':v.status==='BUILDING'?'后台构建中':'构建失败'}}</td><td>{{v.reason}}<small>{{v.errorCode}}</small></td><td><button v-if="v.status==='FROZEN'" class="tw-link" @click="resultId=v.id;loadResult()">查看等级结果</button><button v-if="v.status==='FAILED'&&metadata?.admin" class="tw-link" :disabled="busy" @click="retryResult(v.id)">重试固定输入构建</button></td></tr></tbody></table></div><template v-if="result"><div class="tw-head"><h3>结果 V{{result.versionNo}} · 未知选课 {{result.unknownSelectionCount}} 人</h3></div><p class="tw-alert">同分同等级；小样本可能缺少部分档位。以下母体人数覆盖整个考试同年级科目试卷，不随当前班级权限缩小。</p><div class="tw-table-wrap"><table class="tw-table"><thead><tr><th>科目</th><th>预期人数</th><th>有效人数</th><th>排除人数</th></tr></thead><tbody><tr v-for="s in result.subjects" :key="s.id"><td>{{s.name}}</td><td>{{s.expectedCount}}</td><td>{{s.effectiveCount}}</td><td>{{s.excludedCount}}</td></tr></tbody></table></div><section class="tw-section"><h3>本人可访问班级的学生结果</h3><div class="tw-table-wrap"><table class="tw-table"><thead><tr><th>学生</th><th>科目</th><th>状态 / 原分</th><th>等级</th><th>竞赛名次</th></tr></thead><tbody><tr v-for="(g,index) in result.results" :key="index"><td>{{g.name}}</td><td>{{g.subjectName}}</td><td>{{g.resultKind==='NORMAL'?`${g.score} / ${g.maxScore}`:({MISSING:'未录入',ABSENT:'缺考',EXEMPT:'免考',VOIDED:'已作废',INVALID:'非法成绩'}[g.resultKind]||g.resultKind)}}</td><td>{{g.gradeLabel||'—'}}</td><td>{{g.competitionRank?`${g.competitionRank} / ${g.effectiveCount}`:'—'}}</td></tr></tbody></table></div></section></template></div></template>
<TeachingDialog :open="createOpen" title="建立具体考试实例" :busy="busy" wide @close="createOpen=false"><form id="assessment-create" class="tw-form-grid" @submit.prevent="create"><label>考试名称 *<input v-model="form.name" required maxlength="128"/></label><label>评价类型 *<select v-model="form.examTypeId" required><option value="" disabled>请选择</option><option v-for="t in metadata?.examTypes" :key="t.id" :value="t.id">{{t.name}}</option></select></label><label class="full">默认等级规则 *<select v-model="form.ruleVersionId" required><option v-for="r in activeRules" :key="r.id" :value="r.id">{{r.code}} V{{r.versionNo}} · {{r.mode}}</option></select></label><p class="full tw-muted">范围：{{currentClass?.cohort}} · {{currentClass?.gradeLevel}} 年级。只选本次实际考试科目，每科使用确定试卷和满分。</p><div v-for="s in form.subjects" :key="s.id" class="full tw-scope"><label class="tw-checkbox"><input v-model="s.selected" type="checkbox"/>{{metadata?.subjects.find(x=>x.id===s.id)?.name}}</label><label>试卷编码<input v-model="s.paperCode" :required="s.selected" :disabled="!s.selected" maxlength="64"/></label><label>满分<input v-model.number="s.maxScore" type="number" min="0.0001" step="0.0001" :required="s.selected" :disabled="!s.selected"/></label><label>该科规则<select v-model="s.ruleVersionId" :disabled="!s.selected"><option value="">沿用默认</option><option v-for="r in activeRules" :key="r.id" :value="r.id">{{r.code}} V{{r.versionNo}}</option></select></label></div><div v-if="dialogError" class="full tw-alert is-error" role="alert">{{dialogError}}</div></form><template #footer><button class="tw-button" @click="createOpen=false">取消</button><button form="assessment-create" class="tw-button primary" :disabled="busy||!form.subjects.some(s=>s.selected)">建立考试</button></template></TeachingDialog>
<TeachingDialog :open="ruleOpen" title="新增不可变等级规则版本" :busy="busy" wide @close="ruleOpen=false"><form id="rule-create" @submit.prevent="saveRule"><div class="tw-form-grid"><label>规则族编码 *<input v-model="rule.code" required maxlength="32" placeholder="相同编码自动增加版本号"/></label><label>模式<select v-model="rule.mode" @change="presetRule"><option value="ABSOLUTE">绝对成绩</option><option value="RELATIVE">相对成绩</option></select></label><label>判档基准<select v-model="rule.basis" :disabled="rule.mode==='RELATIVE'"><option value="PERCENTAGE">折算百分制</option><option value="RAW">原始分</option><option v-if="rule.mode==='RELATIVE'" value="RANK">同试卷竞赛排名</option></select></label></div><p class="tw-muted">绝对档位下界包含、上界不包含，最高合法分包含。相对档位填写累计比例区间（0—1），例如 0—0.2、0.2—0.5。</p><div v-for="(b,index) in rule.bands" :key="index" class="tw-scope"><label>等级<input v-model="b.label" required maxlength="16"/></label><label>下界<input v-model.number="b.lowerValue" type="number" required step="0.0001"/></label><label>上界<input v-model.number="b.upperValue" type="number" required step="0.0001"/></label><button type="button" class="tw-button danger" @click="rule.bands.splice(index,1)">移除</button></div><button type="button" class="tw-button" :disabled="rule.bands.length>=20" @click="rule.bands.push({label:'',lowerValue:0,upperValue:0})">新增档位</button><div v-if="dialogError" class="tw-alert is-error" role="alert">{{dialogError}}</div></form><template #footer><button class="tw-button" @click="ruleOpen=false">取消</button><button form="rule-create" class="tw-button primary" :disabled="busy">保存规则草稿</button></template></TeachingDialog>
<TeachingDialog :open="freezeOpen" title="冻结或更正参评名单" :busy="busy" @close="freezeOpen=false"><p>将固定当前考试同届次年级的全部学生、行政班与修读集合；未选课学生保留在主名单。已有名单与旧结果不覆盖。</p><label v-if="assessment?.status!=='DRAFT'">更正原因 *<textarea v-model="reason" maxlength="500"/></label><div v-if="dialogError" class="tw-alert is-error">{{dialogError}}</div><template #footer><button class="tw-button" @click="freezeOpen=false">取消</button><button class="tw-button primary" :disabled="busy||(assessment?.status!=='DRAFT'&&!reason.trim())" @click="freeze">确认冻结</button></template></TeachingDialog>
<TeachingDialog :open="resultOpen" title="构建固定输入的结果版本" :busy="busy" @close="resultOpen=false"><label>首次或更正原因 *<textarea v-model="reason" maxlength="500"/></label><p>按现有合法成绩建立排名。缺分仅影响对应学生报告，不阻止其他学生；所有科目构建成功后新版本才可用于生成。</p><div v-if="dialogError" class="tw-alert is-error">{{dialogError}}</div><template #footer><button class="tw-button" @click="resultOpen=false">取消</button><button class="tw-button primary" :disabled="busy||!reason.trim()" @click="buildVersion">提交后台构建</button></template></TeachingDialog>
<TeachingDialog :open="importOpen" title="成绩导入预检" :busy="busy" wide @close="importOpen=false"><p>可导入 {{importPreview?.count||0}} 项。预检令牌 15 分钟内有效，提交时会再次校验名单与成绩版本。</p><ul v-if="importPreview?.errors.length"><li v-for="e in importPreview.errors" :key="e.row">第 {{e.row}} 行 · {{e.studentNo}}：{{e.message}}</li></ul><p v-else>全部数据格式及范围校验通过。</p><div v-if="dialogError" class="tw-alert is-error">{{dialogError}}</div><template #footer><button class="tw-button" @click="importOpen=false">取消</button><button class="tw-button primary" :disabled="busy||!importPreview?.valid" @click="commitImport">确认整批导入</button></template></TeachingDialog>
<TeachingDialog :open="!!voidEntry" title="逻辑作废该成绩？" :busy="busy" @close="voidEntry=null"><p>{{voidEntry?.name}} 的当前成绩将退出后续有效结果，历史成绩与报告快照保留。相关对外报告同时撤回；恢复时需重新保存并构建更正版本。</p><template #footer><button class="tw-button" @click="voidEntry=null">取消</button><button class="tw-button danger" :disabled="busy" @click="voidScore">确认作废</button></template></TeachingDialog>
</section></template>
