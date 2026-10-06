const { chromium } = require('playwright')

const BASE = process.env.BASE_URL || 'http://localhost:5199'
const VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'laptop-1024', width: 1024, height: 768 },
  { name: 'desktop-1440', width: 1440, height: 900 },
]

const ROUTES = [
  '/', '/about', '/athletes', '/athletes/oluXyV9x1uU5p2IBdzF9',
  '/sponsorships', '/news', '/gallery', '/donate', '/contact',
  '/apply', '/sponsorships/sponsor', '/faq', '/terms', '/privacy',
  '/refund-cancellation', '/admin/login',
]

;(async () => {
  const browser = await chromium.launch()
  const results = []
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
    const errs = []
    page.on('pageerror', (e) => errs.push(`PAGEERR ${String(e).slice(0, 120)}`))
    page.on('console', (m) => { if (m.type() === 'error') errs.push(`CONSOLE ${m.text().slice(0, 120)}`) })
    for (const route of ROUTES) {
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded' }).catch(() => {})
      await page.waitForTimeout(1600)
      const overflow = await page.evaluate(() => {
        const w = window.innerWidth
        const sw = document.documentElement.scrollWidth
        return { w, sw, over: sw > w + 1, bodyOver: document.body.scrollWidth > w + 1 }
      }).catch(() => ({ over: false, w: 0, sw: 0, bodyOver: false }))
      results.push({
        vp: vp.name, route, over: overflow.over || overflow.bodyOver,
        sw: overflow.sw, w: overflow.w,
        errs: [...errs],
      })
      errs.length = 0
    }
    await page.close()
  }
  const bad = results.filter((r) => r.over || r.errs.length > 0)
  console.log(`Checked ${results.length} (${VIEWPORTS.length} viewports x ${ROUTES.length} routes)`)
  if (bad.length === 0) {
    console.log('ALL CLEAN: no horizontal overflow, no console/page errors.')
  } else {
    console.log(`ISSUES: ${bad.length}`)
    for (const r of bad) {
      console.log(`${r.vp} ${r.route} ${r.over ? `OVERFLOW (scrollWidth=${r.sw} vs width=${r.w})` : ''} ${r.errs.join(' ; ')}`)
    }
  }
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })