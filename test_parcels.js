const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.$connect().then(() => {
  return prisma.parcel.findMany({ take: 10 });
}).then(parcels => {
  parcels.forEach(parcel => {
    console.log('ID:', parcel.id, 'Code:', parcel.parcelCode, 'Status:', parcel.acquisitionStatus, 'Ownership:', parcel.ownershipConflict, 'Litigation:', parcel.litigationFlag);
  });
  prisma.$disconnect();
}).catch(e => { console.error(e); prisma.$disconnect(); });