import { readFileSync, readdirSync } from 'node:fs';
const notices = ['LICENSE', 'THIRD_PARTY_NOTICES.md', ...readdirSync(new URL('./licenses/', import.meta.url)).map(name => 'licenses/' + name)];
export default {
  base: './',
  build: { assetsInlineLimit: 0, target: 'es2022', minify: false },
  server: { host: '127.0.0.1' },
  plugins: [{
    name: 'distribution-licenses',
    generateBundle() {
      for (const fileName of notices) this.emitFile({ type: 'asset', fileName, source: readFileSync(new URL('./' + fileName, import.meta.url)) });
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) { return html; },
    },
  }],
};
