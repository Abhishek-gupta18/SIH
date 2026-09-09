const { v4: uuidv4 } = require('uuid');

/**
 * Risk Calculation Engine for BHUMI-TWIN
 * 
 * Transparent, rule-based weighted formula — no ML, fully explainable.
 * All weights and thresholds are documented inline so the team can
 * explain every point to judges or stakeholders.
 * 
 * Scoring scale: 0-100, with confidence floored at 30.
 * Level labels: 0-39 = "LOW", 40-69 = "ATTENTION", 70-100 = "HIGH"
 */

/**
 * Calculates an explainable 0-100 risk score for a parcel.
 * 
 * @param {Object} parcel - Full parcel object from Prisma (with relations: compensation?, rrRecord?, events?)
 * @returns {{ overallRisk: number, factors: { ownership: number, compensation: number, rr: number, legal: number }, confidence: number, level: string, explanation: string }}
 */
function calculateRisk(parcel) {
  // ── Ownership factor ──────────────────────────────────────────────
  const ownershipScore = parcel.ownershipConflict ? 80 : 15;

  // ── Legal factor ──────────────────────────────────────────────────
  const legalScore = parcel.litigationFlag ? 90 : 10;

  // ── Compensation factor ───────────────────────────────────────────
  const compensationRecord = parcel.compensation;
  let compensationScore;
  if (!compensationRecord) {
    compensationScore = 40;   // no record yet
  } else {
    switch (compensationRecord.status) {
      case 'PENDING':   compensationScore = 65; break;
      case 'PARTIAL':   compensationScore = 45; break;
      case 'PAID':      compensationScore = 10; break;
      default:          compensationScore = 40; break; // fallback
    }
  }

  // ── RR factor ─────────────────────────────────────────────────────
  const rrRecord = parcel.rrRecord;
  let rrScore;
  if (!rrRecord) {
    rrScore = 30;   // no record yet
  } else {
    switch (rrRecord.status) {
      case 'PENDING':    rrScore = 70; break;
      case 'IN_PROGRESS':rrScore = 45; break;
      case 'COMPLETED':  rrScore = 10; break;
      default:           rrScore = 30; break; // fallback
    }
  }

  // ── Overall risk (weighted average) ───────────────────────────────
  const overallRisk = Math.round(
    ownershipScore * 0.30 +
    legalScore * 0.25 +
    compensationScore * 0.25 +
    rrScore * 0.20
  );

  // ── Confidence ────────────────────────────────────────────────────
  let confidence = 100;
  if (!compensationRecord) confidence -= 20;
  if (!rrRecord) confidence -= 20;
  // subtract 15 if fewer than 2 AcquisitionEvents in history
  const eventCount = (parcel.events || []).length;
  if (eventCount < 2) confidence -= 15;
  if (confidence < 30) confidence = 30;

  // ── Risk level label ──────────────────────────────────────────────
  let level;
  if (overallRisk <= 39) level = 'LOW';
  else if (overallRisk <= 69) level = 'ATTENTION';
  else level = 'HIGH';

  // ── Explanation (2-4 sentences, varying by highest factors) ──────
  const ownershipHigh = parcel.ownershipConflict;
  const litigationHigh = parcel.litigationFlag;
  const compensationPending = compensationRecord && compensationRecord.status === 'PENDING';
  const compensationPaid = compensationRecord && compensationRecord.status === 'PAID';
  const rrPending = !rrRecord || rrRecord.status === 'PENDING';
  const rrNotStarted = !rrRecord;
  const rrCompleted = rrRecord && rrRecord.status === 'COMPLETED';

  let explanation;
  const riskLevelLabel = overallRisk >= 70 ? 'HIGH' : overallRisk >= 40 ? 'ATTENTION' : 'LOW';

  if (overallRisk >= 70) {
    // HIGH risk path
    const parts = [];
    if (ownershipHigh) {
      parts.push(`Ownership conflict flagged on this parcel.`);
    }
    if (litigationHigh) {
      parts.push(`Legal risk due to litigation flag on this parcel.`);
    }
    if (compensationPending || !compensationRecord) {
      parts.push(`Compensation status is ${compensationPending ? 'pending' : 'not yet established'}.`);
    }
    if (rrPending || !rrRecord) {
      parts.push(`R&R process has ${!rrRecord ? 'not started' : 'not been completed'}.`);
    }
    if (parts.length >= 3) {
      explanation = `HIGH RISK (${overallRisk}/100). ${parts.slice(0, 3).join(' ')} Recommended action: address the flagged risks before proceeding to the next milestone.`;
    } else {
      explanation = `HIGH RISK (${overallRisk}/100). ${parts.join(' ')} Recommended action: resolve the identified risks before proceeding.`;
    }
  } else if (overallRisk >= 40) {
    // ATTENTION risk path
    const parts = [];
    if (ownershipHigh) {
      parts.push(`There is an ownership concern on this parcel.`);
    }
    if (litigationHigh) {
      parts.push(`Legal scrutiny is warranted due to the litigation flag.`);
    }
    if (compensationRecord && compensationRecord.status === 'PARTIAL') {
      parts.push(`Compensation is currently partial.`);
    }
    if (!compensationRecord) {
      parts.push(`Compensation has not yet been established for this parcel.`);
    }
    if (rrRecord && rrRecord.status === 'IN_PROGRESS') {
      parts.push(`The R&R process is in progress.`);
    }
    if (!rrRecord) {
      parts.push(`The R&R process has not yet begun.`);
    }
    const selectedParts = parts.slice(0, 3);
    explanation = `ATTENTION (${overallRisk}/100). ${selectedParts.join(' ')} Monitoring is recommended before advancing to the next acquisition milestone.`;
  } else {
    // LOW risk path
    const parts = [];
    if (!ownershipHigh) {
      parts.push(`No ownership conflict is flagged for this parcel.`);
    }
    if (!litigationHigh) {
      parts.push(`No legal flag is active; the title status is clear.`);
    }
    if (compensationRecord && compensationRecord.status === 'PAID') {
      parts.push(`Compensation has been fully paid.`);
    }
    if (!compensationRecord && overallRisk < 40) {
      parts.push(`No compensation record is needed at this stage.`);
    }
    explanation = `LOW RISK (${overallRisk}/100). ${parts.join(' ')} The parcel can proceed to the next milestone without additional risk mitigation.`;
  }

  return {
    overallRisk,
    factors: {
      ownership: ownershipScore,
      compensation: compensationScore,
      rr: rrScore,
      legal: legalScore
    },
    confidence,
    level,
    explanation
  };
}

module.exports = { calculateRisk };