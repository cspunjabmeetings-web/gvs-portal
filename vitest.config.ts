// spec: 3.1 Tests (Vitest 5). D1 wale tests wrangler getPlatformProxy (asal local D1) se: owner ka faisla (A), Qadam 5; pool-workers nahin (vitest 4 maangta hai).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
