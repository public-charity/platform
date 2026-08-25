# Ethos

*What this platform is, what it promises, and — the part that makes it unusual —
how each promise is enforced by a mechanism rather than a policy document.
Version 2, written after the first five subsystems shipped and taught us things.*

## What we are building

A digital twin for everything in society. Every real thing — a person, a house,
a café, a food bank, Thursday's repair workshop — gets a durable record that
holds what is true about it, knows where it is, and outlives whoever happens to
be looking after it. One map, one sign-in, one place where a neighbourhood is
legible.

The purpose is not the registry. The registry is the instrument. The purpose is
that **service users take value from it**: surplus food finds people before it
is wasted, a person who said they want to meet people gets invited to something
real, a house's knowledge survives its sale, a small charity gets the digital
presence it could never afford. The platform is charity infrastructure — built
by a charity, given away, and judged by outcomes for the people it serves.

## What building it taught us

Every serious defect we have found so far — a backfill silently narrowed by
row-level security, a spatial index silently dropped by tooling, errors
silently swallowed into empty pages, a real signup silently left behind in a
migration — was the same defect: **a system failing quietly while reporting
success**.

For most software that is an engineering nuisance. For this platform it is the
central threat, because our claim to be different rests entirely on being able
to *prove* what we hold and what we did with it. A quiet failure is
indistinguishable from a lie. So the ethos below treats verifiability not as
hygiene but as the product, and the first version's five concepts gain a
sixth — the one every subsystem turned out to need.

## Six commitments, six mechanisms

The distinctive method of this platform: **promises are grants and policies,
not prose**. Each commitment below names the database-level mechanism that
enforces it and the test that proves the mechanism is live. A commitment whose
enforcement cannot be demonstrated is treated as unshipped.

| # | Commitment | Mechanism | Proof |
|---|---|---|---|
| 1 | **You are the principal.** Your twin is yours: see every fact, every grant, every look, every suggestion — and leave with all of it. | RLS self-read policies; `/about-me`; a versioned twin-archive export | Export produces a complete, documented archive; a stranger sees 0 rows |
| 2 | **We never guess.** The platform holds nothing about a person it was not told. | No attribute exists for a derived trait; the agent role has no write grant on twin data; every agent output is a human-reviewed proposal | `INSERT` as the agent role fails with a permission error |
| 3 | **Money never touches us.** Twins link out; the linked app transacts. | Link-out architecture; no payment SDK in the dependency tree | CI greps for payment SDKs and fails the build on a hit |
| 4 | **Every look leaves a receipt.** Any read of a person's facts is recorded unforgeably and shown to them. | Direct `SELECT` revoked; a single `SECURITY DEFINER` read door that logs; append-only access log | No read path exists that bypasses the door; the subject's receipts page matches the log |
| 5 | **The neighbourhood is a census; the person is a choice.** Population questions are answered only above a k-anonymity floor; individual actions only through a named, versioned, revocable purpose. | k-floor enforced in SQL, not in callers; consent grants bind to the exact text shown; revocation is one write | A population query that could return a count of 1 is rejected; revoke → the same read returns 0 rows in the same transaction |
| 6 | **Nothing fails quietly.** Migrations, policies and tooling are checked for silent narrowing and silent drops; enforcement state is itself monitored. | Drift check fails builds on unreviewed `DROP`s; `FORCE` state asserted after every migration; errors rethrown, never laundered into empty pages | The drift script has already caught real drops; `forced=true` verified on every policied table after deploy |

Commitment 6 is the new one, and it is what makes the other five worth
anything. We publish the verification results, not just the promises.

## Safety before matching

The platform will eventually introduce people to each other. It will not start
there, because a platform that brokers real-world meetings carries
physical-safety obligations a directory never had, and the fastest way to kill
this mission is for its first famous moment to be a safety incident.

The order is deliberate:

1. **Events run by accountable organisations.** Every event has a steward — an
   organisation twin with a verified human behind it. The first agents propose
   *events to people*, never people to people.
2. **An identity-assurance ladder**, modelled as facts with sources, not
   booleans: browsing needs nothing; attending needs a verified person;
   organising needs a verified organisation. Report and block routes, and a
   safeguarding incident path, exist before any introduction feature does.
3. **Peer-to-peer introductions last**, only on declared, consented intent,
   and only once the trust fabric above has operated in production.

## The growth engine, measured honestly

Aggregate demand intelligence → programming → events → business capability →
funding → more events. The engine runs on the census side of commitment 5,
which is the low-risk half of the data.

We refuse engagement metrics as a north star, because a platform that measures
engagement becomes social media by gradient descent. The platform's published
measures are outcomes: value delivered to service users (meals-equivalent
redistributed, attendance at funded events, £ of local value unlocked),
receipts served, revocations honoured and their time-to-effect. Baselines
before delivery, targets at the gate, sources named — the same discipline the
charity applies to every other project.

And in that spirit, the platform itself carries a **stop rule**, to be fixed by
trustees at authorisation: if, a fixed period after consent launches, fewer
than an agreed number of people have granted a purpose and fewer than an agreed
number of events have run through the platform, the platform scales back to the
free directory and the code is archived, open. A platform that cannot state
what failure looks like is not being governed.

## Exit rights

If this succeeds it becomes infrastructure, and infrastructure controlled by
one organisation is a capture risk — the exact thing this platform exists to
not be. Therefore, from the first consent release:

- A person can export their whole twin — facts, grants, receipts, proposals —
  in a versioned, documented format.
- The code remains Apache-2.0 and self-hostable; a community that wants to
  leave can take the software and their data with them.
- Platform trust metrics are published on the same terms as everything else
  the charity publishes.

The export format costs almost nothing to define now and is culturally almost
impossible to retrofit later. That is why it ships early.

## What deliberately does not change

The first version's core survived contact with reality and stands: the
registry-driven twin model (new kinds are inserts, not migrations), facts as
append-only rows with provenance and validity, stewardship as a transferable
interval (tested against a house sale and correct), elicit-never-infer,
aggregate-anonymous / individual-consented, the charity/commerce separation
held until a trigger actually fires, and Postgres now with the two
Cockroach-hostile dependencies kept behind seams.

Stability is part of the ethos. A constitution that changes every quarter is
not one.
