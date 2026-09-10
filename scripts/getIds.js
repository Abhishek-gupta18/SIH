const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const project = await prisma.project.findFirst();
  console.log('PROJECT_ID:', project.id);

  const scenarios = await prisma.scenario.findMany({
    where: { projectId: project.id }
  });
  scenarios.forEach(s => console.log('SCENARIO:', s.label, s.id));

  await prisma.$disconnect();
})();