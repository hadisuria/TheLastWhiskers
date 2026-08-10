import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        japanRoom: resolve(__dirname, 'japan-room/japan-room.html'),
      },
    },
  },
  plugins: [
    {
      name: 'copy-assets',
      closeBundle() {
        const srcDir = resolve(__dirname, 'assets');
        const destDir = resolve(__dirname, 'dist/assets');
        if (fs.existsSync(srcDir)) {
          fs.cpSync(srcDir, destDir, { recursive: true });
        }
      },
    },
  ],
});
