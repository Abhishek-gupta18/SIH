const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Small deterministic PRNG so every rehearsal gets the same demo dataset.
let randomState = 20260910;
const random = () => {
  randomState = (randomState * 1664525 + 1013904223) >>> 0;
  return randomState / 4294967296;
};

const pick = (items) => items[Math.floor(random() * items.length)];
const round = (value, decimals = 2) => Number(value.toFixed(decimals));

const villages = [
  'Khedgaon',
  'Nandpur',
  'Bhavanipur',
  'Rampur Khurd',
  'Devli',
  'Sundarpur',
  'Lakshmipura',
  'Chandkheda'
];

const landTypes = [
  { name: 'Agricultural', weight: 60 },
  { name: 'Residential', weight: 20 },
  { name: 'Commercial', weight: 10 },
  { name: 'Barren', weight: 10 }
];

const statusPlan = [
  ...Array(9).fill('PROPOSAL'),
  ...Array(18).fill('SURVEY'),
  ...Array(26).fill('NOTIFICATION'),
  ...Array(18).fill('OBJECTION'),
  ...Array(44).fill('AWARD'),
  ...Array(35).fill('COMPENSATION'),
  ...Array(17).fill('RR'),
  ...Array(8).fill('POSSESSION')
];

const statusOrder = [
  'PROPOSAL',
  'SURVEY',
  'NOTIFICATION',
  'OBJECTION',
  'AWARD',
  'COMPENSATION',
  'RR',
  'POSSESSION'
];

const eventRemarks = {
  PROPOSAL: 'Alignment proposal recorded for preliminary review',
  SURVEY: 'Joint field survey completed with village revenue staff',
  NOTIFICATION: 'Statutory notification served and acknowledgement filed',
  OBJECTION: 'Objection hearing scheduled before the competent authority',
  AWARD: 'Compensation award approved and notice issued',
  COMPENSATION: 'Compensation payment processed against the award',
  RR: 'Resettlement and rehabilitation case moved to implementation',
  POSSESSION: 'Possession memorandum signed and site handed over'
};

const firstNames = [
  'Aarav', 'Aditi', 'Ajay', 'Akhilesh', 'Ananya', 'Anil', 'Anita', 'Anjali',
  'Arjun', 'Bhavna', 'Bharat', 'Chetan', 'Deepak', 'Deepika', 'Devendra',
  'Dhanraj', 'Divya', 'Farida', 'Gaurav', 'Geeta', 'Harish', 'Isha',
  'Jagdish', 'Jaya', 'Jyoti', 'Kailash', 'Kavita', 'Kiran', 'Lalit',
  'Meena', 'Mohan', 'Mukesh', 'Nandini', 'Naveen', 'Neha', 'Nikhil',
  'Pallavi', 'Pankaj', 'Pooja', 'Prakash', 'Priya', 'Rahul', 'Rajendra',
  'Rakesh', 'Rani', 'Rekha', 'Rohit', 'Sanjay', 'Sarita', 'Seema',
  'Shankar', 'Shanti', 'Shivam', 'Shruti', 'Sita', 'Sohan', 'Sunita',
  'Suresh', 'Usha', 'Vijay', 'Vinod'
];

const lastNames = [
  'Bhosale', 'Chavan', 'Deshmukh', 'Gaikwad', 'Jadhav', 'Joshi', 'Kadam',
  'Kamble', 'Kulkarni', 'Lohar', 'Mali', 'Mane', 'More', 'Patil', 'Pawar',
  'Rathod', 'Salunkhe', 'Shinde', 'Shirke', 'Thakur', 'Wagh', 'Yadav',
  'Borkar', 'Darekar', 'Gawande', 'Kharat', 'Mhatre', 'Nikam', 'Sable',
  'Sawant', 'Tambe', 'Wankhede', 'Zade'
];

function chooseLandType() {
  const target = random() * 100;
  let cumulative = 0;
  for (const landType of landTypes) {
    cumulative += landType.weight;
    if (target < cumulative) return landType.name;
  }
  return 'Agricultural';
}

function parcelGeometry(index) {
  const progress = index / (statusPlan.length - 1);
  const rowOffset = (index % 5 - 2) * 0.0032;
  const longitude = 76.82 + progress * 0.28;
  const latitude = 18.48 + progress * 0.25 + rowOffset;
  // Base parcel size ~100m in degrees (~0.001°); vary slightly by areaAcres
  const baseSize = 0.001 + (index % 7) * 0.0002;
  const width = baseSize;
  const height = baseSize;

  return JSON.stringify({
    type: 'Polygon',
    coordinates: [[
      [longitude - width, latitude - height],
      [longitude + width, latitude - height],
      [longitude + width, latitude + height],
      [longitude - width, latitude + height],
      [longitude - width, latitude - height]  // close the ring
    ]]
  });
}

function corridorGeometry() {
  return JSON.stringify({
    type: 'LineString',
    coordinates: [
      [76.80, 18.45],
      [76.87, 18.51],
      [76.95, 18.58],
      [77.04, 18.67],
      [77.12, 18.76]
    ]
  });
}

function eventDate(eventIndex, totalEvents) {
  const start = Date.UTC(2025, 8, 15);
  const end = Date.UTC(2026, 7, 20);
  const timestamp = start + ((end - start) * eventIndex) / Math.max(totalEvents - 1, 1);
  return new Date(timestamp);
}

function eventHistory(status) {
  const statusIndex = statusOrder.indexOf(status);
  const events = statusOrder.slice(0, statusIndex + 1);
  if (events.length === 1) events.push('FIELD_INSPECTION');
  return events;
}

