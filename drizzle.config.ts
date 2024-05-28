import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/main/schema.ts',
  out: './resources/drizzle',
  dialect: 'sqlite'
})
