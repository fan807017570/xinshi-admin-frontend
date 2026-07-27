<script setup lang="ts">
defineProps<{
  title: string
  visible: boolean
  error?: string
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-backdrop" @mousedown.self="emit('close')">
      <section class="modal-card" role="dialog" aria-modal="true" :aria-label="title">
        <header class="modal-head">
          <h2>{{ title }}</h2>
          <button class="button ghost sm" type="button" aria-label="关闭" @click="emit('close')">关闭</button>
        </header>
        <p v-if="error" class="error">{{ error }}</p>
        <slot />
      </section>
    </div>
  </Teleport>
</template>
