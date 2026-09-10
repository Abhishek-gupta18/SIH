const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.$connect().then(async () => {
  try {
    const projects = await prisma.project.findMany({
      include: { parcels: { include: { compensation: true, rrRecord: true, people: true } } }
    });
    console.log('Projects:', projects.length);
    if (projects.length > 0) {
      const project = projects[0];
      console.log('Project:', project.name, 'ID:', project.id);
      console.log('Parcel count:', project.parcels.length);
      console.log('Corridor:', project.corridorGeoJSON ? 'present' : 'null');
      
      const scenarios = await prisma.scenario.findMany({ where: { projectId: project.id } });
      console.log('Scenarios:', scenarios.length);
      scenarios.forEach((s, i) => {
        console.log('Scenario', i, ':', s.id, 'label:', s.label, 'affectedParcels:', s.affectedParcels, 'affectedFamilies:', s.affectedFamilies, 'corridorLengthKm:', s.corridorLengthKm);
      });
      
      // Get a parcel
      if (project.parcels.length > 0) {
        const parcel = project.parcels[0];
        console.log('First parcel:', parcel.parcelCode, 'landType:', parcel.landType, 'areaAcres:', parcel.areaAcres);
      }
    }
    prisma.$disconnect();
  } catch (e) {
    console.error(e);
    prisma.$disconnect();
  }
}).catch(e => { console.error(e); prisma.$disconnect(); });