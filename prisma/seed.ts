/** Dev seed — one published example charity so pages aren't empty. */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

async function main() {
  await prisma.organisation.upsert({
    where: { slug: 'example-community-trust' },
    update: {},
    create: {
      slug: 'example-community-trust',
      name: 'Example Community Trust',
      charityNumber: '1234567',
      registerSource: 'CCEW',
      verifiedAt: new Date(),
      status: 'PUBLISHED',
      descriptionMd:
        'A demonstration listing. Example Community Trust supports local families with food, advice and warm spaces across the winter months.',
      causeTags: ['poverty relief', 'community'],
      region: 'Greater Manchester',
      website: 'https://example.org',
      donateUrl: 'https://example.org/donate',
      modules: { create: [{ moduleKey: 'directory' }, { moduleKey: 'apps' }] },
      apps: {
        create: [
          {
            title: 'Winter Warm Spaces Finder',
            description: 'Find a warm space near you this winter, with opening hours and directions.',
            url: 'https://example-warm-spaces.lovable.app',
            status: 'PUBLISHED',
          },
        ],
      },
    },
  })
  console.log('seeded')
}

main().finally(() => prisma.$disconnect())
