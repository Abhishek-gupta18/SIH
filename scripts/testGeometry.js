const { PrismaClient } = require('@prisma/client');
const turf = require('@turf/turf');

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$connect();

    // Import the fixed parcelGeometry function logic inline
    function parcelGeometry(index) {
      const progress = index / (279); // statusPlan.length - 1 = 279
      const rowOffset = (index % 5 - 2) * 0.0032;
      const longitude = 76.82 + progress * 0.28;
      const latitude = 18.48 + progress * 0.25 + rowOffset;
      const baseSize = 0.001 + (index % 7) * 0.0002;
      const width = baseSize;
      const height = baseSize;

      return {
        type: 'Polygon',
        coordinates: [[
          [longitude - width, latitude - height],
          [longitude + width, latitude - height],
          [longitude + width, latitude + height],
          [longitude - width, latitude + height],
          [longitude - width, latitude - height]
        ]]
      };
    }

    // Test 4 sample indices
    console.log('=== Turf Area Test for Sample Parcels ===\n');
    for (const idx of [0, 5, 20, 100]) {
      const poly = parcelGeometry(idx);
      const feature = turf.feature(poly);
      const area = turf.area(feature);
      const sqMeters = Math.round(area);
      const halfSizeM = Math.round(0.001 * 111320 * 2); // rough 100m half-side
      console.log(`Index ${idx}: area=${sqMeters} sq.m (expected ~${halfSizeM*2}×${halfSizeM*2}m ≈ ${halfSizeM*halfSizeM*4} sq.m)`);
      console.log(`  Coordinates: ${JSON.stringify(feature.geometry.coordinates[0].map(p => `${p[0]},${p[1]}`).join('; '))}`);
      
      if (area === 0 || isNaN(area)) {
        console.log('  WARNING: Zero or invalid area!');
      }
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();