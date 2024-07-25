import { readFile, writeFile } from 'node:fs/promises'
import * as z from 'zod'
import { Err, Ok, type Result } from './utils'

const schema = z.object({
  version: z.literal(0),
  dataPath: z.string()
})

export type Settings = z.infer<typeof schema>

export async function load(
  settingsPath: string
): Promise<Result<Settings, 'ParseFail' | 'NoFile' | 'Unknown'>> {
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

export async function save(
  settingsPath: string,
  settings: Settings
): Promise<void> {
  const data = JSON.stringify(settings, null, 2)
  await writeFile(settingsPath, data)
}
