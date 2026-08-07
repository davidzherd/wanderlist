# Regression suite

`cases.json` is a flat JSON array of test cases, each shaped:

```json
{
  "name": "...",
  "steps": ["...", "..."],
  "expected result": "..."
}
```

`runner.spec.ts` turns each entry into a real Playwright test. Every string in `steps` must match one of these patterns exactly — anything else throws "Unrecognized step" (see `helpers.ts`):

| Pattern | Effect |
|---|---|
| `Go to <path>` | Navigates to that route (`/auth`, `/`, `/trips`) |
| `Register as a new test user` | Signs up a brand-new throwaway account (unique generated email/password) and ends up logged in |
| `Log out` | Clicks the "Log out" button |
| `Click <exact visible text>` | Clicks the button/link with that accessible name |
| `Fill <exact visible field label> = <value>` | Types into the labeled input/textarea |
| `Select priority <1-5>` | Clicks the Nth star in the priority rating control |
| `Upload a test image` | Drives the AddLocationPopup photo dropzone with `fixtures/test-image.png` |
| `Reload the page` | `page.reload()` |

`expected result` is a short phrase of real UI text (a toast, an error message, a count) that must be visible on the page once the steps finish — checked as a case-insensitive substring match.

## Important: this runs against the real Supabase/Cloudinary project

There is no mock backend or separate test project yet — this suite exercises `.env`'s actual Supabase project and Cloudinary account. Cases that create a location/trip should clean up after themselves (unless the delete flow is what's being tested) — see the cleanup rule the case-writing prompt was given. Registered test accounts (`pw-test-*@example.com`) cannot be deleted through the UI and will accumulate in Supabase Authentication → Users; clear them out periodically from the dashboard if that matters to you.

## Running it

```bash
npm run test:e2e
```

Playwright starts the dev server itself (`webServer` in `playwright.config.ts`) if one isn't already running.
