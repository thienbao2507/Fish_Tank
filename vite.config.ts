import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Đường dẫn tương đối để bản build chạy được trong WebView của Capacitor (P6).
  base: './',
  build: {
    target: 'es2022',
    // Phaser là một khối lớn (~1.5 MB); không cần cảnh báo kích thước chunk.
    chunkSizeWarningLimit: 2500,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
