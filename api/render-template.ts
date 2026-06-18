import type { VercelRequest, VercelResponse } from '@vercel/node'
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

export const config = { maxDuration: 60 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { html, width = 1080, height = 1080 } = req.body ?? {}

    if (!html || typeof html !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid `html` in body' })
    }

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width, height },
      executablePath: await chromium.executablePath(),
      headless: true,
    })

    try {
      const page = await browser.newPage()
      await page.setViewport({ width, height })
      await page.setContent(html, { waitUntil: 'networkidle0' })

      const screenshot = await page.screenshot({
        type: 'png',
        clip: { x: 0, y: 0, width, height },
      })

      res.setHeader('Content-Type', 'image/png')
      res.setHeader('Cache-Control', 'no-cache')
      return res.send(screenshot)
    } finally {
      await browser.close()
    }
  } catch (err) {
    console.error('[render-template] erro:', err)
    return res.status(500).json({ error: (err as Error).message })
  }
}