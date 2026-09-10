const { PrismaClient } = require('@prisma/client');
const { calculateScenarioImpact } = require('../src/services/scenarioService');

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$connect();

    const project = await prisma.project.findFirst({
      include: { parcels: { include: { compensation: true, rrRecord: true, people: true } } }
    });

    if (!project) {
      console.log('No projects found. Exiting.');
      await prisma.$disconnect();
      return;
    }

    console.log('Project:', project.name, 'ID:', project.id);
    console.log('corridorGeoJSON raw:', project.corridorGeoJSON?.substring(0, 80));

    const corridorA = JSON.parse(project.corridorGeoJSON);
    if (!corridorA) {
      console.log('No corridorGeoJSON. Exiting.');
      await prisma.$disconnect();
      return;
    }

    console.log('Corridor A type:', corridorA.type);
    console.log('Corridor A coordinates count:', corridorA.coordinates?.length);

    // Generate Option B by shifting coordinates slightly
    let corridorB;
    if (corridorA.type === 'LineString') {
      const shiftedCoords = corridorA.coordinates.map(([lng, lat]) => [lng, lat + 0.03]);
      corridorB = { type: 'LineString', coordinates: shiftedCoords };
    } else if (corridorA.type === 'Polygon') {
      const shiftedCoords = corridorA.coordinates.map(ring =>
        ring.map(([lng, lat]) => [lng, lat + 0.03])
      );
      corridorB = { type: 'Polygon', coordinates: [shiftedCoords[0]] };
    } else {
      console.log('Unsupported corridor type:', corridorA.type);
      await prisma.$disconnect();
      return;
    }

    console.log('\n=== Option A (original corridor) ===');
    const impactA = await calculateScenarioImpact(project.id, corridorA, prisma);
    console.log('Affected parcels:', impactA.affectedParcels);
    console.log('Affected families:', impactA.affectedFamilies);
    console.log('Estimated compensation:', impactA.estimatedCompensation);
    console.log('RR risk:', impactA.rrRisk);
    console.log('Legal risk:', impactA.legalRisk);
    console.log('Env risk:', impactA.envRisk);
    console.log('Predicted delay months:', impactA.predictedDelayMonths);
    console.log('Overall risk:', impactA.overallRisk);

    console.log('\n=== Option B (shifted corridor) ===');
    const impactB = await calculateScenarioImpact(project.id, corridorB, prisma);
    console.log('Affected parcels:', impactB.affectedParcels);
    console.log('Affected families:', impactB.affectedFamilies);
    console.log('Estimated compensation:', impactB.estimatedCompensation);
    console.log('RR risk:', impactB.rrRisk);
    console.log('Legal risk:', impactB.legalRisk);
    console.log('Env risk:', impactB.envRisk);
    console.log('Predicted delay months:', impactB.predictedDelayMonths);
    console.log('Overall risk:', impactB.overallRisk);

    // Comparison
    const scoreA = (impactA.affectedFamilies * 0.4) + (impactA.legalRisk * 0.3) + (impactA.rrRisk * 0.15) + (impactA.predictedDelayMonths * 0.15);
    const scoreB = (impactB.affectedFamilies * 0.4) + (impactB.legalRisk * 0.3) + (impactB.rrRisk * 0.15) + (impactB.predictedDelayMonths * 0.15);

    let recommended;
    let reason;
    if (scoreA < scoreB) {
      recommended = 'A';
      const familiesDiff = impactB.affectedFamilies - impactA.affectedFamilies;
      const delayDiff = impactB.predictedDelayMonths - impactA.predictedDelayMonths;
      const legalDiff = impactB.legalRisk - impactA.legalRisk;
      const rrDiff = impactB.rrRisk - impactA.rrRisk;
      reason = `Option A affects ${impactA.affectedFamilies} families vs Option B's ${impactB.affectedFamilies} (diff: ${familiesDiff}). Option A has ${impactA.predictedDelayMonths} predicted delay months vs ${impactB.predictedDelayMonths} (diff: ${delayDiff}). Legal risk ${impactA.legalRisk} vs ${impactB.legalRisk} (diff: ${legalDiff}). R&R risk ${impactA.rrRisk} vs ${impactB.rrRisk} (diff: ${rrDiff}). Overall risk ${impactA.overallRisk}/100 vs ${impactB.overallRisk}/100.`;
    } else {
      recommended = 'B';
      const familiesDiff = impactA.affectedFamilies - impactB.affectedFamilies;
      const delayDiff = impactA.predictedDelayMonths - impactB.predictedDelayMonths;
      const legalDiff = impactA.legalRisk - impactB.legalRisk;
      const rrDiff = impactA.rrRisk - impactB.rrRisk;
      reason = `Option B affects ${impactB.affectedFamilies} families vs Option A's ${impactA.affectedFamilies} (diff: ${familiesDiff}). Option B has ${impactB.predictedDelayMonths} predicted delay months vs ${impactA.predictedDelayMonths} (diff: ${delayDiff}). Legal risk ${impactB.legalRisk} vs ${impactA.legalRisk} (diff: ${legalDiff}). R&R risk ${impactB.rrRisk} vs ${impactA.rrRisk} (diff: ${rrDiff}). Overall risk ${impactB.overallRisk}/100 vs ${impactA.overallRisk}/100.`;
    }

    console.log('\n=== Comparison ===');
    console.log('Recommended:', recommended);
    console.log('Reason:', reason);

    // Create scenarios via API
    const app = require('../src/server').app;

    console.log('\n=== Creating Scenario A via API ===');
    const createA = await fetch('http://localhost:3000/projects/${project.id}/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Option A Original', corridorGeoJSON: JSON.stringify(corridorA) })
    });
    const createAData = await createA.json();
    console.log('Created Scenario A:', createAData.id);

    console.log('\n=== Creating Scenario B via API ===');
    const createB = await fetch('http://localhost:3000/projects/${project.id}/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Option B Shifted', corridorGeoJSON: JSON.stringify(corridorB) })
    });
    const createBData = await createB.json();
    console.log('Created Scenario B:', createBData.id);

    console.log('\n=== Comparing via API ===');
    const compareRes = await fetch(`http://localhost:3000/projects/${project.id}/scenarios/compare?scenarioA=${createAData.id}&scenarioB=${createBData.id}`);
    const compareData = await compareRes.json();
    console.log('Comparison result:');
    console.log(JSON.stringify(compareData, null, 2));

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
  }
}

main();