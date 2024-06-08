import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import invariant from 'tiny-invariant'

export interface ScrapeResult {
  url: string
  title: string
  description: string
  keywords: Array<string>
  publishedAt?: Date
  image?: string
  htmlContent: string
  content: string
  author?: string
  authorUrl?: string
}

// TODO: scrape image, author, keywords, and published date
export async function scrape(url: string): Promise<ScrapeResult> {
  const res = await JSDOM.fromURL(url)
  const reader = new Readability(res.window.document)
  const article = reader.parse()

  // TODO: fallback when readability fails
  invariant(article, 'article is null')
  const { title, excerpt: description, textContent: content, content: htmlContent } = article
  return {
    url,
    title,
    description,
    content,
    htmlContent,
    keywords: []
  }
}
