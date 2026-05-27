import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { devvit } from '@devvit/start/vite';

const removeClientSourceMaps = () => ({
  async closeBundle() {
    const clientDir = path.resolve(__dirname, 'dist/client');

    const deleteMaps = async (dir: string): Promise<void> => {
      const entries = await readdir(dir, { withFileTypes: true });

      await Promise.all(
        entries.map(async (entry) => {
          const entryPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await deleteMaps(entryPath);
            return;
          }

          if (entry.isFile() && entry.name.endsWith('.map')) {
            await rm(entryPath, { force: true });
          }
        })
      );
    };

    await deleteMaps(clientDir);
  },
  name: 'remove-client-sourcemaps',
});

export default defineConfig({
  plugins: [react(), tailwind(), devvit(), removeClientSourceMaps()],
});
