import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => {
  if (command === 'build') return { plugins: [react()] }

  const port = Number(process.env.FRONTEND_PORT)
  const target = process.env.VITE_PROXY_TARGET
  if (!Number.isInteger(port) || port < 1 || !target) {
    throw new Error('Set FRONTEND_PORT and VITE_PROXY_TARGET before starting Vite')
  }

  const proxy = { '/api': { target, changeOrigin: true } }
  return {
    plugins: [react()],
    server: { host: '0.0.0.0', port, strictPort: true, proxy },
    preview: { host: '0.0.0.0', port, proxy },
  }
})
