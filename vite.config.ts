import { defineConfig, loadEnv, type ViteDevServer } from 'vite' // 1. type ViteDevServer 추가
import type { IncomingMessage, ServerResponse } from 'node:http' // 2. Node 내장 타입 추가
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import * as fs from 'fs'
import * as path from 'path'


// Service Worker 파일에 환경 변수를 주입하는 커스텀 플러그인
function injectEnvToServiceWorker() {
  return {
    name: 'inject-env-to-sw',
    closeBundle() {
      const env = loadEnv('production', process.cwd(), 'VITE_')
      const swPath = path.resolve(__dirname, 'dist/firebase-messaging-sw.js')

      if (fs.existsSync(swPath)) {
        let content = fs.readFileSync(swPath, 'utf-8')

        // 환경 변수 플레이스홀더 치환
        content = content.replace(/__VITE_FIREBASE_API_KEY__/g, env.VITE_FIREBASE_API_KEY || '')
        content = content.replace(/__VITE_FIREBASE_AUTH_DOMAIN__/g, env.VITE_FIREBASE_AUTH_DOMAIN || '')
        content = content.replace(/__VITE_FIREBASE_PROJECT_ID__/g, env.VITE_FIREBASE_PROJECT_ID || '')
        content = content.replace(/__VITE_FIREBASE_STORAGE_BUCKET__/g, env.VITE_FIREBASE_STORAGE_BUCKET || '')
        content = content.replace(/__VITE_FIREBASE_MESSAGING_SENDER_ID__/g, env.VITE_FIREBASE_MESSAGING_SENDER_ID || '')
        content = content.replace(/__VITE_FIREBASE_APP_ID__/g, env.VITE_FIREBASE_APP_ID || '')

        fs.writeFileSync(swPath, content)
        console.log('✓ firebase-messaging-sw.js에 환경 변수 주입 완료')
      }
    }
  }
}

// 개발 서버에서 SW 파일 요청 시 환경 변수를 주입하는 미들웨어
function devSwMiddleware() {
  return {
    name: 'dev-sw-middleware',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (req.url === '/firebase-messaging-sw.js') {
          const env = loadEnv('development', process.cwd(), 'VITE_')
          const swPath = path.resolve(__dirname, 'public/firebase-messaging-sw.js')

          if (fs.existsSync(swPath)) {
            let content = fs.readFileSync(swPath, 'utf-8')

            content = content.replace(/__VITE_FIREBASE_API_KEY__/g, env.VITE_FIREBASE_API_KEY || '')
            content = content.replace(/__VITE_FIREBASE_AUTH_DOMAIN__/g, env.VITE_FIREBASE_AUTH_DOMAIN || '')
            content = content.replace(/__VITE_FIREBASE_PROJECT_ID__/g, env.VITE_FIREBASE_PROJECT_ID || '')
            content = content.replace(/__VITE_FIREBASE_STORAGE_BUCKET__/g, env.VITE_FIREBASE_STORAGE_BUCKET || '')
            content = content.replace(/__VITE_FIREBASE_MESSAGING_SENDER_ID__/g, env.VITE_FIREBASE_MESSAGING_SENDER_ID || '')
            content = content.replace(/__VITE_FIREBASE_APP_ID__/g, env.VITE_FIREBASE_APP_ID || '')

            res.setHeader('Content-Type', 'application/javascript')
            res.end(content)
            return
          }
        }
        next()
      })
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    devSwMiddleware(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'BandMate - 밴드 관리 앱',
        short_name: 'BandMate',
        description: '학교 밴드 부원들을 위한 공지 및 알림 앱',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        gcm_sender_id: '103953800507',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'apple touch icon'
          },
          {
            src: 'badge-72x72.png',
            sizes: '72x72',
            type: 'image/png',
            purpose: 'badge'
          }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    }),
    injectEnvToServiceWorker()
  ]
})
