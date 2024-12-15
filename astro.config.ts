import {defineConfig} from 'astro/config'
import react from '@astrojs/react'
import tailwind from '@astrojs/tailwind'
import compress from 'astro-compress'

// https://astro.build/config
export default defineConfig({
  site: 'https://voxel-ish.vercel.app',
  build: {
    inlineStylesheets: 'always',
  },
  integrations: [
    react(),
    tailwind(),
    compress({
      SVG: false,
    }),
  ],
})
