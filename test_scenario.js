const { PrismaClient } = require('@prisma/client');
const { calculateScenarioImpact } = require('./src/services/scenarioService');
const prisma = new PrismaClient();

prisma.$connect().then(async () => {
  try {
    const project = await prisma.project.findFirst({ include: { parcels: true } });
    if (!project) { console.log('No project found'); return; }
    
    console.log('Project:', project.name, 'ID:', project.id);
    console.log('Corridor type:', project.corridorGeoJSON?.type);
    
    // corridorGeoJSON is stored as a JSON string - parse it
    const corridor = JSON.parse(project.corridorGeoJSON);
    if (!corridor) { console.log('No corridorGeoJSON'); return; }
    
    const impact = await calculateScenarioImpact(project.id, corridor, prisma);
    console.log('\n=== Impact Results ===');
    console.log(JSON.stringify(impact, null, 2));
    
    // Now test compareScenarios
    const { compareScenarios } = require('./src/services/scenarioService');
    
    // Create a dummy Option B with different numbers
    const impactB = {
      affectedParcels: impact.affectedParcels > 5 ? Math.round(impact.affectedParcels * 0.6) : 5,
      affectedFamilies: impact.affectedFamilies > 10 ? Math.round(impact.affectedFamilies * 0.7) : 10,
      estimatedCompensation: impact.estimatedCompensation * 1.2,
      rrRisk: impact.rrRisk,
      legalRisk: impact.legalRisk,
      envRisk: impact.envRisk,
      predictedDelayMonths: impact.predictedDelayMonths,
      overallRisk: impact.overallRisk
    };
    
    const comparison = compareScenarios(impact, impactB);
    console.log('\n=== Comparison ===');
    console.log(JSON.stringify(comparison, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    prisma.$disconnect();
  }
}).catch(e => { console.error(e); prisma.$disconnect(); });