<script setup lang="ts">
import { useTeaching } from './useTeaching';
withDefaults(defineProps<{
    manageOnly?: boolean;
    classId: string;
    termId?: string;
    showTerm?: boolean;
}>(), { showTerm: true, manageOnly: false });
const emit = defineEmits<{
    'update:classId': [
        value: string
    ];
    'update:termId': [
        value: string
    ];
}>();
const { metadata } = useTeaching();
</script>
<template><div class="tw-scope"><label v-if="showTerm!==false">学期<select :value="termId" @change="emit('update:termId',($event.target as HTMLSelectElement).value)"><option v-for="term in metadata?.terms" :key="term.id" :value="term.id">{{term.name}}</option></select></label><label>行政班<select :value="classId" @change="emit('update:classId',($event.target as HTMLSelectElement).value)"><option v-for="item in metadata?.classes.filter(c=>!manageOnly||c.canManage)" :key="item.id" :value="item.id">{{item.cohort}} · {{item.name}}</option></select></label><slot/></div></template>
