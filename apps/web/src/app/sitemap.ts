import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://credaver.network';

  const routes = [
    '',
    '/demo',
    '/mandates',
    '/receipts',
    '/proof',
    '/concepts',
    '/early-access',
    '/docs',
    '/verify',
    '/how-it-works',
    '/reviews',
  ];

  const now = new Date();

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: route === '' ? 1.0 : 0.8,
  }));
}
