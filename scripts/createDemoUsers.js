require('dotenv').config();

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const demoPassword = 'demo1234';

async function main() {
  // Run `node scripts/createDemoUsers.js` again any time the database has been
  // reseeded — parcel IDs change on every reseed, so the citizen demo user's
  // link must be refreshed after that.
  const parcel = await prisma.parcel.findFirst({
    orderBy: { parcelCode: 'asc' },
    select: { id: true, parcelCode: true }
  });
  if (!parcel) {
    throw new Error('No parcels found. Run the project seed before creating demo users.');
  }

  const passwordHash = await bcrypt.hash(demoPassword, 10);
  const admin = await prisma.user.findUnique({ where: { email: 'admin@bhumitwin.demo' } });
  if (!admin) {
    await prisma.user.create({
      data: {
        email: 'admin@bhumitwin.demo',
        passwordHash,
        role: 'ADMIN'
      }
    });
    console.log('Created admin demo user.');
  } else {
    console.log('Admin demo user already exists; left unchanged.');
  }

  const officer = await prisma.user.findUnique({ where: { email: 'officer@bhumitwin.demo' } });
  if (!officer) {
    await prisma.user.create({
      data: {
        email: 'officer@bhumitwin.demo',
        passwordHash,
        role: 'OFFICER'
      }
    });
    console.log('Created officer demo user.');
  } else {
    console.log('Officer demo user already exists; left unchanged.');
  }

  const citizen = await prisma.user.findUnique({ where: { email: 'citizen@bhumitwin.demo' } });
  if (citizen) {
    await prisma.user.update({
      where: { id: citizen.id },
      data: { linkedCaseId: parcel.id, role: 'CITIZEN' }
    });
  } else {
    await prisma.user.create({
      data: {
        email: 'citizen@bhumitwin.demo',
        passwordHash,
        role: 'CITIZEN',
        linkedCaseId: parcel.id
      }
    });
  }

  console.log(`Citizen demo user linked to parcel: ${parcel.parcelCode} (id: ${parcel.id})`);
}

main()
  .catch((error) => {
    console.error('Could not create demo users:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
