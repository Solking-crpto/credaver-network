import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Route & Internal Link Integrity Audit', () => {
  const VALID_BASE_ROUTES = new Set([
    '/',
    '/how-it-works',
    '/demo',
    '/mandates',
    '/receipts',
    '/reviews',
    '/proof',
    '/verify',
    '/docs',
    '/api/auth/challenge',
    '/api/auth/verify',
    '/api/authority',
    '/api/early-access',
    '/api/mandates',
    '/api/mandates/prepare',
    '/api/proofs/template',
    '/api/receipts',
    '/api/reviews',
    '/api/scenarios',
    '/api/sign',
    '/api/verify',
    '/api/health',
  ]);

  function isValidInternalRoute(rawHref: string): boolean {
    if (!rawHref || typeof rawHref !== 'string') return true;

    // Ignore anchors, external URLs, protocols
    if (rawHref.startsWith('http://') || rawHref.startsWith('https://')) return true;
    if (rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) return true;
    if (rawHref.startsWith('#')) return true;

    // Strip query parameters and fragment anchors
    const cleanPath = rawHref.split('?')[0].split('#')[0];

    // Normalize trailing slash
    const normalized = cleanPath.length > 1 && cleanPath.endsWith('/')
      ? cleanPath.slice(0, -1)
      : cleanPath;

    if (VALID_BASE_ROUTES.has(normalized)) return true;

    // Parameterized route: /receipts/:id
    if (/^\/receipts\/[^/]+$/.test(normalized)) return true;

    // Parameterized route: /api/receipts/:id
    if (/^\/api\/receipts\/[^/]+$/.test(normalized)) return true;

    // Parameterized route: /api/mandates/:id/revoke
    if (/^\/api\/mandates\/[^/]+\/revoke$/.test(normalized)) return true;

    // Parameterized route: /api/mandates/:id
    if (/^\/api\/mandates\/[^/]+$/.test(normalized)) return true;

    return false;
  }

  function getFiles(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        getFiles(fullPath, fileList);
      } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  it('verifies all statically defined internal href links map to valid routes', () => {
    const srcDir = path.resolve(__dirname);
    const files = getFiles(srcDir);

    const hrefRegex = /href=["'`]((\/[^"'`]*))["'`]/g;
    const brokenLinks: { file: string; link: string }[] = [];

    for (const file of files) {
      // Don't test the test file itself
      if (file.endsWith('routes-links.test.ts')) continue;

      const content = fs.readFileSync(file, 'utf8');
      let match;
      while ((match = hrefRegex.exec(content)) !== null) {
        const link = match[1];
        // Skip template literal expressions like /receipts/${...}
        if (link.includes('${')) {
          const prefix = link.split('${')[0];
          if (!isValidInternalRoute(prefix + 'test-id')) {
            brokenLinks.push({ file: path.relative(srcDir, file), link });
          }
          continue;
        }

        if (!isValidInternalRoute(link)) {
          brokenLinks.push({ file: path.relative(srcDir, file), link });
        }
      }
    }

    expect(brokenLinks).toEqual([]);
  });

  it('verifies GET /api/health endpoint returns 200 with operational status', async () => {
    const { GET } = await import('./app/api/health/route');
    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.service).toBe('CredaVer Policy Decision Point');
    expect(data.cluster).toBe('devnet');
  });
});
