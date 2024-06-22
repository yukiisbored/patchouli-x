import { app, dialog } from 'electron'
import { mkdir as baseMkdir, readFile as baseReadFile, writeFile as baseWriteFile } from 'fs'
import { join } from 'path'
import { promisify } from 'util'
import * as z from 'zod'
import { Err, Ok, Result } from './utils'

const mkdir = promisify(baseMkdir)
const readFile = promisify(baseReadFile)
const writeFile = promisify(baseWriteFile)

const schema = z.object({
  version: z.literal(0),
  dataPath: z.string()
})

export type Settings = z.infer<typeof schema>

export const privatePath = join(app.getPath('userData'), 'Patchouli Private')
const settingsPath = join(privatePath, 'Settings.json')

export async function load(): Promise<Result<Settings, 'ParseFail' | 'NoFile' | 'Unknown'>> {
  await mkdir(privatePath, { recursive: true })

  try {
    const data = await readFile(settingsPath, 'utf-8')
    const res = await schema.safeParseAsync(JSON.parse(data))

    if (!res.success) {
      console.log('failed to parse settings file', res.error)
      return Err('ParseFail')
    }

    return Ok(res.data)
  } catch (err) {
    // @ts-expect-error We know that err is (likely) a SystemError
    //                  However, for some unknown reason, @types/node lacks a type for SystemError
    // @see https://nodejs.org/api/errors.html#class-systemerror
    if ('code' in err && err.code === 'ENOENT') {
      return Err('NoFile')
    }

    return Err('Unknown')
  }
}

export async function save(settings: Settings): Promise<void> {
  const data = JSON.stringify(settings, null, 2)
  await mkdir(privatePath, { recursive: true })
  await writeFile(settingsPath, data)
}

export async function loadSettings(): Promise<Settings> {
  const settings = await load()

  if (settings.success) {
    return settings.data
  }

  switch (settings.error) {
    case 'ParseFail':
      await dialog.showMessageBox({
        type: 'error',
        title: 'Error',
        message: 'Failed to parse settings file. Will use default settings.'
      })
      break
    case 'Unknown':
      await dialog.showMessageBox({
        type: 'error',
        title: 'Error',
        message: 'An unknown error occurred while loading settings file. Will use default settings.'
      })
      break
  }

  const dataPath = await dialog.showOpenDialog({
    title: 'Select Patchouli Data Folder',
    message: 'Select the folder where Patchouli will store its data.',
    properties: ['openDirectory']
  })

  if (dataPath.canceled || dataPath.filePaths.length === 0) {
    await dialog.showMessageBox({
      type: 'error',
      title: 'Error',
      message: 'No data folder selected. Patchouli cannot run without a data folder.'
    })
    app.quit()
  }

  const newSettings = {
    version: 0 as const,
    dataPath: dataPath.filePaths[0]
  }

  await save(newSettings)

  return newSettings
}
