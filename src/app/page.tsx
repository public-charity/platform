import Link from 'next/link'

export default function Home() {
  return (
    <main className="container">
      <section className="hero">
        <h1>Every charity deserves a front door on the web.</h1>
        <p>
          public.charity is a free, open directory of charities — verified against the official
          register — with free tools each charity can switch on when it suits them. A listing takes
          minutes. Everything else is optional.
        </p>
        <p>
          <Link href="/directory" className="btn">Browse charities</Link>{' '}
          <Link href="/app/signup" className="btn secondary">List your charity — free</Link>
        </p>
      </section>

      <section>
        <h2>How it works</h2>
        <ul className="grid">
          <li className="card">
            <h3>A page for every charity</h3>
            <p>
              Enter your charity number and we pre-fill your page from the official register. Add
              your story, your website and your own donation link.
            </p>
          </li>
          <li className="card">
            <h3>Donations go straight to you</h3>
            <p>
              We link to your existing donation provider. Money never touches this platform — no
              fees, no middleman, no small print.
            </p>
          </li>
          <li className="card">
            <h3>Tools, when you want them</h3>
            <p>
              Publish apps your charity has built, and opt into free modules as we release them.
              Nothing is compulsory; use as little or as much as you like.
            </p>
          </li>
        </ul>
      </section>
    </main>
  )
}
