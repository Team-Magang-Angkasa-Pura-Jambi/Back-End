const { PrismaClient } = require('./src/generated/prisma/index.js');
const prisma = new PrismaClient();

async function run() {
  const definitions = await prisma.formulaDefinition.findMany({
    where: { template_id: 'a98eb33a-d68a-44c1-ae04-20d09995c739' }
  });
  console.dir(definitions, { depth: null });
  await prisma.$disconnect();
}
run();
