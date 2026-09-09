const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.$connect().then(() => {
  return prisma.project.findFirst();
}).then(project => {
  console.log('Project ID:', project.id, 'Name:', project.name);
  prisma.$disconnect();
}).catch(e => { console.error(e); prisma.$disconnect(); });