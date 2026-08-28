import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

function loadEnvFile(file: string): void {
  const resolved = path.resolve(process.cwd(), file);
  if (fs.existsSync(resolved)) {
    dotenv.config({ path: resolved });
  }
}

const nodeEnv = process.env.NODE_ENV || 'development';

if (nodeEnv === 'production') {
  loadEnvFile('.env.render');
} else if (nodeEnv === 'test') {
  loadEnvFile('.env.test');
  loadEnvFile('.env.local');
} else {
  loadEnvFile('.env.local');
}

loadEnvFile('.env');
