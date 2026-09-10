const express = require('express');
const { calculateScenarioImpact } = require('../services/scenarioService');
const router = express.Router();

// Helper: verify scenario belongs to project
function verifyScenarioBelongsToProject(projectId, scenarioId, prisma) {
  return prisma.scenario.findUnique({ where: { id: scenarioId } }).then(scenario => {
    if (!scenario) return { error: 'Scenario not found' };
    if (scenario.projectId !== projectId) {
      return { error: 'Scenario does not belong to this project' };
    }
    return { scenario };
  });
}

router.post('/projects/:id/scenarios', async (req, res, next) => {
  try {
    const { id: projectId } = req.params;
    const { label, corridorGeoJSON } = req.body;
    if (!label || !corridorGeoJSON) {
      return res.status(400).json({ error: 'label and corridorGeoJSON are required' });
    }

    const prisma = new (require('@prisma/client').PrismaClient)();
    const impact = await calculateScenarioImpact(projectId, corridorGeoJSON, prisma);

    const scenario = await prisma.scenario.create({
      data: {
        projectId,
        label,
        corridorGeoJSON,
        affectedParcels: impact.affectedParcels,
        affectedFamilies: impact.affectedFamilies,
        estimatedCompensation: impact.estimatedCompensation,
        rrRisk: impact.rrRisk,
        legalRisk: impact.legalRisk,
        envRisk: impact.envRisk,
        predictedDelayMonths: impact.predictedDelayMonths,
        overallRisk: impact.overallRisk,
        corridorLengthKm: impact.corridorLengthKm
      }
    });

    await prisma.$disconnect();
    res.json(scenario);
  } catch (error) {
    next(error);
  }
});

router.get('/projects/:id/scenarios', async (req, res, next) => {
  try {
    const { id: projectId } = req.params;
    const prisma = new (require('@prisma/client').PrismaClient)();
    const scenarios = await prisma.scenario.findMany({ where: { projectId } });
    await prisma.$disconnect();
    res.json(scenarios);
  } catch (error) {
    next(error);
  }
});

router.get('/projects/:id/scenarios/compare', async (req, res, next) => {
  try {
    const { id: projectId } = req.params;
    const { scenarioA, scenarioB } = req.query;

    if (!scenarioA || !scenarioB) {
      return res.status(400).json({ error: 'Both scenarioA and scenarioB query params are required' });
    }

    const prisma = new (require('@prisma/client').PrismaClient)();

    // Verify both scenarios belong to this project
    const [aCheck, bCheck] = await Promise.all([
      verifyScenarioBelongsToProject(projectId, scenarioA, prisma),
      verifyScenarioBelongsToProject(projectId, scenarioB, prisma)
    ]);

    if (aCheck.error) return res.status(404).json({ error: aCheck.error });
    if (bCheck.error) return res.status(404).json({ error: bCheck.error });

    const storedScenarioA = aCheck.scenario;
    const storedScenarioB = bCheck.scenario;

    // Recalculate impacts from stored data to ensure consistency
    // We'll use the stored fields directly for comparison since they were
    // calculated when the scenario was created
    const compareResult = {
      recommended: compareScenarios(
        {
          affectedParcels: storedScenarioA.affectedParcels,
          affectedFamilies: storedScenarioA.affectedFamilies,
          estimatedCompensation: storedScenarioA.estimatedCompensation,
          rrRisk: storedScenarioA.rrRisk,
          legalRisk: storedScenarioA.legalRisk,
          envRisk: storedScenarioA.envRisk,
          predictedDelayMonths: storedScenarioA.predictedDelayMonths,
          overallRisk: storedScenarioA.overallRisk,
          corridorLengthKm: storedScenarioA.corridorLengthKm
        },
        {
          affectedParcels: storedScenarioB.affectedParcels,
          affectedFamilies: storedScenarioB.affectedFamilies,
          estimatedCompensation: storedScenarioB.estimatedCompensation,
          rrRisk: storedScenarioB.rrRisk,
          legalRisk: storedScenarioB.legalRisk,
          envRisk: storedScenarioB.envRisk,
          predictedDelayMonths: storedScenarioB.predictedDelayMonths,
          overallRisk: storedScenarioB.overallRisk,
          corridorLengthKm: storedScenarioB.corridorLengthKm
        }
      ),
      scenarioA: { ...storedScenarioA },
      scenarioB: { ...storedScenarioB }
    };

    await prisma.$disconnect();
    res.json(compareResult);
  } catch (error) {
    next(error);
  }
});

module.exports = router;