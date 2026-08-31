import { PrismaClient } from '../src/generated/prisma/index.js';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Page Guides...');

  const jsonPath = path.resolve(process.cwd(), '../Front-End/guides.json');
  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const initialGuides = JSON.parse(rawData);

  for (const guide of initialGuides) {
    await prisma.pageGuide.upsert({
      where: { route: guide.route },
      update: {},
      create: {
        route: guide.route,
        title: guide.title,
        subtitle: guide.subtitle,
        icon_name: guide.icon_name || guide.icon || "Info",
        overview: guide.overview,
        target_users: guide.targetUsers,
        workflow: guide.workflow,
        buttons: guide.buttons,
        tips: guide.tips,
      }
    });
  }

  console.log('✅ Page Guides seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
