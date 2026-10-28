<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { teachingGet, teachingPost, teachingRequest, teachingDownload, errorMessage, type Article, type ArticleSummary, type ArticleBlock, type ResearchThread, type ResearchMessage, type Anchor, type ExportJob } from '../../api/teaching';
import { useTeaching } from './useTeaching';
import { videoPoster } from './videoPoster';
import TeachingDialog from './TeachingDialog.vue';
import ResearchMedia from './ResearchMedia.vue';
const { metadata } = useTeaching(), route = useRoute(), router = useRouter();
const categories = [{ id: 'CHINESE', name: '语文' }, { id: 'MATH', name: '数学' }, { id: 'FOREIGN', name: '外语' }, { id: 'HUMANITIES', name: '文科综合' }, { id: 'SCIENCE', name: '理科综合' }];
const list = ref<ArticleSummary[]>([]), keyword = ref(''), category = ref(''), mine = ref(false), page = ref(1), article = ref<Article | null>(null), editing = ref(false), loading = ref(false), busy = ref(false), error = ref(''), success = ref('');
const editor = reactive({ title: '', category: 'CHINESE', blocks: [] as ArticleBlock[] }), dirty = ref(false), saving = ref(false), saveState = ref('已保存'), localVersion = ref(1), undoStack = ref<string[]>([]);
const suggestions = ref<{
    blockId: string;
    start: number;
    end: number;
    original: string;
    replacement: string;
    documentVersion: number;
}[]>([]), selection = ref<Anchor | null>(null), activeAnchor = ref('');
const messageOpen = ref(false), messageText = ref(''), messageError = ref(''), messageKind = ref<'ARTICLE' | 'TEXT' | 'MEDIA' | 'REPLY' | 'EDIT'>('ARTICLE'), threadTarget = ref<ResearchThread | null>(null), messageTarget = ref<ResearchMessage | null>(null), anchor = ref<Anchor | null>(null), withdrawTarget = ref<ResearchMessage | null>(null);
const publishOpen = ref(false), exportOpen = ref(false), exportFormat = ref('PDF'), includeAnnotations = ref(false), exports = ref<ExportJob[]>([]), exportJob = ref<ExportJob | null>(null);
let proofTimer: ReturnType<typeof setTimeout> | undefined;
const ignoredSuggestions = new Set<string>();
let saveTimer: ReturnType<typeof setTimeout> | undefined, exportTimer: ReturnType<typeof setTimeout> | undefined;
let disposed = false;
const readablePublished = computed(() => article.value?.revision.status === 'PUBLISHED'), isAuthor = computed(() => article.value?.isAuthor);
onMounted(async () => {
    await loadList();
    if (route.query.articleId)
        await openArticle(String(route.query.articleId), route.query.revisionId ? String(route.query.revisionId) : undefined);
});
function beforeUnload(event: BeforeUnloadEvent) {
    if (editing.value && dirty.value) {
        event.preventDefault();
        event.returnValue = '';
    }
}
window.addEventListener('beforeunload', beforeUnload);
onBeforeRouteLeave(async () => !editing.value || !dirty.value || await save());
onUnmounted(() => { disposed = true; clearTimeout(saveTimer); clearTimeout(exportTimer); clearTimeout(proofTimer); window.removeEventListener('beforeunload', beforeUnload); });
async function loadList() {
    loading.value = true;
    error.value = '';
    try {
        list.value = await teachingGet<ArticleSummary[]>('/research/articles', { keyword: keyword.value, category: category.value, mine: mine.value, page: page.value });
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        loading.value = false;
    }
}
async function openArticle(id: string, revisionId?: string, draft = false) {
    if (editing.value && dirty.value && !await save())
        return;
    loading.value = true;
    error.value = '';
    try {
        article.value = await teachingGet<Article>(`/research/articles/${id}`, { revisionId, draft });
        editing.value = false;
        selection.value = null;
        suggestions.value = [];
        await router.replace({ query: { ...route.query, articleId: id, revisionId: article.value.revision.id } });
        await loadExports();
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        loading.value = false;
    }
}
async function back() {
    if (editing.value && dirty.value && !await save())
        return;
    article.value = null;
    editing.value = false;
    await router.replace({ query: { classId: route.query.classId, termId: route.query.termId } });
    await loadList();
}
async function create() {
    busy.value = true;
    error.value = '';
    try {
        article.value = await teachingPost<Article>('/research/articles', { category: category.value || 'CHINESE' });
        await startEdit();
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
function applyDraft() {
    if (!article.value)
        return;
    editor.title = article.value.revision.title;
    editor.category = article.value.revision.category;
    editor.blocks = JSON.parse(JSON.stringify(article.value.revision.content.blocks));
    if (!editor.blocks.length)
        editor.blocks.push({ id: crypto.randomUUID(), type: 'paragraph', text: '' });
    dirty.value = false;
    saveState.value = '已保存';
    editing.value = true;
    suggestions.value = [];
    undoStack.value = [];
}
async function startEdit() {
    if (!article.value?.isAuthor)
        return;
    busy.value = true;
    error.value = '';
    try {
        if (article.value.draftRevisionId)
            article.value = await teachingGet<Article>(`/research/articles/${article.value.id}`, { draft: true });
        else
            article.value = await teachingRequest<Article>('put', `/research/articles/${article.value.id}/draft`, { title: article.value.revision.title, category: article.value.revision.category, content: article.value.revision.content, articleVersion: article.value.editVersion }, undefined, { 'If-Match': String(article.value.revision.editVersion) });
        applyDraft();
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
function changed() { dirty.value = true; localVersion.value++; saveState.value = '待保存'; clearTimeout(saveTimer); saveTimer = setTimeout(() => void save(), 1000); clearTimeout(proofTimer); proofTimer = setTimeout(() => void proofread(true), 1600); }
function mutate(change: () => void) {
    undoStack.value.push(JSON.stringify(editor));
    if (undoStack.value.length > 30)
        undoStack.value.shift();
    change();
    changed();
}
function undo() {
    const previous = undoStack.value.pop();
    if (previous) {
        Object.assign(editor, JSON.parse(previous));
        changed();
        suggestions.value = [];
    }
}
async function save(): Promise<boolean> {
    if (!article.value || !dirty.value)
        return true;
    if (saving.value) {
        saveState.value = '等待当前保存完成';
        return false;
    }
    clearTimeout(saveTimer);
    saving.value = true;
    saveState.value = '保存中…';
    const captured = JSON.stringify(editor);
    try {
        const updated = await teachingRequest<Article>('put', `/research/articles/${article.value.id}/draft`, { ...JSON.parse(captured), content: { blocks: JSON.parse(captured).blocks }, articleVersion: article.value.editVersion }, undefined, { 'If-Match': String(article.value.revision.editVersion) });
        article.value = updated;
        if (JSON.stringify(editor) === captured) {
            dirty.value = false;
            saveState.value = '已保存';
        }
        else {
            saveState.value = '有更新，等待保存';
            saveTimer = setTimeout(() => void save(), 500);
        }
        return !dirty.value;
    }
    catch (e) {
        error.value = errorMessage(e);
        saveState.value = '保存失败，本地内容已保留';
        return false;
    }
    finally {
        saving.value = false;
    }
}
function addBlock(type: ArticleBlock['type']) { mutate(() => editor.blocks.push({ id: crypto.randomUUID(), type, ...(type === 'table' ? { rows: [{ text: '列一 | 列二' }, { text: '内容 | 内容' }] } : type === 'link' ? { text: '', href: 'https://' } : { text: '' }) })); }
function move(index: number, direction: number) {
    if (index + direction < 0 || index + direction >= editor.blocks.length)
        return;
    mutate(() => { const [block] = editor.blocks.splice(index, 1); editor.blocks.splice(index + direction, 0, block); });
}
async function upload(event: Event, kind: 'image' | 'video') {
    const input = event.target as HTMLInputElement, file = input.files?.[0];
    if (!file)
        return;
    busy.value = true;
    try {
        const data = new FormData();
        data.append('file', file);
        const media = await teachingPost<{
            id: string;
        }>('/research/media', data);
        const block: ArticleBlock = { id: crypto.randomUUID(), type: kind, assetId: media.id, title: file.name };
        if (kind === 'video') {
            try {
                const poster = await videoPoster(file), posterData = new FormData();
                posterData.append('file', poster, 'video-cover.jpg');
                block.posterAssetId = (await teachingPost<{
                    id: string;
                }>('/research/media', posterData)).id;
            }
            catch (e) {
                success.value = errorMessage(e) + '；视频保存在工作稿中，发布前请补齐封面。';
            }
        }
        mutate(() => editor.blocks.push(block));
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
        input.value = '';
    }
}
async function uploadPoster(event: Event, block: ArticleBlock) {
    const input = event.target as HTMLInputElement, file = input.files?.[0];
    if (!file)
        return;
    busy.value = true;
    try {
        const data = new FormData();
        data.append('file', file);
        const result = await teachingPost<{
            id: string;
        }>('/research/media', data);
        mutate(() => block.posterAssetId = result.id);
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
        input.value = '';
    }
}
async function proofread(silent = false) {
    if (!silent) {
        busy.value = true;
        error.value = '';
    }
    const version = localVersion.value;
    try {
        const result = await teachingPost<{
            suggestions: typeof suggestions.value;
            message: string;
        }>('/research/proofread', { documentVersion: version, blocks: editor.blocks.filter(b => b.text).map(b => ({ id: b.id, text: b.text })) });
        if (version !== localVersion.value)
            return;
        suggestions.value = result.suggestions.filter(s => !ignoredSuggestions.has(`${s.blockId}:${s.start}:${s.original}`));
        if (!silent)
            success.value = result.suggestions.length ? result.message : '本次常见用词检查未发现建议。';
    }
    catch (e) {
        if (!silent)
            error.value = errorMessage(e);
    }
    finally {
        if (!silent)
            busy.value = false;
    }
}
function ignoreSuggestion(index: number) { const s = suggestions.value[index]; ignoredSuggestions.add(`${s.blockId}:${s.start}:${s.original}`); suggestions.value.splice(index, 1); }
function acceptSuggestion(index: number) {
    const suggestion = suggestions.value[index], block = editor.blocks.find(b => b.id === suggestion.blockId);
    if (!block || suggestion.documentVersion !== localVersion.value || block.text?.slice(suggestion.start, suggestion.end) !== suggestion.original) {
        error.value = '正文已变化，请重新检查；该建议未修改任何内容。';
        return;
    }
    mutate(() => block.text = block.text!.slice(0, suggestion.start) + suggestion.replacement + block.text!.slice(suggestion.end));
    suggestions.value = [];
}
async function publish() {
    if (!article.value || !await save())
        return;
    busy.value = true;
    error.value = '';
    try {
        article.value = await teachingPost<Article>(`/research/articles/${article.value.id}/publish`, { articleVersion: article.value.editVersion, editVersion: article.value.revision.editVersion });
        editing.value = false;
        publishOpen.value = false;
        success.value = '新版本已发布，读者现在看到此版本；旧版本批注保持原处。';
        await loadExports();
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
async function like() {
    if (!article.value)
        return;
    busy.value = true;
    try {
        const result = await teachingRequest<{
            liked: boolean;
            likes: number;
        }>(article.value.liked ? 'delete' : 'put', `/research/articles/${article.value.id}/like`);
        article.value.liked = result.liked;
        article.value.likes = result.likes;
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
function captureSelection(block: ArticleBlock, event: MouseEvent) {
    if (!readablePublished.value)
        return;
    const selected = window.getSelection();
    if (!selected || selected.isCollapsed || !selected.rangeCount) {
        selection.value = null;
        return;
    }
    const element = event.currentTarget as HTMLElement, range = selected.getRangeAt(0);
    if (!element.contains(range.startContainer) || !element.contains(range.endContainer))
        return;
    const prefix = range.cloneRange();
    prefix.selectNodeContents(element);
    prefix.setEnd(range.startContainer, range.startOffset);
    const start = prefix.toString().length, end = start + range.toString().length;
    if (block.text?.slice(start, end) !== range.toString())
        return;
    selection.value = { blockId: block.id, start, end, quote: range.toString() };
}
function newMessage(kind: 'ARTICLE' | 'TEXT' | 'MEDIA', newAnchor?: Anchor) { messageKind.value = kind; anchor.value = newAnchor || null; messageText.value = ''; messageError.value = ''; messageOpen.value = true; }
function reply(thread: ResearchThread) { messageKind.value = 'REPLY'; threadTarget.value = thread; messageText.value = ''; messageError.value = ''; messageOpen.value = true; }
function editMessage(message: ResearchMessage) { messageKind.value = 'EDIT'; messageTarget.value = message; messageText.value = message.body || ''; messageError.value = ''; messageOpen.value = true; }
async function sendMessage() {
    if (!article.value)
        return;
    busy.value = true;
    messageError.value = '';
    try {
        if (messageKind.value === 'REPLY' && threadTarget.value)
            await teachingPost(`/research/threads/${threadTarget.value.id}/messages`, { body: messageText.value });
        else if (messageKind.value === 'EDIT' && messageTarget.value)
            await teachingRequest('patch', `/research/messages/${messageTarget.value.id}`, { body: messageText.value, editVersion: messageTarget.value.editVersion });
        else
            await teachingPost(`/research/articles/${article.value.id}/threads`, { kind: messageKind.value, body: messageText.value, revisionId: article.value.revision.id, anchor: anchor.value });
        messageOpen.value = false;
        await refreshArticle();
    }
    catch (e) {
        messageError.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
async function withdraw() {
    if (!withdrawTarget.value)
        return;
    busy.value = true;
    try {
        await teachingRequest('delete', `/research/messages/${withdrawTarget.value.id}`, { editVersion: withdrawTarget.value.editVersion });
        withdrawTarget.value = null;
        await refreshArticle();
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
async function threadState(thread: ResearchThread) {
    busy.value = true;
    try {
        await teachingRequest('patch', `/research/threads/${thread.id}`, { state: thread.state === 'OPEN' ? 'RESOLVED' : 'OPEN', editVersion: thread.editVersion });
        await refreshArticle();
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
async function refreshArticle() {
    if (article.value)
        article.value = await teachingGet<Article>(`/research/articles/${article.value.id}`, { revisionId: article.value.revision.id });
}
function locate(thread: ResearchThread) {
    const block = article.value?.revision.content.blocks.find(b => b.id === thread.anchor.blockId);
    if (!block || (thread.kind === 'TEXT' && block.text?.slice(thread.anchor.start, thread.anchor.end) !== thread.anchor.quote)) {
        error.value = '原引用无法定位，已保留批注原文，未高亮其他文字。';
        return;
    }
    activeAnchor.value = block.id;
    document.getElementById('research-block-' + block.id)?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
async function loadExports() {
    if (!article.value)
        return;
    exports.value = await teachingGet<ExportJob[]>(`/research/articles/${article.value.id}/exports`, { revisionId: article.value.revision.id });
}
async function startExport() {
    if (!article.value)
        return;
    if (editing.value && !await save())
        return;
    busy.value = true;
    try {
        const job = await teachingPost<ExportJob>(`/research/articles/${article.value.id}/exports`, { revisionId: article.value.revision.id, format: exportFormat.value, includeAnnotations: includeAnnotations.value });
        exportJob.value = job;
        await pollExport();
        await loadExports();
    }
    catch (e) {
        error.value = errorMessage(e);
    }
    finally {
        busy.value = false;
    }
}
async function pollExport() {
    clearTimeout(exportTimer);
    if (!exportJob.value || disposed)
        return;
    try {
        exportJob.value = await teachingGet<ExportJob>(`/research/exports/${exportJob.value.id}`);
        if (['QUEUED', 'RUNNING'].includes(exportJob.value.status))
            exportTimer = setTimeout(() => void pollExport(), 2000);
        else
            await loadExports();
    }
    catch (e) {
        error.value = errorMessage(e);
    }
}
async function downloadExport(job: ExportJob) {
    try {
        await teachingDownload(`/research/exports/${job.id}/file`, `${article.value?.revision.title || '教研文章'}-${job.id}.${job.format === 'PDF' ? 'pdf' : 'docx'}`);
    }
    catch (e) {
        error.value = errorMessage(e);
    }
}
async function retryExport(job: ExportJob) {
    try {
        await teachingPost(`/research/exports/${job.id}/retry`);
        exportJob.value = job;
        await pollExport();
    }
    catch (e) {
        error.value = errorMessage(e);
    }
}
function downloadLocal() { const blob = new Blob([JSON.stringify(editor, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = '教研本地工作稿.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
</script>
<template><section><header class="tw-head"><div><h2>老师教研</h2><p>私有工作稿与发布内容分开；正文仅作者可改，讨论与批注固定在原发布版本。</p></div><div class="tw-actions"><button v-if="article" class="tw-button" @click="back">返回文章列表</button><button v-else class="tw-button primary" :disabled="busy" @click="create">新建私有工作稿</button></div></header>
<div v-if="error" class="tw-alert is-error" role="alert">{{error}}</div><div v-if="success" class="tw-alert" role="status">{{success}}</div><div v-if="loading" class="tw-loading" aria-busy="true">正在读取教研内容…</div>
<template v-if="!article&&!loading"><form class="tw-scope" @submit.prevent="page=1;loadList()"><label>查找文章<input v-model="keyword" type="search" maxlength="100" placeholder="标题或正文关键词"/></label><label>分类<select v-model="category"><option value="">全部分类</option><option v-for="c in categories" :key="c.id" :value="c.id">{{c.name}}</option></select></label><label class="tw-checkbox"><input v-model="mine" type="checkbox"/>只看本人文章 / 工作稿</label><button class="tw-button primary">查询</button><button type="button" class="tw-button" @click="keyword='';category='';mine=false;page=1;loadList()">重置</button></form><div v-if="!list.length" class="tw-empty"><h3>没有符合条件的文章</h3><p>调整筛选条件，或创建自己的私有工作稿。</p></div><div class="tw-article-list"><article v-for="item in list" :key="item.id"><div><span class="tw-badge">{{categories.find(c=>c.id===item.category)?.name}}</span> <span class="tw-badge" :class="item.status==='DRAFT'?'private':'good'">{{item.status==='DRAFT'?'本人私有工作稿':'已发布'}}</span><h3><button class="tw-link" style="font-size:inherit;text-align:left" @click="openArticle(item.id,item.revisionId,item.status==='DRAFT')">{{item.title||'未命名工作稿'}}</button></h3><p class="tw-muted">{{item.authorName}} · V{{item.revisionNo}} · {{item.updatedAt}}</p></div><p class="tw-muted">{{item.likes}} 人点赞</p></article></div><footer class="tw-pagination"><button class="tw-button" :disabled="page===1" @click="page--;loadList()">上一页</button><span>第 {{page}} 页</span><button class="tw-button" :disabled="list.length<30" @click="page++;loadList()">下一页</button></footer></template>
<template v-if="article&&!loading"><div class="tw-head"><div class="tw-actions"><span class="tw-badge" :class="article.revision.status==='DRAFT'?'private':'good'">{{article.revision.status==='DRAFT'?'仅本人可读的工作稿':'发布版本 V'+article.revision.revisionNo}}</span><span class="tw-muted">作者：{{article.authorName}}</span></div><div class="tw-actions"><template v-if="editing"><span role="status" class="tw-muted">{{saveState}}</span><button class="tw-button" :disabled="saving||!dirty" @click="save">立即保存</button><button class="tw-button primary" :disabled="saving||busy||!editor.title.trim()" @click="publishOpen=true">检查并发布</button></template><button v-else-if="isAuthor" class="tw-button primary" :disabled="busy" @click="startEdit">{{article.draftRevisionId?'继续本人工作稿':'编辑为私有新版本'}}</button><button class="tw-button" @click="exportOpen=true;loadExports()">PDF / Word 导出</button></div></div>
<template v-if="editing"><div class="tw-paper"><div class="tw-form-grid"><label>文章标题 *<input v-model="editor.title" maxlength="200" @input="changed"/></label><label>固定分类<select v-model="editor.category" @change="changed"><option v-for="c in categories" :key="c.id" :value="c.id">{{c.name}}</option></select></label></div><div class="tw-actions tw-section"><button class="tw-button" @click="addBlock('paragraph')">段落</button><button class="tw-button" @click="addBlock('heading')">标题</button><button class="tw-button" @click="addBlock('list')">列表</button><button class="tw-button" @click="addBlock('table')">表格</button><button class="tw-button" @click="addBlock('link')">链接</button><label class="tw-button">插入图片<input type="file" accept="image/png,image/jpeg" :disabled="busy" @change="upload($event,'image')"/></label><label class="tw-button">插入视频<input type="file" accept="video/mp4,video/webm" :disabled="busy" @change="upload($event,'video')"/></label><button class="tw-button" :disabled="!undoStack.length" @click="undo">撤销内容操作</button><button class="tw-button" :disabled="busy" @click="proofread(false)">常见用词检查</button></div><p class="tw-muted">每个内容块保留稳定标识，批注据此定位原发布版本。工作稿自动保存；发生版本冲突时保留本地内容。</p><div v-for="(block,index) in editor.blocks" :key="block.id" class="tw-editor-block"><div class="tw-actions"><strong>{{ {paragraph:'段落',heading:'标题',list:'列表',table:'表格',image:'图片',video:'视频',link:'链接'}[block.type] }} {{index+1}}</strong><div><button class="tw-link" :disabled="index===0" @click="move(index,-1)">上移</button><button class="tw-link" :disabled="index===editor.blocks.length-1" @click="move(index,1)">下移</button><button class="tw-link" @click="mutate(()=>editor.blocks.splice(index,1))">移除</button></div></div><template v-if="block.type==='image'||block.type==='video'"><ResearchMedia v-if="block.assetId" :asset-id="block.assetId" :kind="block.type" :title="block.title" :poster-asset-id="block.posterAssetId"/><label>媒体标题 / 无障碍说明<input v-model="block.title" maxlength="255" @input="changed"/></label><label v-if="block.type==='video'" class="tw-button">{{block.posterAssetId?'更换视频封面':'发布前上传视频封面'}}<input type="file" accept="image/png,image/jpeg" :disabled="busy" @change="uploadPoster($event,block)"/></label></template><template v-else-if="block.type==='table'"><label v-for="(row,rowIndex) in block.rows" :key="rowIndex">第 {{rowIndex+1}} 行（用 | 分隔列）<input v-model="row.text" maxlength="2000" @input="changed"/></label><button class="tw-link" @click="mutate(()=>block.rows?.push({text:''}))">新增行</button></template><template v-else><label>内容<textarea v-model="block.text" :rows="block.type==='heading'?2:5" maxlength="20000" @input="changed"/></label><label v-if="block.type==='link'">安全链接地址<input v-model="block.href" type="url" @input="changed"/></label></template></div><section v-if="suggestions.length" class="tw-section"><h3>纠错建议 · 逐项核对</h3><div v-for="(suggestion,index) in suggestions" :key="index" class="tw-thread"><p>“{{suggestion.original}}” → “{{suggestion.replacement}}”</p><button class="tw-link" @click="acceptSuggestion(index)">接受并保留撤销</button><button class="tw-link" @click="ignoreSuggestion(index)">忽略</button></div></section><div v-if="saveState.includes('失败')" class="tw-alert is-warning">本地工作稿尚未丢失。请下载保留后，再重新读取服务器版本处理冲突。<button @click="downloadLocal">下载本地工作稿 JSON</button></div></div></template>
<div v-else class="tw-two-pane"><article class="tw-paper"><h2>{{article.revision.title||'未命名工作稿'}}</h2><div class="tw-scope"><label>查看原版本<select :value="article.revision.id" @change="openArticle(article.id,($event.target as HTMLSelectElement).value)"><option v-for="v in article.versions" :key="v.id" :value="v.id">V{{v.revisionNo}} · {{v.status==='DRAFT'?'本人工作稿':'已发布'}}</option></select></label><button v-if="readablePublished" class="tw-button" :disabled="busy" @click="like">{{article.liked?'取消点赞':'点赞'}} · {{article.likes}}</button></div><div v-for="block in article.revision.content.blocks" :id="'research-block-'+block.id" :key="block.id" class="tw-block" :class="{'tw-anchor-active':activeAnchor===block.id}"><template v-if="block.type==='image'||block.type==='video'"><ResearchMedia v-if="block.assetId" :asset-id="block.assetId" :kind="block.type" :title="block.title" :poster-asset-id="block.posterAssetId"/><button v-if="readablePublished" class="tw-link" @click="newMessage('MEDIA',{blockId:block.id,assetId:block.assetId,title:block.title})">批注此媒体</button></template><div v-else-if="block.type==='table'" class="tw-table-wrap"><table class="tw-table" style="min-width:420px"><tbody><tr v-for="(row,index) in block.rows" :key="index"><td v-for="(cell,col) in row.text.split('|')" :key="col">{{cell}}</td></tr></tbody></table></div><h3 v-else-if="block.type==='heading'" @mouseup="captureSelection(block,$event)">{{block.text}}</h3><a v-else-if="block.type==='link'" :href="block.href" target="_blank" rel="noopener noreferrer" @mouseup="captureSelection(block,$event)">{{block.text||block.href}}</a><p v-else class="tw-reading" @mouseup="captureSelection(block,$event)">{{block.text}}</p></div><div v-if="selection" class="tw-alert"><span>已选择：“{{selection.quote}}”</span><button @click="newMessage('TEXT',selection)">添加原文批注</button></div><p v-if="!article.revision.content.blocks.length" class="tw-muted">工作稿暂无正文。</p></article>
<aside class="tw-paper"><header class="tw-head"><h3>讨论与版本批注</h3><button v-if="readablePublished" class="tw-link" @click="newMessage('ARTICLE')">整篇留言</button></header><p class="tw-muted">批注固定在当前原发布版本；新版本不会自动继承旧选区。</p><p v-if="!article.threads.length" class="tw-empty">{{readablePublished?'暂无留言或批注。':'工作稿只有本人可见，发布后可参与讨论。'}}</p><div v-for="thread in article.threads" :key="thread.id" class="tw-thread"><span class="tw-badge">{{thread.kind==='ARTICLE'?'整篇留言':thread.kind==='TEXT'?'原文批注':'媒体批注'}} · {{thread.state==='RESOLVED'?'已处理':'待处理'}}</span><blockquote v-if="thread.anchor?.quote">{{thread.anchor.quote}}</blockquote><button v-if="thread.kind!=='ARTICLE'" class="tw-link" @click="locate(thread)">定位原版本</button><div v-for="message in thread.messages" :key="message.id"><strong>{{message.authorName}}</strong><p>{{message.state==='WITHDRAWN'?'[该消息已撤回，后续回复保留]':message.body}}</p><div v-if="message.authorId===metadata?.userId&&message.state!=='WITHDRAWN'" class="tw-actions"><button class="tw-link" @click="editMessage(message)">修改本人留言</button><button class="tw-link" @click="withdrawTarget=message">撤回</button></div></div><button class="tw-link" @click="reply(thread)">回复</button><button v-if="isAuthor&&thread.kind!=='ARTICLE'" class="tw-link" :disabled="busy" @click="threadState(thread)">{{thread.state==='OPEN'?'标记已处理':'重新打开'}}</button></div></aside></div></template>
<TeachingDialog :open="messageOpen" :title="messageKind==='REPLY'?'回复讨论':messageKind==='EDIT'?'修改本人留言':messageKind==='ARTICLE'?'整篇留言':'添加版本批注'" :busy="busy" @close="messageOpen=false"><blockquote v-if="anchor?.quote">{{anchor.quote}}</blockquote><label>讨论内容 *<textarea v-model="messageText" maxlength="5000" rows="6"/></label><div v-if="messageError" class="tw-alert is-error" role="alert">{{messageError}}</div><template #footer><button class="tw-button" @click="messageOpen=false">取消</button><button class="tw-button primary" :disabled="busy||!messageText.trim()" @click="sendMessage">保存讨论</button></template></TeachingDialog>
<TeachingDialog :open="!!withdrawTarget" title="撤回本人讨论内容？" :busy="busy" @close="withdrawTarget=null"><p>原消息将显示撤回占位，其他教师的回复与讨论线程继续保留。</p><template #footer><button class="tw-button" @click="withdrawTarget=null">取消</button><button class="tw-button danger" :disabled="busy" @click="withdraw">确认撤回</button></template></TeachingDialog>
<TeachingDialog :open="publishOpen" title="发布当前工作稿" :busy="busy||saving" @close="publishOpen=false"><p>发布前会保存并校验最新工作稿。新版本发布后对所有有教研阅读权限的教师可见；原发布版本、评论和批注保留。</p><div v-if="error" class="tw-alert is-error">{{error}}</div><template #footer><button class="tw-button" @click="publishOpen=false">继续编辑</button><button class="tw-button primary" :disabled="busy||saving" @click="publish">确认发布新版本</button></template></TeachingDialog>
<TeachingDialog :open="exportOpen" title="按固定版本导出教研文章" :busy="busy" wide @close="exportOpen=false"><div class="tw-form-grid"><label>文件格式<select v-model="exportFormat"><option value="PDF">PDF</option><option value="DOCX">Word（DOCX）</option></select></label><label class="tw-checkbox"><input v-model="includeAnnotations" type="checkbox" :disabled="article?.revision.status!=='PUBLISHED'"/>包含当前原版本的批注</label></div><p class="tw-muted">默认正文净稿。Word 使用原生批注，PDF 使用编号附录；视频导出标题与受权限保护的文章链接。后台生成固定快照，不随后续正文或讨论变化。</p><button class="tw-button primary" :disabled="busy||saving" @click="startExport">创建 / 复用固定版本导出</button><p v-if="exportJob" role="status">导出 #{{exportJob.id}} · {{ {QUEUED:'等待生成',RUNNING:'后台生成中',READY:'可下载',FAILED:'生成失败'}[exportJob.status]||exportJob.status }}</p><div v-if="error" class="tw-alert is-error">{{error}}</div><div v-for="job in exports" :key="job.id" class="tw-thread"><strong>#{{job.id}} · {{job.format}} · {{job.status}}</strong><button v-if="job.status==='READY'" class="tw-link" @click="downloadExport(job)">下载文件</button><button v-else-if="job.status==='FAILED'" class="tw-link" @click="retryExport(job)">重试固定输入</button><button v-else class="tw-link" @click="exportJob=job;pollExport()">查看后台状态</button></div><template #footer><button class="tw-button" @click="exportOpen=false">关闭</button></template></TeachingDialog>
</section></template>
