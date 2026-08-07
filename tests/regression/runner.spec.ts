import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from '@playwright/test'
import { runStep, assertExpectedResult, type TestCase } from './helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CASES_PATH = path.join(__dirname, 'cases.json')

function loadCases(): TestCase[] {
  if (!fs.existsSync(CASES_PATH)) {
    return []
  }
  const raw = fs.readFileSync(CASES_PATH, 'utf-8')
  return JSON.parse(raw) as TestCase[]
}

const cases = loadCases()

// A couple of buttons in this app carry a permanent CSS bounce (the floating add-location
// button has no dismiss state at all) or a slide-in transition (the trip-tools panel). Disabling
// animations/transitions globally makes clicking them deterministic instead of racing a moving
// target — addInitScript re-runs on every navigation within the test, not just the first.
async function disableAnimations(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const style = document.createElement('style')
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0.001ms !important;
        animation-delay: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
        transition-delay: 0.001ms !important;
      }
    `
    document.head.appendChild(style)
  })
}

if (cases.length === 0) {
  test('regression cases.json is missing or empty', () => {
    throw new Error(
      `No test cases found at ${CASES_PATH}. Generate it before running this suite (see tests/regression/README.md).`,
    )
  })
} else {
  for (const testCase of cases) {
    test(testCase.name, async ({ page }) => {
      await disableAnimations(page)
      for (const step of testCase.steps) {
        await test.step(step, async () => {
          await runStep(page, step)
        })
      }
      await assertExpectedResult(page, testCase['expected result'])
    })
  }
}
