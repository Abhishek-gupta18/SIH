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
  
  // Show top 3 parcels with risk
  riskResults.slice(0, 3).forEach(r => {
    console.log('Parcel', r.overallRisk, '/100, level:', r.level, '-', r.explanation.substring(0, 60) + '...');
  });
  
  prisma.$disconnect();
}).catch(e => { console.error(e); prisma.$disconnect(); });