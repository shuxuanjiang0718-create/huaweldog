import { defineConfig } from 'vite';
import {gameVersion} from './scripts/game-version.mjs';

export default defineConfig({
  plugins:[{name:'game-version',generateBundle(){this.emitFile({type:'asset',fileName:'game-version.json',source:JSON.stringify(gameVersion(process.cwd()))});}}],
  server: { port: 5178, strictPort: true },
  preview: { port: 5178, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 800 },
});