function compensationFor(parcel, status, index) {
  const basePerAcre = {
    Agricultural: 920000,
    Residential: 2850000,
    Commercial: 5100000,
    Barren: 380000
  }[parcel.landType];
  const estimated = round(parcel.areaAcres * basePerAcre * (0.92 + (index % 7) * 0.025), 2);
  let paidRatio;
  if (status === 'POSSESSION') {
    paidRatio = index % 7 === 0 ? 0.88 : 1;
  } else if (status === 'RR') {
    paidRatio = index % 4 === 0 ? 0.6 : 0.85;
  } else {
    paidRatio = index % 3 === 0 ? 0 : 0.35;
  }
  const amountPaid = round(estimated * paidRatio, 2);
  const paymentStatus = amountPaid === 0 ? 'PENDING' : amountPaid >= estimated ? 'PAID' : 'PARTIAL';
  return { amountEstimated: estimated, amountPaid, status: paymentStatus };
}

async function main() {
  console.log('Clearing existing seeded data...');
  await prisma.acquisitionEvent.deleteMany();
  await prisma.compensation.deleteMany();
  await prisma.rRRecord.deleteMany();
  await prisma.personParcel.deleteMany();
  await prisma.parcel.deleteMany();
  await prisma.person.deleteMany();
  await prisma.project.deleteMany();

  const project = await prisma.project.create({
    data: {
      name: 'NH-52 Green Energy Corridor Expansion',
      district: 'Nandurbar',
      corridorGeoJSON: corridorGeometry(),
      healthScore: 60
    }
  });
  console.log(`Created project: ${project.name}`);

  const people = [];
  for (let index = 0; index < 160; index += 1) {
    const firstName = firstNames[index % firstNames.length];
    const lastName = lastNames[(index * 7 + Math.floor(index / firstNames.length)) % lastNames.length];
    people.push(await prisma.person.create({
      data: { name: `${firstName} ${lastName}` }
    }));
  }
  console.log(`Seeded ${people.length} persons...`);

  const parcels = [];
  const links = [];
  const eventRows = [];
  const compensationRows = [];
  const rrRows = [];
  for (let index = 0; index < statusPlan.length; index += 1) {
    const status = statusPlan[index];
    const landType = chooseLandType();
    const areaAcres = round(0.5 + random() * 4.5, 2);
    const ownershipConflict = index % 8 === 0 || index % 29 === 0;
    const litigationFlag = index % 23 === 0 || (ownershipConflict && index % 11 === 0);
    const parcel = {
      parcelCode: `P-${1024 + index}`,
      village: villages[index % villages.length],
      landType,
      areaAcres,
      geometryGeoJSON: parcelGeometry(index),
      acquisitionStatus: status,
      ownershipConflict,
      litigationFlag
    };
    const history = eventHistory(status);
    const eventData = history.map((eventType, eventIndex) => ({
      eventType,
      eventDate: eventDate(index + eventIndex, statusPlan.length + history.length),
      remarks: eventRemarks[eventType] || 'Field verification note recorded during parcel review'
    }));
    const hasCompensation = ['COMPENSATION', 'RR', 'POSSESSION'].includes(status);
    const hasRR = ['RR', 'POSSESSION'].includes(status) || (status === 'COMPENSATION' && index % 12 === 0);
    const created = await prisma.parcel.create({ data: { ...parcel, projectId: project.id } });
    parcels.push(created);
    eventRows.push(...eventData.map((event) => ({ ...event, parcelId: created.id })));
    if (hasCompensation) {
      compensationRows.push({ parcelId: created.id, ...compensationFor(parcel, status, index) });
    }
    if (hasRR) {
      rrRows.push({
        parcelId: created.id,
        status: status === 'POSSESSION' ? 'COMPLETED' : (index % 3 === 0 ? 'PENDING' : 'IN_PROGRESS'),
        remarks: index % 3 === 0
          ? pick(['Awaiting relocation housing allotment', 'Livelihood assistance disbursed', 'Joint verification pending'])
          : null
      });
    }

    const ownerIndex = (index * 7 + Math.floor(index / 11)) % people.length;
    links.push({ personId: people[ownerIndex].id, parcelId: created.id, relationshipType: 'OWNER' });
    const linkedPersonIndexes = new Set([ownerIndex]);
    if (index % 10 < 3) {
      const additionalCount = index % 2 === 0 ? 2 : 1;
      for (let extra = 0; extra < additionalCount; extra += 1) {
        let personIndex = (ownerIndex + 13 + extra * 17 + index) % people.length;
        while (linkedPersonIndexes.has(personIndex)) {
          personIndex = (personIndex + 1) % people.length;
        }
        linkedPersonIndexes.add(personIndex);
        links.push({
          personId: people[personIndex].id,
          parcelId: created.id,
          relationshipType: extra === 0 ? 'TENANT' : 'WORKER'
        });
      }
    }
  }

  await prisma.acquisitionEvent.createMany({ data: eventRows });
  await prisma.compensation.createMany({ data: compensationRows });
  await prisma.rRRecord.createMany({ data: rrRows });
  await prisma.personParcel.createMany({ data: links });
  console.log(`Seeded ${parcels.length} parcels...`);
  console.log(`Seeded ${links.length} person-parcel links...`);

  const counts = {
    projects: await prisma.project.count(),
    parcels: await prisma.parcel.count(),
    persons: await prisma.person.count(),
    personParcels: await prisma.personParcel.count(),
    acquisitionEvents: await prisma.acquisitionEvent.count(),
    compensation: await prisma.compensation.count(),
    rrRecords: await prisma.rRRecord.count()
  };

  console.log('Seed complete. Summary:');
  console.table(counts);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
