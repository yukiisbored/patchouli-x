import { join } from 'node:path'
import { $ } from 'bun'

/// @see { @link https://github.com/yukiisbored/patchouli-x/issues/23 }
if (process.platform === 'darwin') {
  console.log("We're on macOS, building to Node.js target instead of Bun.")
  await import('./build-node.ts')
  process.exit(0)
}

const srcFolder = join(__dirname, '..', 'src')
const distFolder = join(__dirname, '..', 'dist')
const binaryPath = join(distFolder, 'patchouli-backend')

await $`
  bun build \
    --compile \
    --minify --sourcemap \
    ${join(srcFolder, 'index.ts')} \
    --outfile ${binaryPath}
  `
