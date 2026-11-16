// spec: 3.1 Tests (Vitest). Qadam 5 mein @cloudflare/vitest-pool-workers add hoga.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
