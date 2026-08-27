import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('ESLint configuration', () => {
  const configPath = resolve(__dirname, '../eslint.config.mjs');

  it('eslint.config.mjs is a valid file and can be loaded', () => {
    const content = readFileSync(configPath, 'utf-8');
    expect(content).toContain('export default');
    expect(content).toContain('tseslint');
  });

  it('eslint --print-config succeeds (config is parseable by ESLint)', () => {
    const result = execSync('npx eslint --print-config src/main.ts 2>&1', {
      cwd: resolve(__dirname, '..'),
      encoding: 'utf-8',
    });
    const config = JSON.parse(result);
    expect(config).toBeDefined();
    expect(config.rules).toBeDefined();
  });
});
