require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const createAuthRouter = require('./routes/auth');
const createCitizenRouter = require('./routes/citizen');
const createFieldRouter = require('./routes/field');
const { calculateRisk } = require('./services/riskService');
const createScenarioRouter = require('./routes/scenarios');

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/auth', createAuthRouter(prisma));
app.use('/citizen', createCitizenRouter(prisma));
app.use('/field', createFieldRouter(prisma));
app.use(createScenarioRouter());

app.get('/parcels/:id/risk', async (req, res, next) => {
  try {
    const { id } = req.params;
    const parcel = await prisma.parcel.findUnique({
      where: { id },
      select: {
        id: true,
        parcelCode: true,
        ownershipConflict: true,
        litigationFlag: true,
        compensation: {
          select: { status: true }
        },
        rrRecord: {
          select: { status: true }
        },
        events: { select: { eventType: true } }
      }
    });
    if (!parcel) {
      return res.status(404).json({ error: 'Parcel not found' });
    }
    const risk = calculateRisk(parcel);
    return res.json({ parcelId: id, parcelCode: parcel.parcelCode, ...risk });
  } catch (error) {
    return next(error);
  }
});

app.get('/projects/:id/risk-summary', async (req, res, next) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: { 
        parcels: {
          include: {
            compensation: true,
            rrRecord: true,
            events: { orderBy: { eventDate: 'asc' } }
          }
        }
      }
    });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const parcels = project.parcels;
    const riskResults = parcels.map(parcel => calculateRisk(parcel));

    const highRiskCount = riskResults.filter(r => r.level === 'HIGH').length;
    const attentionCount = riskResults.filter(r => r.level === 'ATTENTION').length;
    const lowRiskCount = riskResults.filter(r => r.level === 'LOW').length;
    const averageRisk = Math.round(
      riskResults.reduce((sum, r) => sum + r.overallRisk, 0) / riskResults.length
    );

    const topRiskParcels = riskResults
      .sort((a, b) => b.overallRisk - a.overallRisk)
      .slice(0, 5)
      .map(r => ({
        overallRisk: r.overallRisk,
        level: r.level,
        explanation: r.explanation,
        confidence: r.confidence,
        factors: r.factors
      }));

    return res.json({
      highRiskCount,
      attentionCount,
      lowRiskCount,
      averageRisk,
      topRiskParcels: topRiskParcels.map(r => ({
        overallRisk: r.overallRisk,
        level: r.level,
        explanation: r.explanation,
        confidence: r.confidence,
        factors: r.factors
      }))
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/parcels/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const parcel = await prisma.parcel.findUnique({
      where: { id },
      include: {
        project: true,
        compensation: true,
        rrRecord: true,
        events: { orderBy: { eventDate: 'asc' } }
      }
    });
    if (!parcel) {
      return res.status(404).json({ error: 'Parcel not found' });
    }

    const riskPreview = {
      overallRisk: 0,
      level: 'LOW'
    };

    // Calculate risk inline and include preview
    const risk = calculateRisk(parcel);
    riskPreview.overallRisk = risk.overallRisk;
    riskPreview.level = risk.level;

    // Build response with riskPreview inline
    const response = {
      id: parcel.id,
      parcelCode: parcel.parcelCode,
      name: parcel.name,
      district: parcel.district,
      corridorGeoJSON: parcel.corridorGeoJSON,
      acquisitionStatus: parcel.acquisitionStatus,
      ownershipConflict: parcel.ownershipConflict,
      litigationFlag: parcel.litigationFlag,
      areaAcres: parcel.areaAcres,
      healthScore: parcel.healthScore,
      createdAt: parcel.createdAt,
      riskPreview,
      projectId: parcel.projectId
    };

    // Include relations selectively
    if (parcel.project) {
      response.project = {
        id: parcel.project.id,
        name: parcel.project.name,
        district: parcel.project.district
      };
    }
    if (parcel.compensation) {
      response.compensation = {
        id: parcel.compensation.id,
        amountEstimated: parcel.compensation.amountEstimated,
        amountPaid: parcel.compensation.amountPaid,
        status: parcel.compensation.status
      };
    }
    if (parcel.rrRecord) {
      response.rrRecord = {
        id: parcel.rrRecord.id,
        status: parcel.rrRecord.status,
        remarks: parcel.rrRecord.remarks
      };
    }

    return res.json(response);
  } catch (error) {
    return next(error);
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/health/db', async (req, res, next) => {
  try {
    const projectCount = await prisma.project.count();
    res.json({ status: 'ok', projectCount });
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ status: 'error', message: 'Internal server error' });
});

const server = app.listen(port, () => {
  console.log(`BHUMI-TWIN backend listening on port ${port}`);
});

const shutdown = async () => {
  await prisma.$disconnect();
  server.close();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = { app, prisma };
