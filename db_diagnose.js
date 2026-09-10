const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.$connect().then(async () => {
  try {
    const project = await prisma.project.findFirst({
      include: { parcels: true }
    });
    
    // We'll get parcels separately and read geometryGeoJSON from the raw data
    const allParcels = await prisma.parcel.findMany({
      where: { projectId: project.id },
      take: 20,
      select: { id: true, landType: true, areaAcres: true, geometryGeoJSON: true }
    });

    if (project) {
      console.log('Project:', project.name);
      console.log('Parcel count in DB:', project.parcels.length);

      // Corridor
      console.log('\n=== Corridor GeoJSON ===');
      if (project.corridorGeoJSON) {
        try {
          const c = JSON.parse(project.corridorGeoJSON);
          console.log('type:', c.type);
          console.log('coordinates length:', c.coordinates.length);
          console.log('coordinates sample:', JSON.stringify(c.coordinates).substring(0, 200));
          
          // Compute corridor ranges
          let allLng = [], allLat = [];
          for (const ring of c.coordinates) {
            for (const point of ring) {
              allLng.push(point[0]);
              allLat.push(point[1]);
            }
          }
          console.log('Corridor lng range:', Math.min(...allLng).toFixed(4), '-', Math.max(...allLng).toFixed(4));
          console.log('Corridor lat range:', Math.min(...allLat).toFixed(4), '-', Math.max(...allLat).toFixed(4));
        } catch(e) {
          console.log('Corridor parse error:', e.message);
        }
      } else {
        console.log('No corridorGeoJSON');
      }

      // Sample parcels
      console.log('\n=== 20 Sample Parcels from DB ===');
      let degenerateCount = 0;
      let validCount = 0;
      
      for (let i = 0; i < allParcels.length; i++) {
        const p = allParcels[i];
        if (!p.geometryGeoJSON) {
          console.log(`Parcel ${i}: NO geometryGeoJSON`);
          degenerateCount++;
          continue;
        }
        try {
          const g = JSON.parse(p.geometryGeoJSON);
          if (!g.type || !g.coordinates || g.coordinates.length === 0) {
            console.log(`Parcel ${i}: empty/invalid geometry type=${g.type}, coords=${g.coordinates?.length}`);
            degenerateCount++;
            continue;
          }
          
          // Check if all points are the same (degenerate)
          const allPoints = [];
          for (const ring of g.coordinates) {
            for (const point of ring) {
              allPoints.push(point);
            }
          }
          
          if (allPoints.length < 3) {
            console.log(`Parcel ${i}: Not enough points (${allPoints.length}), degenerate`);
            degenerateCount++;
            continue;
          }
          
          // Check if all points are identical
          const firstPoint = allPoints[0];
          const allSame = allPoints.every(p => p[0] === firstPoint[0] && p[1] === firstPoint[1]);
          if (allSame) {
            console.log(`Parcel ${i}: All ${allPoints.length} points identical, degenerate`);
            degenerateCount++;
            continue;
          }
          
          validCount++;
          
          // Compute parcel ranges
          let minLng = Infinity, maxLng = -Infinity;
          let minLat = Infinity, maxLat = -Infinity;
          for (const ring of g.coordinates) {
            for (const point of ring) {
              if (point[0] < minLng) minLng = point[0];
              if (point[0] > maxLng) maxLng = point[0];
              if (point[1] < minLat) minLat = point[1];
              if (point[1] > maxLat) maxLat = point[1];
            }
          }
          
          const pointCount = g.coordinates.reduce((sum, ring) => sum + ring.length, 0);
          console.log(`Parcel ${i}: landType=${p.landType}, type=${g.type}, points=${pointCount}, lng range=[${minLng.toFixed(4)}, ${maxLng.toFixed(4)}], lat range=[${minLat.toFixed(4)}, ${maxLat.toFixed(4)}]`);
          
          // Only show first 3 valid parcels
          if (i >= 3) break;
          
        } catch(e) {
          console.log(`Parcel ${i}: Geometry parse error: ${e.message}`);
          degenerateCount++;
        }
      }
      
      console.log(`\nSummary: ${validCount} valid parcels, ${degenerateCount} degenerate parcels checked`);

    } else {
      console.log('No project found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    prisma.$disconnect();
  }
}).catch(e => { console.error('Prisma init error:', e); prisma.$disconnect(); });