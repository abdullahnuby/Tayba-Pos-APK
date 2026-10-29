import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const baseURL = process.env.KAYAN_REVIEW_URL || 'http://127.0.0.1:4173'
const outputDir = process.env.KAYAN_SCREENSHOT_DIR || 'artifacts/kayan-screen-review'
await fs.mkdir(outputDir, { recursive: true })

const results = []
const pageErrors = []
const consoleErrors = []
const requestFailures = []
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
})
const page = await context.newPage()
page.on('pageerror', error => pageErrors.push(error.message))
page.on('console', message => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
page.on('requestfailed', request => requestFailures.push({
  url: request.url(),
  failure: request.failure()?.errorText || 'unknown',
}))

async function capture(name, viewport) {
  await page.evaluate(() => document.fonts?.ready)
  await page.waitForTimeout(250)
  const fileName = name.replace(/[^a-z0-9-]/gi, '-').toLowerCase() + '.png'
  const screenshotPath = path.join(outputDir, fileName)
  await page.screenshot({ path: screenshotPath, fullPage: false, animations: 'disabled' })
  const state = await page.evaluate(() => {
    const errorHeading = Array.from(document.querySelectorAll('h1,h2,div,p')).find(el =>
      (el.textContent || '').trim() === 'حدث خطأ في الشاشة'
    )
    const root = document.documentElement
    const body = document.body
    const headings = Array.from(document.querySelectorAll('h1,h2,h3'))
      .map(el => (el.textContent || '').trim())
      .filter(Boolean)
      .slice(0, 8)
    const clipped = Array.from(document.querySelectorAll('input,button,select,textarea,[role="button"]'))
      .filter(el => {
        const rect = el.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 &&
          (rect.right < -1 || rect.left > innerWidth + 1 || rect.bottom < -1 || rect.top > innerHeight + 1)
      }).length
    return {
      title: document.title,
      headings,
      width: innerWidth,
      height: innerHeight,
      documentWidth: root.scrollWidth,
      bodyWidth: body.scrollWidth,
      horizontalOverflow: root.scrollWidth > innerWidth + 2 || body.scrollWidth > innerWidth + 2,
      pageHeight: Math.max(root.scrollHeight, body.scrollHeight),
      visibleControlsOutsideViewport: clipped,
      errorBoundary: Boolean(errorHeading),
    }
  })
  const result = { name, viewport, screenshot: fileName, ...state }
  results.push(result)
  console.log(JSON.stringify({ type: 'screen', ...result }))
  if (state.errorBoundary) throw new Error('Error boundary rendered on screen: ' + name)
}

async function clickNavigation(label) {
  const sidebarButton = page.locator('aside nav[aria-label="القائمة الرئيسية"]').getByRole('button', { name: label, exact: true })
  await sidebarButton.waitFor({ state: 'visible', timeout: 10000 })
  await sidebarButton.click()
  await page.waitForTimeout(200)
}

try {
  await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 30000 })
  await capture('setup-01-admin', 'desktop')

  const pinButton = page.getByRole('button', { name: 'إدخال PIN من 4 أرقام' })
  if (await pinButton.count()) {
    await pinButton.click()
    await capture('setup-01-pinpad', 'desktop')
    await page.keyboard.press('1')
    await page.keyboard.press('2')
    await page.keyboard.press('3')
    await page.keyboard.press('4')
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'التالي', exact: true }).click()
    await capture('setup-02-store', 'desktop')
    await page.getByRole('button', { name: 'التالي', exact: true }).click()
    await capture('setup-03-vat', 'desktop')
    await page.getByRole('button', { name: 'إعداد النظام', exact: true }).click()
    await page.getByRole('navigation', { name: 'القائمة الرئيسية' }).waitFor({ state: 'visible', timeout: 15000 })
  }

  const desktopScreens = [
    ['لوحة التحكم', 'desktop-dashboard'],
    ['نقطة البيع', 'desktop-sales'],
    ['الورديات', 'desktop-register'],
    ['المنتجات والمخزون', 'desktop-products'],
    ['المشتريات', 'desktop-purchases'],
    ['الجرد والتسويات', 'desktop-stock-adjustments'],
    ['المرتجعات', 'desktop-returns'],
    ['فواتير المبيعات', 'desktop-sales-invoices'],
    ['الموردون', 'desktop-suppliers'],
    ['العملاء', 'desktop-customers'],
    ['التقارير', 'desktop-reports'],
    ['مركز الطباعة', 'desktop-print-center'],
    ['المحاسبة', 'desktop-accounting'],
    ['البيانات والنسخ', 'desktop-sync'],
    ['سجل العمليات', 'desktop-audit'],
    ['المستخدمون', 'desktop-users'],
    ['الإعدادات', 'desktop-settings'],
    ['الأجهزة والاتصال', 'desktop-devices'],
  ]
  for (const [label, name] of desktopScreens) {
    await clickNavigation(label)
    await capture(name, 'desktop')
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(350)
  const mobileScreens = [
    ['لوحة التحكم', 'mobile-dashboard'],
    ['نقطة البيع', 'mobile-sales'],
    ['المنتجات والمخزون', 'mobile-products'],
    ['المشتريات', 'mobile-purchases'],
  ]
  for (const [label, name] of mobileScreens) {
    const bottomNav = page.getByRole('navigation', { name: 'تنقل سريع' })
    await bottomNav.getByRole('button', { name: label, exact: true }).click()
    await capture(name, 'mobile')
  }

  // Screens available through the full mobile drawer.
  await page.getByRole('button', { name: 'فتح القائمة' }).click()
  const drawer = page.getByRole('dialog').filter({ has: page.getByText('القائمة الرئيسية') })
  const drawerNav = drawer.getByRole('navigation', { name: 'القائمة الرئيسية' })
  for (const [label, name] of [
    ['الأجهزة والاتصال', 'mobile-devices'],
    ['مركز الطباعة', 'mobile-print-center'],
    ['المحاسبة', 'mobile-accounting'],
    ['الإعدادات', 'mobile-settings'],
  ]) {
    await drawerNav.getByRole('button', { name: label, exact: true }).click()
    await capture(name, 'mobile')
    if (label !== 'الإعدادات') {
      await page.getByRole('button', { name: 'فتح القائمة' }).click()
    }
  }

  const report = {
    testedAt: new Date().toISOString(),
    baseURL,
    browser: 'Chromium',
    setupCompleted: results.some(x => x.name === 'desktop-dashboard'),
    screenCount: results.length,
    results,
    pageErrors,
    consoleErrors: consoleErrors.slice(0, 100),
    requestFailures: requestFailures.slice(0, 100),
  }
  await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({
    type: 'summary',
    screenCount: results.length,
    errorBoundaryScreens: results.filter(x => x.errorBoundary).map(x => x.name),
    horizontalOverflowScreens: results.filter(x => x.horizontalOverflow).map(x => x.name),
    pageErrors,
    consoleErrors: consoleErrors.slice(0, 20),
    requestFailures: requestFailures.slice(0, 20),
    report: path.join(outputDir, 'report.json'),
  }))
  if (pageErrors.length) process.exitCode = 1
} catch (error) {
  const report = {
    testedAt: new Date().toISOString(),
    baseURL,
    screenCount: results.length,
    results,
    pageErrors,
    consoleErrors: consoleErrors.slice(0, 100),
    requestFailures: requestFailures.slice(0, 100),
    fatal: error instanceof Error ? error.stack || error.message : String(error),
  }
  await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2))
  console.error(report.fatal)
  process.exitCode = 1
} finally {
  await browser.close()
}
