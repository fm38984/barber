import { config } from 'dotenv';
import { resolve } from 'path';

// Load test environment variables
config({
  path: resolve(__dirname, '../../../.env.test'),
  override: false,
});

// Set defaults for CI if not provided
process.env['TEST_DATABASE_URL'] ??=
  'postgresql://barberflow:password@localhost:5433/barberflow_test';
process.env['NODE_ENV'] = 'test';
