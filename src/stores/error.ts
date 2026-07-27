import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useErrorStore = defineStore('error', () => {
  const message = ref('')
  const visible = ref(false)

  function show(msg: string) {
    message.value = msg
    visible.value = true
  }

  function clear() {
    message.value = ''
    visible.value = false
  }

  return { message, visible, show, clear }
})
