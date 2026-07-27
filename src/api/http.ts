import axios from 'axios'

export const AUTH_STORAGE_KEY = 'xinshi-admin-auth'

const http = axios.create({
  baseURL: '/api',
  timeout: 10000
})

http.interceptors.request.use((config) => {
  // 仅对 JSON 请求设置 Content-Type，FormData 由 axios 自动处理
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  } else {
    config.headers['Content-Type'] = 'application/json'
  }

  const auth = localStorage.getItem(AUTH_STORAGE_KEY)
  if (auth) {
    try {
      const parsed = JSON.parse(auth)
      if (parsed.token) {
        config.headers['X-Auth-Token'] = parsed.token
        config.headers.Authorization = `Bearer ${parsed.token}`
      }
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    }
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    // 401 不弹窗，直接跳转登录
    if (error.response?.status === 401) {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
      return Promise.reject(new Error('登录已过期，请重新登录'))
    }

    let message = '请求失败'
    if (error.response?.data instanceof Blob && error.response.data.type !== 'application/pdf') {
      try {
        const text = await error.response.data.text()
        message = JSON.parse(text).message || message
      } catch {
        // Keep the fallback message for non-json blobs.
      }
    }
    if (!message || message === '请求失败') {
      message = error.response?.data?.message || error.message || '请求失败'
    }

    // 403 权限错误由调用方自行处理，不弹出全局错误弹窗
    if (error.response?.status !== 403) {
      try {
        const { useErrorStore } = await import('../stores/error')
        useErrorStore().show(message)
      } catch {
        // Error store unavailable
      }
    }

    return Promise.reject(new Error(message))
  }
)

export default http
