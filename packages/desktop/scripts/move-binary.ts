/**
 * Based on the example provided by Tauri
 *
 * @see { @link https://github.com/tauri-apps/tauri/blob/1.x/examples/sidecar/scripts/move-binary.jse }
 */

import fs from 'node:fs/promises'
import { join } from 'node:path'
import { $ } from 'bun'

const extension = process.platform === 'win32' ? '.exe' : ''
const sourceBinaryPath = join(
  __dirname,
  `../../backend/dist/patchouli-backend${extension}`
)

if (!(await fs.exists(sourceBinaryPath))) {
  throw new Error(
    'Binary not found, make sure you have run `bun run build` in the backend package'
  )
}

const rustInfo = await $`rustc -vV`.text()
const targetTriple = /host: (\S+)/.exec(rustInfo)?.[1]

if (!targetTriple) {
  throw new Error('Failed to determine target triple')
}

const binariesFolder = join(__dirname, '../src-tauri/binaries')
const targetBinaryPath = join(
  binariesFolder,
  `patchouli-backend-${targetTriple}${extension}`
)

console.log(`Source binary path: ${sourceBinaryPath}`)
console.log(`Target binary path: ${targetBinaryPath}`)
console.log(`Target triple: ${targetTriple}`)

if (!(await fs.exists(binariesFolder))) {
  console.log(`Creating binaries folder at ${binariesFolder}`)
  await fs.mkdir(binariesFolder)
} else if (await fs.exists(targetBinaryPath)) {
  console.log(`Removing existing binary at ${targetBinaryPath}`)
  await fs.unlink(targetBinaryPath)
}

console.log(`Copying binary from ${sourceBinaryPath} to ${targetBinaryPath}`)

await fs.copyFile(sourceBinaryPath, targetBinaryPath)
