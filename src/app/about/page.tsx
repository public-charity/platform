import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'About' }

export default function About() {
  return (
    <main className="container" style={{ maxWidth: '44rem' }}>
      <h1>About public.charity</h1>
      <p>
        public.charity exists to promote the efficiency and effectiveness of charities — a
        charitable purpose in its own right. We build practical, well-made software and give it to
        charities for free: a public directory, a page for every charity, and optional tools they
        can adopt whenever they are ready.
      </p>
      <h2>Principles</h2>
      <ul>
        <li><strong>Free for charities, forever.</strong> The platform is a gift, not a funnel.</li>
        <li>
          <strong>Donations never touch us.</strong> Every donate button links directly to the
          charity’s own payment provider.
        </li>
        <li>
          <strong>Verified listings.</strong> Charities are checked against the official regulator’s
          register wherever one exists.
        </li>
        <li>
          <strong>Open source.</strong> The platform’s code is public, and other organisations are
          welcome to reuse it.
        </li>
        <li>
          <strong>Nothing is compulsory.</strong> A charity that only wants a listing never sees the
          rest.
        </li>
      </ul>
      <p className="muted">
        The charity operating this platform is in formation; its governing documents, project
        register and decision records will be published here as part of its transparency commitments.
      </p>
    </main>
  )
}
