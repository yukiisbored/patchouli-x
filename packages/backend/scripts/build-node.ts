import fs from 'node:fs/promises'
import { join } from 'node:path'
import { $ } from 'bun'
/**
 * This script builds the Patchouli backend using Node.js SEA
 * instead of Bun.
 *
 * This is a workaround for an unconfirmed bug in Bun related to
 * stdin/stdout handling or readline on macOS.
 *
 * @see { @link https://github.com/yukiisbored/patchouli-x/issues/23 }
 */
import * as esbuild from 'esbuild'

if (process.platform !== 'darwin') {
  throw new Error('This script is only supported on macOS')
}

const srcFolder = join(__dirname, '..', 'src')
const distFolder = join(__dirname, '..', 'dist')
const binaryPath = join(distFolder, 'patchouli-backend')
const seaBlobPath = join(distFolder, 'patchouli-backend.blob')

const nodePath = Bun.which('node')

if (!nodePath) {
  throw new Error('Node not found, do you have devbox running?')
}

console.log('Bundling...')
await esbuild.build({
  entryPoints: [join(srcFolder, 'index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  outfile: join(distFolder, 'patchouli-backend.cjs'),
  external: ['fsevents']
})

await fs.copyFile(
  join(__dirname, 'sea-config.json'),
  join(distFolder, 'sea-config.json')
)

console.log('Creating Node.js SEA blob...')
await $`${nodePath} --experimental-sea-config sea-config.json`.cwd(distFolder)

console.log('Injecting SEA blob into Node.js binary...')
await fs.copyFile(nodePath, binaryPath)

await $`codesign --remove-signature ${binaryPath}`

await $`
  bunx postject ${binaryPath} NODE_SEA_BLOB ${seaBlobPath} \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
    --macho-segment-name NODE_SEA
  `.cwd(distFolder)

await $`codesign --sign - ${binaryPath}`
console.log('Done! :-)')
