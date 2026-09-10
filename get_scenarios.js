const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.$connect().then(async () => {
  try {
    const scenarios = await prisma.scenario.findMany();
    console.log('Scenarios count:', scenarios.length);
    scenarios.forEach(s => console.log('Scenario:', s.id, 'label:', s.label, 'corridorLengthKm:', s.corridorLengthKm));
    prisma.$disconnect();
  } catch(e) { console.error(e); prisma.$disconnect(); }
}).catch(e => { console.error(e); prisma.$disconnect(); });