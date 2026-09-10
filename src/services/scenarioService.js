const { v4: uuidv4 } = require('uuid');
const turf = require('@turf/turf');
const { calculateRisk } = require('./riskService');

const LAND_TYPE_ESTIMATES = {
  Agricultural: 800000,
  Residential: 1500000,
  Commercial: 2500000,
  Barren: 300000,
  Forest: 1000000,
  Meadow: 600000,
  Wetland: 900000,
  Default: 800000
};

function estimateCompensation(parcel) {
  if (parcel.compensation && parcel.compensation.amountEstimated) {
    return parcel.compensation.amountEstimated;
  }
  const landType = parcel.landType || 'Default';
  const ratePerAcre = LAND_TYPE_ESTIMATES[landType] || LAND_TYPE_ESTIMATES.Default;
  const acres = parcel.areaAcres || 2;
  return Math.round(ratePerAcre * acres);
}

async function calculateScenarioImpact(projectId, corridorGeoJSON, prismaInstance) {
  const prisma = prismaInstance || new (require('@prisma/client').PrismaClient)();

  let corridorPolygon;
  // Compute corridor length BEFORE buffering (on the original LineString)
  let corridorLengthKm = 0;
  if (corridorGeoJSON.type === 'LineString') {
    corridorPolygon = turf.buffer(corridorGeoJSON, 2000, { units: 'meters' });
    // turf.length returns meters; convert to km
    corridorLengthKm = Math.round(turf.length(corridorGeoJSON, { units: 'kilometers' }));
  } else if (corridorGeoJSON.type === 'Polygon') {
    corridorPolygon = corridorGeoJSON;
  } else {
    throw new Error('corridorGeoJSON must be LineString or Polygon');
  }

  const projectParcels = await prisma.parcel.findMany({
    where: { projectId },
    include: {
      people: true,
      compensation: true,
      rrRecord: true,
      events: true
    }
  });

  const affectedParcels = [];
  const riskResults = [];

  for (const p of projectParcels) {
    let parcelFeature;
    try {
      if (p.geometryGeoJSON && p.geometryGeoJSON.type) {
        parcelFeature = turf.feature(p.geometryGeoJSON);
      } else {
        continue;
      }
    } catch (e) {
      continue;
    }

    if (turf.booleanIntersects(parcelFeature, corridorPolygon)) {
      affectedParcels.push(p);
      const risk = calculateRisk({
        ownershipConflict: p.ownershipConflict,
        litigationFlag: p.litigationFlag,
        compensation: p.compensation,
        rrRecord: p.rrRecord,
        events: p.events
      });
      riskResults.push(risk);
    }
  }

  // Aggregate affectedFamilies via PersonParcel relations
  const personIdSet = new Set();
  for (const p of affectedParcels) {
    if (p.people && p.people.length) {
      p.people.forEach(person => personIdSet.add(person.id));
    }
  }
  const affectedFamilies = personIdSet.size;

  // Estimated compensation sum
  const estimatedCompensation = affectedParcels.reduce((sum, p) => sum + estimateCompensation(p), 0);

  // Average rr factor and legal factor from risk calculations
  if (riskResults.length === 0) {
    return {
      affectedParcels: 0,
      affectedFamilies: 0,
      estimatedCompensation: 0,
      rrRisk: 0,
      legalRisk: 0,
      envRisk: 50,
      predictedDelayMonths: 12,
      overallRisk: 0
    };
  }

  const rrFactors = riskResults.map(r => r.factors.rr);
  const legalFactors = riskResults.map(r => r.factors.legal);
  const rrRisk = Math.round(rrFactors.reduce((s, v) => s + v, 0) / rrFactors.length);
  const legalRisk = Math.round(legalFactors.reduce((s, v) => s + v, 0) / legalFactors.length);

  // envRisk: heuristic based on landType distribution
  const landTypeCounts = {};
  affectedParcels.forEach(p => {
    const lt = p.landType || 'Default';
    landTypeCounts[lt] = (landTypeCounts[lt] || 0) + 1;
  });
  let envScore = 50;
  if (landTypeCounts.Agricultural) { envScore -= 20; }
  if (landTypeCounts.Barren) { envScore -= 10; }
  if (landTypeCounts.Residential || landTypeCounts.Commercial) { envScore += 15; }
  const envRisk = Math.max(0, Math.min(100, envScore));

  // predictedDelayMonths formula
  const averageOverallRisk = Math.round(
    riskResults.reduce((sum, r) => sum + r.overallRisk, 0) / riskResults.length
  );
  const predictedDelayMonths = Math.round(
    12 + affectedFamilies * 0.05 + (averageOverallRisk / 100) * 12
  );

  return {
    affectedParcels: affectedParcels.length,
    affectedFamilies,
    estimatedCompensation,
    rrRisk,
    legalRisk,
    envRisk,
    predictedDelayMonths,
    overallRisk: averageOverallRisk,
    corridorLengthKm
  };
}

