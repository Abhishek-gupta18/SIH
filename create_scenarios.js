const { PrismaClient } = require('@prisma/client');
const { calculateScenarioImpact } = require('./src/services/scenarioService');
const prisma = new PrismaClient();

prisma.$connect().then(async () => {
  try {
    const project = await prisma.project.findFirst({ include: { parcels: { include: { compensation: true, rrRecord: true, people: true } } } });
    if (!project) { console.log('No project'); return; }
    
    const corridor = JSON.parse(project.corridorGeoJSON);
    console.log('Corridor type:', corridor.type, 'coords:', corridor.coordinates.length);
    
    // Create Option A (original corridor)
    const impactA = await calculateScenarioImpact(project.id, corridor, prisma);
    console.log('Impact A affectedParcels:', impactA.affectedParcels, 'affectedFamilies:', impactA.affectedFamilies);
    
    const scenarioA = await prisma.scenario.create({
      data: {
        projectId: project.id,
        label: 'Option A Original',
        corridorGeoJSON: project.corridorGeoJSON,
        affectedParcels: impactA.affectedParcels,
        affectedFamilies: impactA.affectedFamilies,
        estimatedCompensation: impactA.estimatedCompensation,
        rrRisk: impactA.rrRisk,
        legalRisk: impactA.legalRisk,
        envRisk: impactA.envRisk,
        predictedDelayMonths: impactA.predictedDelayMonths,
        overallRisk: impactA.overallRisk,
        corridorLengthKm: impactA.corridorLengthKm
      }
    });
    console.log('Created Scenario A:', scenarioA.id, 'corridorLengthKm:', impactA.corridorLengthKm);
    
    // Create Option B (shifted corridor)
    const corridorB = {
      type: 'LineString',
      coordinates: corridor.coordinates.map(([lng, lat]) => [lng, lat + 0.03])
    };
    const impactB = await calculateScenarioImpact(project.id, corridorB, prisma);
    console.log('Impact B affectedParcels:', impactB.affectedParcels, 'affectedFamilies:', impactB.affectedFamilies);
    
    const scenarioB = await prisma.scenario.create({
      data: {
        projectId: project.id,
        label: 'Option B Shifted',
        corridorGeoJSON: JSON.stringify(corridorB),
        affectedParcels: impactB.affectedParcels,
        affectedFamilies: impactB.affectedFamilies,
        estimatedCompensation: impactB.estimatedCompensation,
        rrRisk: impactB.rrRisk,
        legalRisk: impactB.legalRisk,
        envRisk: impactB.envRisk,
        predictedDelayMonths: impactB.predictedDelayMonths,
        overallRisk: impactB.overallRisk,
        corridorLengthKm: impactB.corridorLengthKm
      }
    });
    console.log('Created Scenario B:', scenarioB.id, 'corridorLengthKm:', impactB.corridorLengthKm);
    
    console.log('\nComparison:');
    const { compareScenarios } = require('./src/services/scenarioService');
    const comparison = compareScenarios(
      {
        affectedParcels: impactA.affectedParcels,
        affectedFamilies: impactA.affectedFamilies,
        estimatedCompensation: impactA.estimatedCompensation,
        rrRisk: impactA.rrRisk,
        legalRisk: impactA.legalRisk,
        envRisk: impactA.envRisk,
        predictedDelayMonths: impactA.predictedDelayMonths,
        overallRisk: impactA.overallRisk,
        corridorLengthKm: impactA.corridorLengthKm
      },
      {
        affectedParcels: impactB.affectedParcels,
        affectedFamilies: impactB.affectedFamilies,
        estimatedCompensation: impactB.estimatedCompensation,
        rrRisk: impactB.rrRisk,
        legalRisk: impactB.legalRisk,
        envRisk: impactB.envRisk,
        predictedDelayMonths: impactB.predictedDelayMonths,
        overallRisk: impactB.overallRisk,
        corridorLengthKm: impactB.corridorLengthKm
      }
    );
    console.log('Comparison:', JSON.stringify(comparison, null, 2));
    
    prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    prisma.$disconnect();
  }
}).catch(e => { console.error(e); prisma.$disconnect(); });