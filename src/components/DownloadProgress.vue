<script setup lang="ts">
defineProps<{
  visible: boolean
  percent: number
}>()

const emit = defineEmits<{
  cancel: []
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-backdrop">
      <section class="dp-card modal-card" role="status" aria-live="polite">
        <h2 class="dp-title">正在下载成绩单</h2>
        <div class="dp-track">
          <span class="dp-fill" :style="{ width: `${Math.max(3, percent)}%` }" />
        </div>
        <p class="dp-percent">已完成 {{ percent }}%</p>
        <div class="modal-actions">
          <button class="button ghost" type="button" @click="emit('cancel')">取消</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
