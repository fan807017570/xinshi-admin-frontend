<script setup lang="ts">
import { getCurrentInstance, nextTick, onMounted, ref, watch } from 'vue';
const props = withDefaults(defineProps<{
    open: boolean;
    title: string;
    busy?: boolean;
    wide?: boolean;
}>(), { busy: false, wide: false });
const titleId = 'tw-dialog-title-' + getCurrentInstance()?.uid;
const emit = defineEmits<{
    close: [
    ];
}>();
const dialog = ref<HTMLDialogElement | null>(null);
async function sync() {
    await nextTick();
    if (props.open && !dialog.value?.open)
        dialog.value?.showModal();
    if (!props.open && dialog.value?.open)
        dialog.value?.close();
}
watch(() => props.open, sync);
onMounted(sync);
</script>
<template><dialog ref="dialog" class="tw-dialog" :class="{'tw-dialog-wide':wide}" :aria-labelledby="titleId" @cancel="busy?$event.preventDefault():undefined" @close="emit('close')"><header><h2 :id="titleId">{{title}}</h2><button type="button" class="tw-icon" aria-label="关闭对话框" :disabled="busy" @click="dialog?.close()">×</button></header><div class="tw-dialog-body"><slot/></div><footer v-if="$slots.footer"><slot name="footer"/></footer></dialog></template>
