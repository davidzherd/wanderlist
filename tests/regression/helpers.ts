import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, type Locator, type Page } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEST_IMAGE_PATH = path.join(__dirname, 'fixtures', 'test-image.png')

const MATCH_POLL_BUDGET_MS = 10_000
const MATCH_POLL_INTERVAL_MS = 200

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Case-insensitive substring locator for the free-text "expected result" phrases the JSON cases carry. */
function textLocator(page: Page, text: string) {
  return page.getByText(new RegExp(escapeRegExp(text.trim()), 'i')).first()
}

async function goTo(page: Page, rawPath: string): Promise<void> {
  // baseURL is http://localhost:5173/wanderlist/ — a leading "/" in a goto() target resolves
  // against the domain root, not the base path, so it must be stripped before joining.
  const relative = rawPath === '/' ? '' : rawPath.replace(/^\//, '')
  await page.goto(relative)
}

/**
 * Neither popup in this app is portaled, so when one is open its fields/buttons sit in the DOM
 * alongside the page underneath — e.g. the add-location dialog's "Category"/priority-star controls
 * have the exact same accessible names as the map's always-present filter panel. Scoping lookups to
 * the open dialog (if any) is what makes "Fill Category = X" and "Select priority N" unambiguous.
 */
async function getScope(page: Page): Promise<Page | Locator> {
  const dialog = page.getByRole('dialog').last()
  return (await dialog.count()) > 0 ? dialog : page
}

/**
 * Polls an ordered list of candidate locators (highest priority first) until one currently
 * matches. Both the scope AND the candidate list are rebuilt fresh on every tick — not just the
 * match check — because a dialog can be mid-unmount right as a step starts (e.g. right after
 * "Continue without an image" closes the add-location popup): capturing scope once upfront can
 * lock onto that closing dialog for the whole poll window, so nothing outside it (like the
 * floating add-location button) is ever found even though it's on the page the whole time.
 */
async function pollFirstMatch(page: Page, buildCandidates: (scope: Page | Locator) => (() => Locator)[]): Promise<Locator> {
  const deadline = Date.now() + MATCH_POLL_BUDGET_MS
  for (;;) {
    const scope = await getScope(page)
    for (const make of buildCandidates(scope)) {
      const locator = make().first()
      if (await locator.count()) return locator
    }
    if (Date.now() >= deadline) throw new Error('No candidate matched within the poll budget.')
    await new Promise((resolve) => setTimeout(resolve, MATCH_POLL_INTERVAL_MS))
  }
}

async function clickByText(page: Page, text: string) {
  const trimmed = text.trim()

  let locator: Locator
  try {
    locator = await pollFirstMatch(page, (scope) => [
      // A visible tab/button can share exact text with a form's submit button (e.g. Auth's "Sign
      // in" tab vs. its submit button) — prefer the submit button when both match.
      () => scope.getByRole('button', { name: trimmed, exact: true }).and(page.locator('[type="submit"]')),
      () => scope.getByRole('button', { name: trimmed, exact: true }),
      () => scope.getByRole('link', { name: trimmed, exact: true }),
      () => scope.getByRole('button', { name: trimmed }),
      () => scope.getByRole('link', { name: trimmed }),
      () => scope.getByText(trimmed, { exact: true }),
    ])
  } catch {
    throw new Error(`Click step failed — no clickable element with text "${trimmed}" was found.`)
  }

  // A native DOM .click() (not Playwright's coordinate-based click) fires React's handler
  // directly, regardless of viewport position, overlapping elements, or animation/transition
  // state — sidesteps an entire class of flakiness from this app's CSS-animated buttons (the
  // floating add-location button bounces permanently with no dismiss state; the trip-tools panel
  // slides in on open) without needing to reason about each one's exact timing individually.
  await locator.evaluate((el) => (el as HTMLElement).click())

  // These two buttons trigger a `void saveLocation(...)` in the app — deliberately not awaited
  // by the button's own onClick, so the popup doesn't block visually on the save. That means this
  // click can return before the underlying Supabase insert actually finishes, and the *next* step
  // (e.g. navigating away and searching for the just-added location) can race ahead of it. The
  // popup only calls onClose() once the save genuinely succeeds, so waiting for the dialog to
  // close is the real completion signal here.
  if (trimmed === 'Continue without an image' || trimmed === 'Save location') {
    await page
      .getByRole('dialog')
      .waitFor({ state: 'detached', timeout: 15_000 })
      .catch(() => {})
  }
}

async function fillByLabel(page: Page, label: string, value: string) {
  const trimmed = label.trim()

  let locator: Locator
  try {
    locator = await pollFirstMatch(page, (scope) => [
      () => scope.getByLabel(trimmed, { exact: false }),
      // A few inputs in this app (search boxes) rely on their placeholder as the only label.
      () => scope.getByPlaceholder(trimmed, { exact: false }),
    ])
  } catch {
    throw new Error(`Fill step failed — no field labeled "${trimmed}" was found.`)
  }
  await locator.fill(value)
}

async function selectPriority(page: Page, stars: number) {
  const name = `Set priority to ${stars} star${stars === 1 ? '' : 's'}`

  let locator: Locator
  try {
    locator = await pollFirstMatch(page, (scope) => [() => scope.getByRole('button', { name })])
  } catch {
    throw new Error(`Select priority step failed — no "${name}" button was found.`)
  }
  await locator.evaluate((el) => (el as HTMLElement).click())
}

function generateTestUser() {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return {
    name: 'Playwright Test',
    email: `pw-test-${unique}@example.com`,
    password: 'TestPass123!',
  }
}

async function registerAsNewTestUser(page: Page): Promise<void> {
  const user = generateTestUser()
  await goTo(page, '/auth')

  const registerTab = page.getByRole('button', { name: 'Register', exact: true })
  await registerTab.click()

  await page.getByLabel('Name').fill(user.name)
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill(user.password)
  await page.getByLabel('Confirm password').fill(user.password)
  await page.getByRole('button', { name: 'Create account' }).click()

  // Successful registration (email confirmation is off) redirects off /auth onto the map.
  await page.waitForURL((url) => !url.pathname.endsWith('/auth'), { timeout: 15_000 })
}

async function uploadTestImage(page: Page): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles(TEST_IMAGE_PATH)
  await expect(page.locator('img[src*="cloudinary"]')).toBeVisible({ timeout: 20_000 })
}

