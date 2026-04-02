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
    // Handle native .node modules — leave them as external requires
    {
      name: 'native-node-modules',
      resolveId(source) {
        // cpu-features is an optional native addon, skip it
        if (source === 'cpu-features') return { id: source, external: true };
        return null;
      },
      load(id) {
        if (id.endsWith('.node')) {
          return `export default require(${JSON.stringify(id)})`;
        }
        return null;
      },
    },
  ],
});
