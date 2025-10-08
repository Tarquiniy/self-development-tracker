// tiptap-build/vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/tiptap-umd.js'),
      name: 'TipTapUMD',
      fileName: 'tiptap-umd',
      formats: ['umd']
    },
    rollupOptions: {
      // Bundle all code into one file so runtime doesn't require network.
      external: [],
      output: {
        // no globals: bundle everything
      }
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
});
