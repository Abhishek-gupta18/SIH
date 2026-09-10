const { PrismaClient } = require('@prisma/client');
const path = require('path');
const { calculateScenarioImpact } = require(path.join(__dirname, '..', 'src', 'services', 'scenarioService'));

const prismaClient = new PrismaClient();

async function main() {
  try {
    await prismaClient.$connect();

    // 1. Find a project with parcels that has corridorGeoJSON
    const project = await prismaClient.project.findFirst({
      include: { parcels: { include: { compensation: true, rrRecord: true, people: true } } }
    });

    if (!project) {
      console.log('No projects found. Exiting.');
      await prismaClient.$disconnect();
      return;
    }

    console.log('Project:', project.name, 'ID:', project.id);
    console.log('Existing corridorGeoJSON type:', project.corridorGeoJSON?.type);

    const corridorA = project.corridorGeoJSON;
    if (!corridorA) {
      console.log('Project has no corridorGeoJSON. Exiting.');
      await prismaClient.$disconnect();
      return;
    }

    // 2. Generate Option B by shifting coordinates slightly
    //    We'll create a new LineString by offsetting each coordinate's lat by ~0.03 degrees
    let corridorB;
    if (corridorA.type === 'LineString') {
      const shiftedCoords = corridorA.coordinates.map(([lng, lat]) => [
        lng, lat + 0.03 // shift north by ~3km approx
      ]);
      corridorB = {
        type: 'LineString',
        coordinates: shiftedCoords
      };
    } else if (corridorA.type === 'Polygon') {
      // Simple buffer-like shift for polygon
      const shiftedCoords = corridorA.coordinates.map(ring =>
        ring.map(([lng, lat]) => [lng, lat + 0.03])
      );
      corridorB = {
        type: 'Polygon',
        coordinates: [shiftedCoords[0]] // outer ring only for demo
      };
    } else {
      console.log('Unsupported corridor type:', corridorA.type);
      await prismaClient.$disconnect();
      return;
    }

    console.log('\n=== Option A (original corridor) ===');
    const impactA = await calculateScenarioImpact(project.id, corridorA, prismaClient);
    console.log('Affected parcels:', impactA.affectedParcels);
    console.log('Affected families:', impactA.affectedFamilies);
    console.log('Estimated compensation:', impactA.estimatedCompensation);
    console.log('RR risk:', impactA.rrRisk);
    console.log('Legal risk:', impactA.legalRisk);
    console.log('Env risk:', impactA.envRisk);
    console.log('Predicted delay months:', impactA.predictedDelayMonths);
    console.log('Overall risk:', impactA.overallRisk);

    console.log('\n=== Option B (shifted corridor) ===');
    const impactB = await calculateScenarioImpact(project.id, corridorB, prismaClient);
    console.log('Affected parcels:', impactB.affectedParcels);
    console.log('Affected families:', impactB.affectedFamilies);
    console.log('Estimated compensation:', impactB.estimatedCompensation);
    console.log('RR risk:', impactB.rrRisk);
    console.log('Legal risk:', impactB.legalRisk);
    console.log('Env risk:', impactB.envRisk);
    console.log('Predicted delay months:', impactB.predictedDelayMonths);
    console.log('Overall risk:', impactB.overallRisk);

    // 3. Compare using simple logic
    const compareResult = {
      recommended: impactA.affectedFamilies < impactB.affectedFamilies ? 'A' : 'B',
      reason: `Option ${impactA.affectedFamilies < impactB.affectedFamilies ? 'A' : 'B'} affects ${Math.min(impactA.affectedFamilies, impactB.affectedFamilies)} families vs the other's ${Math.max(impactA.affectedFamilies, impactB.affectedFamilies)}. Option ${
        impactA.affectedFamilies < impactB.affectedFamilies ? 'A' : 'B'
      } has ${impactA.predictedDelayMonths} predicted delay months vs ${
        impactB.predictedDelayMonths
      }. Legal risk ${impactA.legalRisk} vs ${impactB.legalRisk}. Overall risk ${impactA.overallRisk}/100 vs ${impactB.overallRisk}/100.`
    };

    console.log('\n=== Comparison ===');
    console.log(JSON.stringify(compareResult, null, 2));

    // 4. Now POST to create both scenarios via the API
    const { PrismaClient: PC } = require('@prisma/client');
    const prismaAPI = new PC();
    const app = require('./src/server').app;

    console.log('\n=== Creating Scenario A via API ===');
    const createA = await prismaAPI.$executeRaw`UNUSED`; // just to check
    // Use direct request via the app's close listen approach
    // We'll manually create scenarios using the service
    const { calculateScenarioImpact: csi } = require('./src/services/scenarioService');
    const prisma2 = new PC();

    // Create scenario A
    const impactA2 = await csi(project.id, corridorA, prisma2);
    const scenarioA = await prisma2.scenario.create({
      data: {
        projectId: project.id,
        label: 'Option A Original',
        corridorGeoJSON: corridorA,
        affectedParcels: impactA2.affectedParcels,
        affectedFamilies: impactA2.affectedFamilies,
        estimatedCompensation: impactA2.estimatedCompensation,
        rrRisk: impactA2.rrRisk,
        legalRisk: impactA2.legalRisk,
        envRisk: impactA2.envRisk,
        predictedDelayMonths: impactA2.predictedDelayMonths,
        overallRisk: impactA2.overallRisk
      }
    });
    await prisma2.$disconnect();
    console.log('Created Scenario A:', scenarioA.id);

    // Create scenario B
    const prisma3 = new PC();
    const impactB2 = await csi(project.id, corridorB, prisma3);
    const scenarioB = await prisma3.scenario.create({
      data: {
        projectId: project.id,
        label: 'Option B Shifted',
        corridorGeoJSON: corridorB,
        affectedParcels: impactB2.affectedParcels,
        affectedFamilies: impactB2.affectedFamilies,
        estimatedCompensation: impactB2.estimatedCompensation,
        rrRisk: impactB2.rrRisk,
        legalRisk: impactB2.legalRisk,
        envRisk: impactB2.envRisk,
        predictedDelayMonths: impactB2.predictedDelayMonths,
        overallRisk: impactB2.overallRisk
      }
    });
    await prisma3.$disconnect();
    console.log('Created Scenario B:', scenarioB.id);

    // 5. Compare via the API route logic
    // Manually call compareScenarios
    const { compareScenarios } = require(path.join(__dirname, '..', 'src', 'services', 'scenarioService'));
    const comparison = compareScenarios(
      {
        affectedParcels: impactA2.affectedParcels,
        affectedFamilies: impactA2.affectedFamilies,
        estimatedCompensation: impactA2.estimatedCompensation,
        rrRisk: impactA2.rrRisk,
        legalRisk: impactA2.legalRisk,
        envRisk: impactA2.envRisk,
        predictedDelayMonths: impactA2.predictedDelayMonths,
        overallRisk: impactA2.overallRisk
      },
      {
        affectedParcels: impactB2.affectedParcels,
        affectedFamilies: impactB2.affectedFamilies,
        estimatedCompensation: impactB2.estimatedCompensation,
        rrRisk: impactB2.rrRisk,
        legalRisk: impactB2.legalRisk,
        envRisk: impactB2.envRisk,
        predictedDelayMonths: impactB2.predictedDelayMonths,
        overallRisk: impactB2.overallRisk
      }
    );

    console.log('\n=== Comparison (via compareScenarios function) ===');
    console.log(JSON.stringify(comparison, null, 2));

    await prismaClient.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prismaClient.$disconnect();
  }
}

main();