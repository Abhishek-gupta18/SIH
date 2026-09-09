const { PrismaClient } = require('@prisma/client');
const { calculateRisk } = require('./src/services/riskService');
const prisma = new PrismaClient();

prisma.$connect().then(async () => {
  const project = await prisma.project.findUnique({
    where: { id: 'cmtuk4ygs0000v578t8kc048u' },
    include: { parcels: true }
  });
  console.log('Project:', project.name, 'Parcels:', project.parcels.length);
  
  const riskResults = project.parcels.map(p => calculateRisk(p));
  const highRisk = riskResults.filter(r => r.level === 'HIGH').length;
  const attentionRisk = riskResults.filter(r => r.level === 'ATTENTION').length;
  const lowRisk = riskResults.filter(r => r.level === 'LOW').length;
  const avgRisk = Math.round(riskResults.reduce((s, r) => s + r.overallRisk, 0) / riskResults.length);
  
  console.log('High:', highRisk, 'Attention:', attentionRisk, 'Low:', lowRisk, 'AvgRisk:', avgRisk);
  
  const top3 = riskResults.slice(0, 3).map(r => ({ overallRisk: r.overallRisk, level: r.level, parcelCode: r.parcelCode }));
  console.log('Top 3:', top3);
  
  prisma.$disconnect();
}).catch(e => { console.error(e); prisma.$disconnect(); });