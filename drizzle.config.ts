import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './core/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'expo',
});
