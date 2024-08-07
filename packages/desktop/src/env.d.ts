/// <reference types="vite/client" />

import type { Child, Command } from '@tauri-apps/api/shell'

declare global {
  interface Window {
    sidecar: {
      child: Child
      command: Command
    }
  }
}
