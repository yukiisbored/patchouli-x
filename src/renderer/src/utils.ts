/* eslint-disable @typescript-eslint/no-explicit-any */
import { mergeThemeOverride } from '@chakra-ui/react'

export function withBaseStyle(
  baseStyle: Record<string, any>
): (theme: Record<string, any>) => Record<string, any> {
  return (theme) => {
    const names = Object.keys(theme.components)
    return mergeThemeOverride(theme, {
      components: Object.fromEntries(
        names.map((name) => {
          const withBaseStyle = {
            baseStyle: baseStyle
          }
          return [name, withBaseStyle]
        })
      )
    })
  }
}
