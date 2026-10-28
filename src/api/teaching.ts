import http from './http';
import type { AxiosRequestConfig } from 'axios';
export interface Named {
    id: string;
    name: string;
}
export interface SchoolClass extends Named {
    canManage: boolean;
    gradeLevel: number;
    cohort: string;
}
export interface Subject extends Named {
    code: string;
    maxScore: number;
}
export interface Band {
    label: string;
    lowerValue: number;
    upperValue: number;
}
export interface GradeRule {
    id: string;
    code: string;
    versionNo: number;
    mode: string;
    basis: string;
    status: string;
    bands: Band[];
}
export interface TeachingMetadata {
    schemaReady: boolean;
    userId: string;
    admin: boolean;
    headTeacher: boolean;
    terms: Named[];
    classes: SchoolClass[];
    courses: {
        classId: string;
        termId: string;
        subjectId: string;
    }[];
    subjects: Subject[];
    examTypes: Named[];
    rules: GradeRule[];
}
export interface Combination extends Named {
    code: string;
    enabled: number;
    revision: number;
    subjects: Subject[];
}
export interface SelectionStudent extends Named {
    studentNo: string;
    classId: string;
    combinationId: string | null;
    editVersion: number;
    selectionCode: string | null;
    combinationName: string | null;
}
export interface SelectionChange extends Named {
    kind: 'NEW' | 'CHANGED' | 'UNCHANGED' | 'CONFLICT';
    editVersion: number;
}
export interface SelectionPreview {
    changes: SelectionChange[];
    conflicts: number;
    changed: number;
    unchanged: number;
}
export interface Version {
    id: string;
    versionNo: number;
    rosterVersion: number;
    status: string;
    reason: string;
    errorCode?: string;
    createdAt: string;
}
export interface Assessment extends Named {
    termId: string;
    gradeLevel: number;
    cohort: string;
    status: string;
    editVersion: number;
    rosterVersion: number;
    ruleVersionId: string;
    subjects?: AssessmentSubject[];
    versions?: Version[];
    roster?: {
        studentId: string;
        name: string;
        studentNo: string;
        selectionState: string;
    }[];
}
export interface AssessmentSubject extends Named {
    subjectId: string;
    paperCode: string;
    maxScore: number;
    ruleVersionId: string;
}
export interface ScoreEntry {
    studentId: string;
    name: string;
    studentNo: string;
    id: string | null;
    score: number | null;
    resultKind: string;
    recordState: string;
    editVersion: number;
    comment?: string;
    explicitlyWithdrawn?: number;
    dirty?: boolean;
}
export interface GradeResult {
    studentId: string;
    name: string;
    subjectName: string;
    resultKind: string;
    score: number | null;
    maxScore: number;
    gradeLabel: string | null;
    competitionRank: number | null;
    effectiveCount: number;
    expectedCount: number;
}
export interface ResultDetail extends Version {
    results: GradeResult[];
    subjects: {
        id: string;
        name: string;
        effectiveCount: number;
        expectedCount: number;
        excludedCount: number;
    }[];
    unknownSelectionCount: number;
}
export interface Issue {
    id?: string;
    code?: string;
    errorCode?: string;
    message: string;
    category?: string;
    recoveryStatus?: string;
}
export interface Readiness {
    ready: boolean;
    selectionReady: boolean;
    subjectCount: number | null;
    scoreCount: number | null;
    missingSubjects: string[];
    ruleReady: boolean;
    commentState: string;
    issues: Issue[];
}
export interface ReportCandidate extends Readiness {
    studentId: string;
    name: string;
    studentNo: string;
}
export interface ReportItem {
    id: string;
    studentId: string;
    name: string;
    studentNo: string;
    status: string;
    resultVersionId: string;
    readiness: Readiness;
    attemptCount: number;
    errorCode: string | null;
    errorMessage: string | null;
    reportId: string | null;
    fileAvailable: boolean;
    publicationStatus: number;
    publicationVersion?: number;
}
export interface ReportJob {
    id: string;
    assessmentId: string;
    resultVersionId: string;
    assessmentName?: string;
    classId: string;
    status: string;
    createdAt: string;
    continuedFromJobId?: string;
    items: ReportItem[];
    readyCount: number;
    successCount: number;
    processedCount: number;
    totalCount: number;
    roundNo: number;
}
export interface Attempt {
    id: string;
    attemptNo: number;
    roundNo: number;
    resultVersionId: string;
    status: string;
    kind: string;
    startedAt: string;
    finishedAt: string;
    issues: Issue[];
}
export interface TeachingComment {
    id: string;
    studentId: string;
    name: string;
    scope: string;
    subjectId: string;
    body: string;
    source: string;
    manualLocked: number;
    resultVersionId: string;
    status: string;
    editVersion: number;
    authorName: string;
}
export interface DefaultComment {
    studentId: string;
    name: string;
    text: string;
    skipReason: string;
    basisUpdated: boolean;
}
export interface Attention {
    id: string;
    studentId: string;
    name: string;
    note: string;
}
export interface Teacher {
    id: string;
    loginName: string;
    name: string;
    status: number;
    employmentStatus: string;
    departedAt: string | null;
}
export interface DeletionImpact {
    id: string;
    name: string;
    loginName: string;
    canDelete: boolean;
    blockers: string[];
    currentClasses: number;
    currentCourses: number;
    references: {
        tableName: string;
        columnName: string;
        count: number;
    }[];
}
export interface ArticleBlock {
    id: string;
    type: 'paragraph' | 'heading' | 'list' | 'table' | 'image' | 'video' | 'link';
    text?: string;
    assetId?: string;
    posterAssetId?: string;
    title?: string;
    href?: string;
    rows?: {
        text: string;
    }[];
}
export interface Revision {
    id: string;
    revisionNo: number;
    title: string;
    category: string;
    status: string;
    editVersion: number;
    content: {
        blocks: ArticleBlock[];
    };
    publishedAt?: string;
}
export interface ResearchMessage {
    id: string;
    authorId: string | null;
    authorName: string;
    body: string | null;
    state: string;
    editVersion: number;
    createdAt: string;
}
export interface Anchor {
    blockId: string;
    quote?: string;
    start?: number;
    end?: number;
    assetId?: string;
    title?: string;
}
export interface ResearchThread {
    id: string;
    kind: string;
    anchor: Anchor;
    creatorId: string | null;
    creatorName: string;
    state: string;
    editVersion: number;
    messages: ResearchMessage[];
}
export interface Article {
    id: string;
    authorId: string | null;
    authorName: string;
    editVersion: number;
    publishedRevisionId: string | null;
    draftRevisionId?: string | null;
    isAuthor: boolean;
    revision: Revision;
    versions: {
        id: string;
        revisionNo: number;
        status: string;
    }[];
    threads: ResearchThread[];
    likes: number;
    liked: boolean;
}
export interface ArticleSummary {
    id: string;
    authorId: string;
    authorName: string;
    title: string;
    category: string;
    status: string;
    revisionId: string;
    revisionNo: number;
    likes: number;
    updatedAt: string;
}
export interface ExportJob {
    id: string;
    format: string;
    status: string;
    errorCode?: string;
    executionAttempt: number;
}
export class TeachingApiError extends Error {
    constructor(message: string, public code: string, public status: number) { super(message); }
}
export async function teachingRequest<T>(method: AxiosRequestConfig['method'], path: string, data?: unknown, params?: Record<string, unknown>, headers?: Record<string, string>): Promise<T> {
    const response = await http.request<T>({ method, url: '/teaching' + path, data, params, headers, timeout: data instanceof FormData ? 60000 : 10000, validateStatus: status => status !== 401 });
    if (response.status >= 400) {
        const error = response.data as {
            message?: string;
            code?: string;
        };
        throw new TeachingApiError(error.message || '请求失败，请稍后重试', error.code || 'REQUEST_FAILED', response.status);
    }
    return response.data;
}
export const teachingGet = <T>(path: string, params?: Record<string, unknown>) => teachingRequest<T>('get', path, undefined, params);
export const teachingPost = <T>(path: string, data?: unknown) => teachingRequest<T>('post', path, data);
export const requestKey = () => crypto.randomUUID();
export function errorMessage(error: unknown) { return error instanceof Error ? error.message : '操作失败，请重试'; }
export async function teachingBlob(path: string, params?: Record<string, unknown>) {
    const response = await http.get<Blob>('/teaching' + path, { params, responseType: 'blob', validateStatus: status => status !== 401 });
    if (response.status >= 400) {
        let message = '文件暂不可用';
        try {
            message = JSON.parse(await response.data.text()).message || message;
        }
        catch { }
        throw new Error(message);
    }
    return response.data;
}
export async function teachingDownload(path: string, name: string, params?: Record<string, unknown>) { const blob = await teachingBlob(path, params); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
