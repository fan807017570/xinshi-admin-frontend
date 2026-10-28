<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { teachingGet, teachingPost, teachingDownload, requestKey, errorMessage, type Assessment, type Version, type ReportJob, type ReportItem, type ReportCandidate, type Attempt } from '../../api/teaching';
import { useTeachingScope } from './useTeaching';
import TeachingScope from './TeachingScope.vue';
import TeachingDialog from './TeachingDialog.vue';
const { classId, termId, currentClass } = useTeachingScope(true);
const assessments = ref<Assessment[]>([]), versions = ref<Version[]>([]), assessmentId = ref(''), versionId = ref(''), jobId = ref(''), jobs = ref<ReportJob[]>([]), job = ref<ReportJob | null>(null), candidates = ref<ReportCandidate[]>([]);
const loading = ref(false), busy = ref(false), error = ref(''), success = ref(''), keyword = ref(''), filter = ref('ALL'), page = ref(1), selected = ref<string[]>([]);
const createOpen = ref(false), createKey = ref(''), cancelOpen = ref(false), retryOpen = ref(false), retryKind = ref<'recheck' | 'retry' | 'correct'>('retry'), detailItem = ref<ReportItem | null>(null), attempts = ref<Attempt[]>([]), detailsLoading = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined, sequence = 0;
let disposed = false;
const active = computed(() => !!job.value && ['QUEUED', 'RUNNING', 'CANCELING'].includes(job.value.status));
const targetCount = computed(() => job.value?.totalCount ?? candidates.value.length), readyCount = computed(() => job.value?.readyCount ?? candidates.value.filter(c => c.ready).length);
const statusLabels: Record<string, string> = { PENDING: '待处理', CHECKING: '校验中', BLOCKED: '资料待补', READY: '已就绪', GENERATING: '生成中', SUCCEEDED: '文件已生成', FAILED: '技术失败', CANCELED: '已取消', QUEUED: '等待后台处理', RUNNING: '后台处理中', CANCELING: '正在停止领取', COMPLETED_WITH_ISSUES: '本轮完成，存在待处理项' };
const allRows = computed<ReportItem[]>(() => job.value?.items ?? candidates.value.map(c => ({ id: c.studentId, studentId: c.studentId, name: c.name, studentNo: c.studentNo, status: 'PENDING', resultVersionId: versionId.value, readiness: c, attemptCount: 0, errorCode: null, errorMessage: null, reportId: null, fileAvailable: false, publicationStatus: 1 })));
const filtered = computed(() => allRows.value.filter(item => (filter.value === 'ALL' || (filter.value === 'PROBLEM' ? ['BLOCKED', 'FAILED', 'READY'].includes(item.status) : item.status === filter.value)) && (!keyword.value || [item.name, item.studentNo].some(s => s.includes(keyword.value.trim())))));
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / 8))), visible = computed(() => filtered.value.slice((page.value - 1) * 8, page.value * 8));
watch(classId, () => { selected.value = []; job.value = null; jobId.value = ''; void loadScope(); }, { immediate: true });
watch(assessmentId, () => { selected.value = []; void loadAssessment(); });
watch(versionId, () => {
    if (!jobId.value)
        void preview();
});
watch(jobId, () => {
    selected.value = [];
    if (jobId.value)
        void refreshJob();
    else {
        job.value = null;
        void preview();
    }
});
watch([filter, keyword], () => page.value = 1);
onUnmounted(() => { disposed = true; clearTimeout(timer); });
async function loadScope() {
    if (!classId.value)
        return;
    loading.value = true;
    error.value = '';
    clearTimeout(timer);
    const current = ++sequence;
    try {
        const [a, j] = await Promise.all([teachingGet<Assessment[]>('/assessments', { classId: classId.value }), teachingGet<ReportJob[]>('/report-jobs', { classId: classId.value })]);
        if (current !== sequence)
            return;
        assessments.value = a;
        jobs.value = j;
        assessmentId.value = a[0]?.id || '';
        await loadAssessment();
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
        versions.value = [];
        candidates.value = [];
        return;
    }
    try {
        const detail = await teachingGet<Assessment>(`/assessments/${assessmentId.value}`, { classId: classId.value });
        termId.value = detail.termId;
        versions.value = (detail.versions || []).filter(v => v.status === 'FROZEN');
        versionId.value = versions.value[0]?.id || '';
        jobId.value = jobs.value.find(j => j.assessmentId === assessmentId.value)?.id || '';
        if (jobId.value)
            await refreshJob();
        else
            await preview();
    }
    catch (e) {
        error.value = errorMessage(e);
    }
}
async function preview() {
    if (!assessmentId.value || !versionId.value) {
        candidates.value = [];
        return;
    }
    try {
        const result = await teachingGet<{
            students: ReportCandidate[];
        }>('/report-previews', { assessmentId: assessmentId.value, resultVersionId: versionId.value, classId: classId.value });
        candidates.value = result.students;
    }
    catch (e) {
        error.value = errorMessage(e);
    }
}
async function refreshJob() {
    clearTimeout(timer);
    if (!jobId.value)
        return;
    const id = jobId.value;
    try {
        const result = await teachingGet<ReportJob>(`/report-jobs/${id}`);
        if (id !== jobId.value || disposed)
            return;
        job.value = result;
        if (['QUEUED', 'RUNNING', 'CANCELING'].includes(result.status))
            timer = setTimeout(() => void refreshJob(), 2000);
    }
    catch (e) {
        error.value = errorMessage(e);
    }
}
async function openCreate() {
    busy.value = true;
    error.value = '';
    try {
        await preview();
        createKey.value = requestKey();
        createOpen.value = true;
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
async function create() {
    busy.value = true;
    error.value = '';
    try {
        const result = await teachingPost<{
            id: string;
        }>('/report-jobs', { assessmentId: assessmentId.value, resultVersionId: versionId.value, classId: classId.value, requestKey: createKey.value, ...(job.value?.status === 'CANCELED' ? { continuedFromJobId: job.value.id } : {}) });
        createOpen.value = false;
        jobId.value = result.id;
        jobs.value = await teachingGet<ReportJob[]>('/report-jobs', { classId: classId.value });
        await refreshJob();
        success.value = '班级任务已提交。关闭页面后，后台仍会继续处理。';
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
function canSelect(item: ReportItem) { return !!job.value && !active.value && (['BLOCKED', 'FAILED', 'READY'].includes(item.status) || (item.status === 'SUCCEEDED' && (!item.fileAvailable || item.resultVersionId !== versionId.value))); }
function toggle(id: string) { selected.value = selected.value.includes(id) ? selected.value.filter(i => i !== id) : [...selected.value, id]; }
async function retry() {
    if (!job.value)
        return;
    busy.value = true;
    error.value = '';
    try {
        const result = await teachingPost(`/report-jobs/${job.value.id}/${retryKind.value === 'recheck' ? 'recheck' : 'retry'}`, { requestKey: requestKey(), items: job.value.items.filter(i => selected.value.includes(i.id)).map(i => ({ id: i.id, resultVersionId: versionId.value })), correctSuccessful: retryKind.value === 'correct' });
        void result;
        retryOpen.value = false;
        selected.value = [];
        success.value = '处理命令已持久化，后台开始新一轮处理。';
        await refreshJob();
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
async function cancel() {
    if (!job.value)
        return;
    busy.value = true;
    try {
        await teachingPost(`/report-jobs/${job.value.id}/cancel`);
        cancelOpen.value = false;
        await refreshJob();
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
async function showDetails(item: ReportItem) {
    detailItem.value = item;
    attempts.value = [];
    if (!job.value)
        return;
    detailsLoading.value = true;
    try {
        attempts.value = await teachingGet<Attempt[]>(`/report-items/${item.id}/attempts`);
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        detailsLoading.value = false;
    }
}
async function download(kind: 'issues' | 'archive') {
    if (!job.value)
        return;
    busy.value = true;
    try {
        await teachingDownload(`/report-jobs/${job.value.id}/${kind}`, `班级任务-${job.value.id}.${kind === 'archive' ? 'zip' : 'csv'}`);
        success.value = '下载已开始。';
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
async function downloadReport(item: ReportItem) {
    try {
        await teachingDownload(`/reports/${item.reportId}/file`, `${item.name}-${item.reportId}.pdf`);
    }
    catch (e) {
        error.value = errorMessage(e);
    }
}
async function publish(item: ReportItem) {
    busy.value = true;
    try {
        await teachingPost(`/reports/${item.reportId}/publication`, { publicationVersion: item.publicationVersion, withdraw: item.publicationStatus === 2 });
        await refreshJob();
        success.value = item.publicationStatus === 2 ? '报告已撤回。' : '报告已发布。';
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
function prepareRetry(kind: 'recheck' | 'retry' | 'correct') { retryKind.value = kind; retryOpen.value = true; }
</script>
<template><section><header class="tw-head"><div><h2>班级成绩单生成任务</h2><p>目标名单固定；逐生校验、生成与记录失败。处理进度和文件覆盖率分别计算。</p></div><div class="tw-actions"><button v-if="active" class="tw-button danger" :disabled="busy||job?.status==='CANCELING'" @click="cancelOpen=true">停止后台处理</button><button class="tw-button primary" :disabled="busy||!versionId||active" @click="openCreate">{{job?.status==='CANCELED'?'创建关联继续任务':'创建班级任务'}}</button></div></header>
<TeachingScope manage-only v-model:class-id="classId" v-model:term-id="termId" :show-term="false"><label>考试实例<select v-model="assessmentId"><option value="" disabled>请选择考试</option><option v-for="a in assessments" :key="a.id" :value="a.id">{{a.name}}</option></select></label><label>本次处理依据<select v-model="versionId" :disabled="!!active"><option value="" disabled>请选择冻结结果版本</option><option v-for="v in versions" :key="v.id" :value="v.id">V{{v.versionNo}} · 名单 V{{v.rosterVersion}}</option></select></label></TeachingScope>
<div v-if="error" class="tw-alert is-error" role="alert">{{error}} <button @click="loadScope">重新加载</button></div><div v-if="success" class="tw-alert" role="status">{{success}}</div>
<div v-if="loading" class="tw-loading" aria-busy="true">正在核对名单与任务…</div><div v-else-if="!versionId" class="tw-empty"><h3>尚无冻结结果版本</h3><p>先建立考试、冻结参评名单并构建等级结果，再为班级生成报告。</p><RouterLink class="tw-button" :to="{path:'/teaching/assessments',query:{classId,termId}}">前往考试与等级</RouterLink></div><template v-else>
<div class="tw-metrics"><div><span>学生资料完整度</span><strong>{{targetCount?`${readyCount}/${targetCount}`:'无参评学生'}}</strong><small>选课、合法成绩与等级规则齐备</small><progress :max="targetCount||1" :value="readyCount" aria-label="学生资料完整度"/></div><div><span>本轮任务处理</span><strong>{{job?`${job.processedCount}/${targetCount}`:'尚未创建'}}</strong><small>已处理或明确阻塞</small><progress :max="targetCount||1" :value="job?.processedCount||0" aria-label="任务处理进度"/></div><div><span>可用文件覆盖率</span><strong>{{job?`${job.successCount}/${targetCount}`:'尚未创建'}}</strong><small>仅计入成功且文件可用的学生</small><progress :max="targetCount||1" :value="job?.successCount||0" aria-label="成绩单覆盖率"/></div></div>
<div class="tw-scope"><label>任务记录<select v-model="jobId"><option value="">创建前预检</option><option v-for="j in jobs.filter(j=>j.assessmentId===assessmentId)" :key="j.id" :value="j.id">#{{j.id}} · {{statusLabels[j.status]||j.status}} · {{j.createdAt}}</option></select></label><p v-if="job" class="tw-muted">任务 #{{job.id}} · 第 {{job.roundNo}} 轮 · {{statusLabels[job.status]||job.status}}<span v-if="job.continuedFromJobId"> · 继续自 #{{job.continuedFromJobId}}</span></p></div>
<div v-if="!targetCount" class="tw-empty">无参评学生。当前冻结名单在此班级中没有学生，不创建空任务。</div><template v-else><div class="tw-head"><label>查找学生<input v-model="keyword" type="search" placeholder="姓名或学号"/></label><div class="tw-actions"><button v-if="job" class="tw-button" :disabled="busy" @click="download('issues')">当前 / 历史失败 CSV</button><button v-if="job" class="tw-button" :disabled="busy" @click="download('archive')">成功文件与全量清单 ZIP</button></div></div>
<nav class="tw-filters" aria-label="任务状态筛选"><button v-for="choice in [{id:'ALL',name:'全部'},{id:'PROBLEM',name:'未成功'},{id:'BLOCKED',name:'资料待补'},{id:'FAILED',name:'技术失败'},{id:'SUCCEEDED',name:'已生成'},{id:'CANCELED',name:'已取消'}]" :key="choice.id" :class="{active:filter===choice.id}" @click="filter=choice.id">{{choice.name}}</button></nav>
<div v-if="job&&!active&&job.status!=='CANCELED'" class="tw-head"><p>{{selected.length}} 项已选 · 新依据不会自动替换原成功文件。</p><div class="tw-actions"><button class="tw-button" :disabled="!selected.length||busy" @click="prepareRetry('recheck')">重新校验选中项</button><button class="tw-button primary" :disabled="!selected.length||busy" @click="prepareRetry('retry')">仅重试选中未成功项</button><button class="tw-button" :disabled="!selected.length||busy" @click="prepareRetry('correct')">更正生成选中成功项</button></div></div>
<div class="tw-table-wrap"><table class="tw-table"><thead><tr><th>选择</th><th>学生</th><th>成绩完成</th><th>等级 / 评语</th><th>最近问题</th><th>任务状态 / 依据</th><th>操作</th></tr></thead><tbody><tr v-for="item in visible" :key="item.id"><td><input type="checkbox" :aria-label="`选择 ${item.name} 任务`" :disabled="!canSelect(item)" :checked="selected.includes(item.id)" @change="toggle(item.id)"/></td><td><strong>{{item.name}}</strong><small>{{item.studentNo}}</small></td><td>{{item.readiness.selectionReady?`${item.readiness.scoreCount}/${item.readiness.subjectCount} 科`:'待确认选课'}}</td><td>{{item.readiness.ruleReady?'规则可用':'规则待补'}}<small>评语：{{item.readiness.commentState}}（可选）</small></td><td>{{item.errorMessage||item.readiness.issues.map(i=>i.message).join('；')||'—'}}</td><td><span class="tw-badge" :class="item.status==='SUCCEEDED'&&item.fileAvailable?'good':['BLOCKED','FAILED'].includes(item.status)?'problem':''">{{statusLabels[item.status]||item.status}}</span><small>结果 #{{item.resultVersionId}} · 尝试 {{item.attemptCount}} 次</small><small v-if="item.status==='SUCCEEDED'&&!item.fileAvailable">文件不可用，需重新生成</small><small v-if="item.status==='SUCCEEDED'&&item.resultVersionId!==versionId">有不同处理依据，可显式更正</small></td><td><button class="tw-link" @click="showDetails(item)">详情 / 历史</button><button v-if="item.fileAvailable" class="tw-link" @click="downloadReport(item)">下载 PDF</button><button v-if="item.fileAvailable" class="tw-link" :disabled="busy" @click="publish(item)">{{item.publicationStatus===2?'撤回发布':'发布报告'}}</button><RouterLink v-if="item.status==='BLOCKED'" class="tw-link" :to="{path:'/teaching/assessments',query:{classId,assessmentId,termId}}">去补录</RouterLink></td></tr><tr v-if="!visible.length"><td colspan="7">没有符合当前筛选的学生。</td></tr></tbody></table></div><footer class="tw-pagination"><span>共 {{filtered.length}} 人</span><div class="tw-actions"><button class="tw-button" :disabled="page===1" @click="page--">上一页</button><span>{{page}} / {{pages}}</span><button class="tw-button" :disabled="page===pages" @click="page++">下一页</button></div></footer></template></template>
<TeachingDialog :open="createOpen" title="创建固定名单班级任务" :busy="busy" @close="createOpen=false"><p>{{currentClass?.name}} · {{assessments.find(a=>a.id===assessmentId)?.name}}</p><p>目标 {{candidates.length}} 人；资料完整 {{candidates.filter(c=>c.ready).length}} 人。资料缺项学生仍保留在目标中，并独立记录失败。</p><p class="tw-muted">创建后后台持续处理；关闭页面不会停止任务。任务和每份报告都记录确定的结果版本。</p><div v-if="error" class="tw-alert is-error">{{error}}</div><template #footer><button class="tw-button" @click="createOpen=false">返回预检</button><button class="tw-button primary" :disabled="busy||!candidates.length" @click="create">确认创建</button></template></TeachingDialog>
<TeachingDialog :open="cancelOpen" title="停止领取新的学生任务？" :busy="busy" @close="cancelOpen=false"><p>已领取的学生处理完毕后结束；成功文件保留。取消后的任务不可恢复，继续时会创建关联的新任务。</p><template #footer><button class="tw-button" @click="cancelOpen=false">继续处理</button><button class="tw-button danger" :disabled="busy" @click="cancel">确认停止</button></template></TeachingDialog>
<TeachingDialog :open="retryOpen" :title="retryKind==='recheck'?'重新校验选中项':retryKind==='correct'?'确认更正生成':'仅重试选中项'" :busy="busy" @close="retryOpen=false"><p>将处理 {{selected.length}} 项，使用结果版本 #{{versionId}}。其他学生任务项保持当前状态；历史报告和失败原因继续保留。</p><p v-if="retryKind==='correct'" class="tw-alert is-warning">只有显式选中的成功项且选择不同结果版本，才会新增更正报告。</p><div v-if="error" class="tw-alert is-error">{{error}}</div><template #footer><button class="tw-button" @click="retryOpen=false">取消</button><button class="tw-button primary" :disabled="busy" @click="retry">提交处理命令</button></template></TeachingDialog>
<TeachingDialog :open="!!detailItem" :title="`${detailItem?.name||''} · 任务历史`" wide @close="detailItem=null"><template v-if="detailItem"><p>当前结果依据 #{{detailItem.resultVersionId}} · {{statusLabels[detailItem.status]}}</p><ul><li v-for="issue in detailItem.readiness.issues" :key="issue.message">{{issue.message}}</li></ul><div v-if="detailsLoading" aria-busy="true">正在读取历史…</div><div v-for="attempt in attempts" :key="attempt.id" class="tw-history"><strong>第 {{attempt.attemptNo}} 次 · {{attempt.kind==='VERIFY'?'重新校验':'生成'}} · 结果 #{{attempt.resultVersionId}} · {{statusLabels[attempt.status]||attempt.status}}</strong><p class="tw-muted">{{attempt.startedAt}} — {{attempt.finishedAt||'处理中'}}</p><p v-for="issue in attempt.issues" :key="issue.id">{{issue.message}} <span class="tw-badge">{{issue.recoveryStatus==='RECOVERED'?'已恢复':issue.recoveryStatus==='DATA_FIXED'?'资料已补齐':'待处理'}}</span></p></div><p v-if="!attempts.length&&!detailsLoading" class="tw-muted">尚无执行尝试。</p></template></TeachingDialog>
</section></template>
