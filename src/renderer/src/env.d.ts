import type { ElectronAPI } from '@electron-toolkit/preload'

/// <reference types="vite/client" />

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
