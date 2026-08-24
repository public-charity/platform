/**
 * Charity register lookups — the highest-leverage onboarding feature.
 * Enter a registration number, get official name/status back, and the
 * listing carries provenance from the regulator's register.
 *
 * England & Wales (CCEW) first. OSCR and CCNI publish data downloads
 * rather than lookup APIs — import jobs, added later.
 *
 * NOTE: endpoint shape and auth for the CCEW API must be verified against
 * current Charity Commission documentation before production use.
 */

export type RegisterResult = {
  source: 'CCEW'
  number: string
  name: string
  registered: boolean
  raw: unknown
}

export async function lookupCCEW(charityNumber: string): Promise<RegisterResult | null> {
  const apiKey = process.env.CCEW_API_KEY
  if (!apiKey) return null // lookup disabled until a key is configured
  const n = charityNumber.replace(/\D/g, '')
  if (!n) return null
  const res = await fetch(
    `https://api.charitycommission.gov.uk/register/api/allcharitydetailsV2/${n}/0`,
    { headers: { 'Ocp-Apim-Subscription-Key': apiKey }, next: { revalidate: 0 } },
  )
  if (!res.ok) return null
  const data = (await res.json()) as Record<string, unknown>
  const name = typeof data.charity_name === 'string' ? data.charity_name : null
  if (!name) return null
  return {
    source: 'CCEW',
    number: n,
    name,
    registered: data.reg_status === 'R' || data.charity_registration_status === 'Registered',
    raw: data,
  }
}
