import { ClientApp } from './client'

// Every path renders the same client-only SPA; React Router handles routing inside it.
export default function Page() {
  return <ClientApp />
}
