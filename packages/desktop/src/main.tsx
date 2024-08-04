import { message } from '@tauri-apps/api/dialog'
import { appDataDir } from '@tauri-apps/api/path'
import { exit } from '@tauri-apps/api/process'
import { Command } from '@tauri-apps/api/shell'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { attachConsole, error, info } from 'tauri-plugin-log-api'
import App from './App'
import { isDev } from './utils'

document.addEventListener('DOMContentLoaded', async () => {
  await attachConsole()

  if (!isDev()) {
    const privatePath = await appDataDir()

    await info('Patchouli Desktop is running in production mode')
    await info('Will launch Patchouli Backend as a sidecar')
    await info(`Private path is ${privatePath}`)

    const command = Command.sidecar('binaries/patchouli-backend', [
      '--privatePath',
      privatePath
    ])

    command.on(
      'close',
      async ({ code, signal }: { code: unknown; signal: unknown }) => {
        await error(
          `Patchouli Backend exited unexpectedly with code ${code} and signal ${signal}`
        )

        await message(
          'Backend process has exited unexpectedly. Please check the logs for more information. Patchouli Desktop will now exit.',
          {
            type: 'error'
          }
        )

        await exit(1)
      }
    )

    command.on('error', async (event) => {
      await error(`Failed to launch Patchouli Backend: ${event}`)

      await message(
        'Unable to start backend process. Please check the logs for more information. Patchouli Desktop will now exit.',
        {
          type: 'error'
        }
      )

      await exit(1)
    })

    command.stderr.on('data', (line) => info(`[Backend] ${line}`))

    const child = await command.spawn()

    window.sidecar = {
      command,
      child
    }
  } else {
    await info('Patchouli Desktop is running in development mode')
    await info('Will not launch Patchouli Backend as a sidecar')
  }

  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
})