function compareScenarios(scenarioAResult, scenarioBResult) {
  const { affectedFamilies: famA, predictedDelayMonths: delayA, legalRisk: legalA, rrRisk: rrA, overallRisk: riskA, corridorLengthKm: lenA } = scenarioAResult;
  const { affectedFamilies: famB, predictedDelayMonths: delayB, legalRisk: legalB, rrRisk: rrB, overallRisk: riskB, corridorLengthKm: lenB } = scenarioBResult;

  // Composite score: families (0.4) + legal risk (0.3) + rr risk (0.15) + predicted delay (0.15)
  // Lower score is better
  const scoreA = (famA * 0.4) + (legalA * 0.3) + (rrA * 0.15) + (delayA * 0.15);
  const scoreB = (famB * 0.4) + (legalB * 0.3) + (rrB * 0.15) + (delayB * 0.15);

  // Length delta computations
  const lengthDeltaKm = Math.abs(lenA - lenB);
  const lengthDeltaPercent = lenA > 0 && lenB > 0 ? Math.round(Math.abs(lenA - lenB) / Math.min(lenA, lenB) * 100) : 0;

  // Threshold logic: if length increases by more than 25% while the weighted
  // risk score improves by less than 10%, flag as disproportionate.
  // "Weighted risk score" here uses the composite score (same weights as above).
  const scoreImprovement = Math.abs(scoreA - scoreB);
  const disproportionateThreshold = 25;   // length % increase flag
  const riskImprovementThreshold = 10;    // composite score % improvement flag
  const isDisproportionate = lengthDeltaPercent > disproportionateThreshold &&
                             scoreImprovement < riskImprovementThreshold;

  // rrDiff, familiesDiff, delayDiff computed once, available in both branches
  const rrDiff = rrA - rrB;
  const familiesDiff = famB - famA;
  const delayDiff = delayB - delayA;

  let recommended;
  let reasonParts = [];

  if (scoreA < scoreB) {
    recommended = 'A';
    // familiesDiff, delayDiff, rrDiff computed at function scope (lines 168-169)

    reasonParts.push(`Option A affects ${famA} families vs Option B's ${famB}`);
    if (familiesDiff !== 0) {
      reasonParts.push(`${familiesDiff > 0 ? 'affects' : 'has'} ${Math.abs(familiesDiff)} fewer${familiesDiff !== 1 ? ' families' : ' family'}`);
    }
    reasonParts.push(`with ${delayA} predicted delay months vs Option B's ${delayB}`);
    if (legalDiff !== 0) {
      reasonParts.push(`and ${legalDiff > 0 ? 'lower' : 'higher'} legal risk (${legalA} vs ${legalB})`);
    }
    if (rrDiff !== 0) {
      reasonParts.push(`${rrDiff > 0 ? 'better' : 'worse'} R&R risk profile (${rrA} vs ${rrB})`);
    }
    reasonParts.push(`overall risk ${riskA}/100 vs ${riskB}/100`);

    // Add length trade-off text if disproportionate flag is triggered
    if (isDisproportionate) {
      reasonParts.push(`Option A requires ${lengthDeltaPercent}% less corridor length than Option B, but Option B's composite risk score is only ${Math.round(scoreImprovement)} points better — a disproportionate trade-off.`);
    } else if (lengthDeltaPercent > 0) {
      reasonParts.push(`Option A requires ${lengthDeltaPercent}% less corridor length than Option B.`);
    }
  } else {
    recommended = 'B';
    // familiesDiff, delayDiff, rrDiff computed at function scope (lines 168-169)

    reasonParts.push(`Option B affects ${famB} families vs Option A's ${famA}`);
    if (familiesDiff !== 0) {
      reasonParts.push(`${familiesDiff > 0 ? 'affects' : 'has'} ${Math.abs(familiesDiff)} fewer${familiesDiff !== 1 ? ' families' : ' family'}`);
    }
    reasonParts.push(`with ${delayB} predicted delay months vs Option A's ${delayA}`);
    if (legalDiff !== 0) {
      reasonParts.push(`${legalDiff > 0 ? 'lower' : 'higher'} legal risk (${legalA} vs ${legalB})`);
    }
    if (rrDiff !== 0) {
      reasonParts.push(`${rrDiff > 0 ? 'better' : 'worse'} R&R risk profile (${rrA} vs ${rrB})`);
    }
    reasonParts.push(`overall risk ${riskB}/100 vs ${riskA}/100`);

    // Add length trade-off text if disproportionate flag is triggered
    if (isDisproportionate) {
      reasonParts.push(`Option B requires ${lengthDeltaPercent}% less corridor length than Option A, but Option A's composite risk score is only ${Math.round(scoreImprovement)} points better — a disproportionate trade-off.`);
    } else if (lengthDeltaPercent > 0) {
      reasonParts.push(`Option B requires ${lengthDeltaPercent}% less corridor length than Option A.`);
    }
  }

  const reason = reasonParts.join('. ') + '.';

  return {
    recommended,
    reason,
    lengthDeltaKm,
    lengthDeltaPercent,
    tradeoffFlag: isDisproportionate
  };
}

module.exports = { calculateScenarioImpact, compareScenarios };