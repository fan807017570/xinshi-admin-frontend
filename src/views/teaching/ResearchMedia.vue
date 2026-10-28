<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import { teachingBlob, errorMessage } from '../../api/teaching';
const props = defineProps<{
    assetId: string;
    kind: string;
    title?: string;
    posterAssetId?: string;
}>();
const poster = ref(''), src = ref(''), error = ref(''), loading = ref(false);
let sequence = 0;
watch(() => [props.assetId, props.posterAssetId] as const, async ([id, posterId]) => {
    const current = ++sequence;
    if (src.value)
        URL.revokeObjectURL(src.value);
    if (poster.value)
        URL.revokeObjectURL(poster.value);
    poster.value = '';
    src.value = '';
    error.value = '';
    loading.value = true;
    try {
        const blob = await teachingBlob(`/research/media/${id}`);
        if (current === sequence)
            src.value = URL.createObjectURL(blob);
        if (posterId) {
            const cover = await teachingBlob(`/research/media/${posterId}`);
            if (current === sequence)
                poster.value = URL.createObjectURL(cover);
        }
    }
    catch (e) {
        if (current === sequence)
            error.value = errorMessage(e);
    }
    finally {
        if (current === sequence)
            loading.value = false;
    }
}, { immediate: true });
onUnmounted(() => {
    sequence++;
    if (src.value)
        URL.revokeObjectURL(src.value);
    if (poster.value)
        URL.revokeObjectURL(poster.value);
});
</script>
<template><figure><div v-if="loading" class="tw-loading" aria-busy="true">正在读取私有媒体…</div><p v-else-if="error" class="tw-alert is-error" role="alert">{{error}}</p><img v-else-if="src&&kind==='image'" class="tw-media" :src="src" :alt="title||'文章插图'"/><video v-else-if="src" class="tw-media" :src="src" :poster="poster" controls preload="metadata" :aria-label="title||'文章视频'"/><figcaption v-if="title" class="tw-muted">{{title}}</figcaption></figure></template>
