import Link from 'next/link'

/**
 * The front door.
 *
 * This page used to lead with "every charity deserves a front door on the web" and pitch a
 * directory listing. That described the instrument rather than the purpose. ETHOS.md is
 * clear that the registry is not the point: the point is that service users take value
 * from it. So the page now leads with what people can actually use today, and the
 * infrastructure argument comes after.
 */
export default function Home() {
  return (
    <main className="container">
      <section className="hero">
        <h1>Charity infrastructure, built by a charity and given away.</h1>
        <p>
          We build the digital things a neighbourhood needs and cannot usually afford, then
          give them away. Free to use, open source, and judged by whether they actually
          help the people they are for.
        </p>
      </section>

      <section>
        <h2>What you can use today</h2>
        <ul className="grid">
          <li className="card">
            <h3>Local</h3>
            <p>
              What is happening near you: community events, surplus food before it is
              wasted, things for sale, and people who need a hand. No account needed to
              look. No comments, no algorithm.
            </p>
            <p>
              <a className="btn" href="https://local.public.charity">Open Local</a>
            </p>
          </li>
          <li className="card">
            <h3>HelpingHand</h3>
            <p>
              Give money to someone sleeping rough without handing over cash. It is held
              for them and paid straight to a hostel we have checked, for a bed or a meal.
              If it is not used within 7 days it comes back to you.
            </p>
            <p>
              <a className="btn" href="https://helpinghand.public.charity">Open HelpingHand</a>
            </p>
          </li>
        </ul>
      </section>

      <section>
        <h2>How we work</h2>
        <ul className="grid">
          <li className="card">
            <h3>You are the principal</h3>
            <p>
              What we hold about you is yours. See every fact, every look at it, and take
              all of it with you whenever you like.
            </p>
          </li>
          <li className="card">
            <h3>We never guess</h3>
            <p>
              We hold nothing about a person that we were not told. Nothing is inferred
              about you, and no machine writes to your record without a person agreeing.
            </p>
          </li>
          <li className="card">
            <h3>Every look leaves a receipt</h3>
            <p>
              Any time somebody reads your details it is recorded, and you can see it. Not
              as a policy we promise to follow — there is no way to read your details that
              skips the record.
            </p>
          </li>
          <li className="card">
            <h3>Nothing fails quietly</h3>
            <p>
              A system that breaks while reporting success is indistinguishable from one
              that lies. So we publish what we checked and what it found, not just what we
              intended.
            </p>
          </li>
        </ul>
        <p className="muted">
          Each of these is enforced by a mechanism in the database and a test that proves
          the mechanism is live, not by a policy document.{' '}
          <Link href="/about">How that works</Link>.
        </p>
      </section>

      <section>
        <h2>Where money goes</h2>
        <p>
          The platform itself never touches money. Where a charity takes donations, the
          link goes straight to their own payment provider: no fees, no middleman, no small
          print.
        </p>
        <p className="notice">
          HelpingHand is the deliberate exception, and works differently. It holds a
          donation for a named person and pays a hostel for a bed or a meal they have
          actually had. That is the whole point of it, so the money genuinely does pass
          through — held for that person, never ours, and returned to you if it is not
          used.
        </p>
      </section>

      <section>
        <h2>For charities</h2>
        <p>
          Everything we build is free for charities, for ever, and open source under
          Apache-2.0 so anybody can run it themselves. If you would like a page in the
          directory, or want to use any of this,{' '}
          <Link href="/directory">have a look at what is there</Link> or{' '}
          <Link href="/app/signup">get in touch</Link>.
        </p>
      </section>
    </main>
  )
}
