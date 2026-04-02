import { defineConfig } from 'vite';
import { builtinModules } from 'module';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        'electron',
        ...builtinModules,
        ...builtinModules.map(m => `node:${m}`),
      ],
    },
  },
  plugins: [
    {
      name: 'native-node-modules',
      resolveId(source) {
        // Skip optional native addons — ssh2 and mysql2 fall back to pure JS
        if (source === 'cpu-features') return { id: source, external: true };
        return null;
      },
      load(id) {
        // Replace .node native binary imports with empty stubs
        // ssh2 has a JS fallback for its crypto, mysql2 doesn't need native addons
        if (id.endsWith('.node')) {
          return 'export default {}';
        }
        return null;
      },
    },
  ],
});
