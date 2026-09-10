const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.$connect().then(async () => {
  try {
    const project = await prisma.project.findFirst({ include: { parcels: true } });
    if (project) {
      console.log('corridorGeoJSON:', JSON.stringify(project.corridorGeoJSON));
      console.log('type:', typeof project.corridorGeoJSON, project.corridorGeoJSON?.type);
    } else {
      console.log('No project found');
    }
  } catch (e) {
    console.error(e);
  } finally {
    prisma.$disconnect();
  }
}).catch(e => { console.error(e); prisma.$disconnect(); });