const { chromium } = require('playwright')

const BASE = process.env.BASE_URL || 'http://localhost:5199'

const ADMIN_ROUTES = ['/admin', '/admin/dashboard', '/admin/athletes', '/admin/groups',
  '/admin/events', '/admin/applications', '/admin/sponsorships', '/admin/partners',
  '/admin/enquiries', '/admin/news', '/admin/gallery', '/admin/documents',
  '/admin/content', '/admin/settings', '/admin/notifications']

const toastText = async (page) => {
  const t = page.locator('[role="status"], .toast, .toaster, [class*="toast"]').first()
  const vis = await t.isVisible().catch(() => false)
  return vis ? (await t.innerText().catch(() => '')).trim() : ''
}

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  const logs = { console: [], pageErrors: [], failed: [] }
  page.on('console', (msg) => { if (['error', 'warning'].includes(msg.type())) logs.console.push(msg.text()) })
  page.on('pageerror', (e) => logs.pageErrors.push(String(e)))
  page.on('requestfailed', (r) => logs.failed.push(`${r.url()} :: ${r.failure()?.errorText}`))

  // Base load
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  logs.console.length = 0

  console.log('== ADMIN /login ==')
  await page.goto(BASE + '/admin/login', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const body = await page.locator('body').innerText()
  console.log('FINAL-URL:', page.url())
  console.log('GOOGLE-BTN:', /Sign in with Google|Continue with Google/i.test(body))
  console.log('CONSOLE:', logs.console.join(' | ') || '(none)')
  console.log('PAGEERR:', logs.pageErrors.join(' | ') || '(none)')
  console.log('FAILED:', logs.failed.join(' | ') || '(none)')

  console.log('\n== ADMIN SUBROUTES (unauthenticated) ==')
  for (const route of ADMIN_ROUTES) {
    logs.console.length = 0; logs.pageErrors.length = 0; logs.failed.length = 0
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1800)
    const finalUrl = page.url()
    const b = await page.locator('body').innerText()
    const ok = finalUrl.includes('/admin/login')
    console.log(`${ok ? 'PASS' : 'FAIL'} ${route} -> ${finalUrl}${ok ? '' : ' | BODY: ' + b.slice(0, 80).replace(/\n/g, ' ')}`)
    if (logs.console.length) console.log('  CONSOLE:', logs.console.join(' | '))
    if (logs.pageErrors.length) console.log('  PAGEERR:', logs.pageErrors.join(' | '))
    if (logs.failed.length) console.log('  FAILED:', logs.failed.join(' | '))
  }

  await browser.close()
})().catch((e) => { console.error('E2E ERROR:', e); process.exit(1) })