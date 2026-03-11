import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://www.flipwhizz.com', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://www.flipwhizz.com/how-it-works', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://www.flipwhizz.com/pricing', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://www.flipwhizz.com/blog', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: 'https://www.flipwhizz.com/about', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: 'https://www.flipwhizz.com/faq', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: 'https://www.flipwhizz.com/create', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
  ]
}