/** Executes one JSON step string against the given page, per the grammar documented in tests/regression/README.md. */
export async function runStep(page: Page, step: string): Promise<void> {
  const trimmed = step.trim()

  let match: RegExpMatchArray | null

  if ((match = trimmed.match(/^Go to (.+)$/))) {
    await goTo(page, match[1].trim())
    return
  }
  if (trimmed === 'Register as a new test user') {
    await registerAsNewTestUser(page)
    return
  }
  if (trimmed === 'Log out') {
    await clickByText(page, 'Log out')
    return
  }
  if ((match = trimmed.match(/^Click (.+)$/))) {
    await clickByText(page, match[1])
    return
  }
  if ((match = trimmed.match(/^Fill (.+?) = (.+)$/))) {
    await fillByLabel(page, match[1], match[2])
    return
  }
  if ((match = trimmed.match(/^Select priority (\d)$/))) {
    await selectPriority(page, Number(match[1]))
    return
  }
  if (trimmed === 'Upload a test image') {
    await uploadTestImage(page)
    return
  }
  if (trimmed === 'Reload the page') {
    await page.reload()
    return
  }

  throw new Error(`Unrecognized step (doesn't match the grammar in tests/regression/README.md): "${step}"`)
}

export async function assertExpectedResult(page: Page, expected: string): Promise<void> {
  await expect(textLocator(page, expected)).toBeVisible({ timeout: 10_000 })
}

export interface TestCase {
  name: string
  steps: string[]
  'expected result': string
}
