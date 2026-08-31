/**
 * Smoke + unit test for Backend/API_PROTECTION_README.md
 * Ensures the four middlewares load and boot under both NestJS and Express.
 */

import * as fs from 'fs';
import { createRequire } from 'module';
import * as path from 'path';

const nodeRequire = createRequire(__filename);

describe('API Protection (API_PROTECTION_README.md)', () => {
  it('loads ddosGuard middleware', () => {
    const mod = nodeRequire('../../middleware/ddosGuard');
    expect(typeof mod.ddosGuard).toBe('function');
    expect(typeof mod.strictDDoSGuard).toBe('function');
    const mw = mod.ddosGuard({ whitelist: ['127.0.0.1'] });
    expect(typeof mw).toBe('function');
  });

  it('loads throttle middleware', () => {
    const mod = nodeRequire('../../middleware/throttle');
    expect(typeof mod.throttle).toBe('function');
    const mw = mod.throttle();
    expect(typeof mw).toBe('function');
  });

  it('loads version middleware', () => {
    const mod = nodeRequire('../../middleware/version');
    expect(typeof mod.versionMiddleware).toBe('function');
    const mw = mod.versionMiddleware({
      defaultVersion: 'v2',
      supportedVersions: ['v1', 'v2'],
    });
    expect(typeof mw).toBe('function');
  });

  it('loads backwardCompat middleware', () => {
    const mod = nodeRequire('../../middleware/backwardCompat');
    expect(typeof mod.backwardCompatMiddleware).toBe('function');
    const mw = mod.backwardCompatMiddleware();
    expect(typeof mw).toBe('function');
  });

  it('main.ts wires all four middlewares (dual entrypoint)', () => {
    const main = fs.readFileSync(path.join(__dirname, '../main.ts'), 'utf8');
    expect(main).toMatch(/ddosGuard/);
    expect(main).toMatch(/throttle/);
    expect(main).toMatch(/versionMiddleware/);
    expect(main).toMatch(/backwardCompatMiddleware/);
  });

  it('backend/server.js wires all four middlewares (dual entrypoint)', () => {
    const srv = fs.readFileSync(
      path.join(__dirname, '../../../backend/server.js'),
      'utf8',
    );
    expect(srv).toMatch(/ddosGuard/);
    expect(srv).toMatch(/throttle/);
    expect(srv).toMatch(/versionMiddleware/);
    expect(srv).toMatch(/backwardCompatMiddleware/);
  });
});
