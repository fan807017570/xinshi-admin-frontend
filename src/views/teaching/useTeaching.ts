import { computed, inject, type InjectionKey, type Ref, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { teachingGet, type TeachingMetadata } from '../../api/teaching';
export interface TeachingContext {
    metadata: Ref<TeachingMetadata | null>;
    refresh: () => Promise<void>;
}
export const TeachingKey: InjectionKey<TeachingContext> = Symbol('teaching');
export function useTeaching() {
    const context = inject(TeachingKey);
    if (!context)
        throw new Error('教学模块上下文未初始化');
    return context;
}
export function useTeachingScope(manageOnly = false) {
    const { metadata } = useTeaching();
    const route = useRoute(), router = useRouter();
    const classId = ref(String(route.query.classId || '')), termId = ref(String(route.query.termId || ''));
    watch(metadata, meta => {
        if (!meta)
            return;
        if (!meta.classes.some(c => c.id === classId.value && (!manageOnly || c.canManage)))
            classId.value = meta.classes.find(c => !manageOnly || c.canManage)?.id || '';
        if (!meta.terms.some(t => t.id === termId.value))
            termId.value = meta.terms[0]?.id || '';
    }, { immediate: true });
    watch([classId, termId], () => { void router.replace({ query: { ...route.query, classId: classId.value, termId: termId.value } }); });
    const currentClass = computed(() => metadata.value?.classes.find(c => c.id === classId.value));
    const canManageClass = computed(() => !!currentClass.value?.canManage);
    const canManageSubject = (subjectId: string, assessmentTerm?: string) => !!metadata.value?.admin || canManageClass.value || !!metadata.value?.courses.some(c => c.classId === classId.value && c.termId === (assessmentTerm || termId.value) && c.subjectId === subjectId);
    return { metadata, classId, termId, currentClass, canManageClass, canManageSubject };
}
export async function loadMetadata() { return teachingGet<TeachingMetadata>('/metadata'); }
