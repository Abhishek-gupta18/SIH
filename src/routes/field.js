const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');

function buildVerificationRemarks({ observation, gpsLat, gpsLng, photoNote }) {
  const details = [`Observation: ${observation}`];
  if (gpsLat !== undefined || gpsLng !== undefined) {
    details.push(`GPS: ${gpsLat ?? 'unknown'}, ${gpsLng ?? 'unknown'}`);
  }
  if (photoNote) {
    details.push(`Photo note: ${photoNote}`);
  }
  return details.join(' | ');
}

function createFieldRouter(prisma) {
  const router = express.Router();
  const fieldAccess = [requireAuth, requireRole('ADMIN', 'OFFICER')];

  router.post('/parcels/:id/evidence', ...fieldAccess, async (req, res, next) => {
    try {
      const { observation, gpsLat, gpsLng, photoNote } = req.body || {};
      if (typeof observation !== 'string' || !observation.trim()) {
        return res.status(400).json({ error: 'observation is required' });
      }
      if (gpsLat !== undefined && typeof gpsLat !== 'number') {
        return res.status(400).json({ error: 'gpsLat must be a number' });
      }
      if (gpsLng !== undefined && typeof gpsLng !== 'number') {
        return res.status(400).json({ error: 'gpsLng must be a number' });
      }
      if (photoNote !== undefined && typeof photoNote !== 'string') {
        return res.status(400).json({ error: 'photoNote must be a string' });
      }

      const parcel = await prisma.parcel.findUnique({
        where: { id: req.params.id },
        select: { id: true }
      });
      if (!parcel) {
        return res.status(404).json({ error: 'Parcel not found' });
      }

      const event = await prisma.acquisitionEvent.create({
        data: {
          parcelId: parcel.id,
          eventType: 'FIELD_VERIFICATION',
          eventDate: new Date(),
          remarks: buildVerificationRemarks({ observation: observation.trim(), gpsLat, gpsLng, photoNote })
        }
      });

      return res.status(201).json(event);
    } catch (error) {
      return next(error);
    }
  });

  router.get('/parcels/:id/evidence-history', ...fieldAccess, async (req, res, next) => {
    try {
      const parcel = await prisma.parcel.findUnique({
        where: { id: req.params.id },
        select: { id: true }
      });
      if (!parcel) {
        return res.status(404).json({ error: 'Parcel not found' });
      }

      const events = await prisma.acquisitionEvent.findMany({
        where: { parcelId: parcel.id, eventType: 'FIELD_VERIFICATION' },
        orderBy: { eventDate: 'desc' }
      });
      return res.json(events);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = createFieldRouter;
