const { chromium } = require('playwright')
const BASE = process.env.BASE_URL || 'http://localhost:5199'
;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(`PAGEERR ${String(e).slice(0, 140)}`))
  p.on('console', (m) => { if (m.type() === 'error') errs.push(`CONSOLE ${m.text().slice(0, 140)}`) })
  p.on('requestfailed', (r) => { if (!/googleapis|maps\.google|images\.unsplash/.test(r.url())) errs.push(`REQ ${r.failure()?.errorText} ${r.url().slice(0, 100)}`) })

  const log = (label, expr) => console.log(`${label}:`, expr)
  const has = async (s) => (await p.locator('body').innerText()).includes(s)

  // 1) Hard 404 catch-all
  await p.goto(BASE + '/definitely-not-a-page', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500)
  log('CATCHALL 404', await has('404') || /page not found|not found/i.test(await p.locator('body').innerText()))
  console.log('  final url:', p.url())

  // 2) Bogus athlete id -> EmptyState
  await p.goto(BASE + '/athletes/not-a-real-id', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(7000)
  log('BOGUS ATHLETE EMPTYSTATE', await has('No athlete found') || /not found|couldn't find/i.test(await p.locator('body').innerText()))
  console.log('  pageerr count so far:', errs.length)

  // 3) SPA transition: home -> about -> contact (no full reload)
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500)
  await p.click('text=About').catch(() => {})
  await p.waitForTimeout(1200)
  log('SPA-GOTO-ABOUT', p.url().includes('/about'))
  await p.click('text=Contact').catch(() => {})
  await p.waitForTimeout(1200)
  log('SPA-GOTO-CONTACT', p.url().includes('/contact'))

  // 4) Back button
  await p.goBack(); await p.waitForTimeout(1200)
  log('BACK-TO-ABOUT', p.url().includes('/about'))

  // 5) Real athlete profile renders data
  await p.goto(BASE + '/athletes/oluXyV9x1uU5p2IBdzF9', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(7000)
  const body = await p.locator('body').innerText()
  log('REAL ATHLETE PROFILE', body.includes('Mohammed Asraf'))

  console.log('ERR:', errs.join(' | ') || '(none)')
  await b.close()
})().catch((e) => { console.error(e); process.exit(1) })