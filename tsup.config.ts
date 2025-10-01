import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/instrumentation.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  external: ['keytar'],
  esbuildOptions(options) {
    options.loader = {
      ...options.loader,
      '.xml': 'text',
    };
  },
  async onSuccess() {},
});
