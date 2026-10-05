import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://credaver.network';

  const routes = [
    '',
    '/how-it-works',
    '/demo',
    '/mandates',
    '/receipts',
    '/reviews',
    '/proof',
    '/verify',
    '/docs',
  ];

  const now = new Date();

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: route === '' ? 1.0 : 0.8,
  }));
}
