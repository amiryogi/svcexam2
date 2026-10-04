import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { conditions: ['development'] },
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'mysql://test:test@127.0.0.1:3306/test',
      APP_ORIGIN: 'http://localhost:5173',
    },
  },
});
