const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');

const progressByStatus = {
  PROPOSAL: 12,
  SURVEY: 25,
  NOTIFICATION: 37,
  OBJECTION: 50,
  AWARD: 62,
  COMPENSATION: 75,
  RR: 87,
  POSSESSION: 100
};

const nextStepsByStatus = {
  PROPOSAL: 'Your case is being prepared. You will be updated when the field survey begins.',
  SURVEY: 'A field survey is underway. Please keep your land documents available for verification.',
  NOTIFICATION: 'The official notice has been issued. You can review it and share any questions through the help desk.',
  OBJECTION: 'Your concerns are being reviewed. You will be notified about the next hearing or decision.',
  AWARD: 'The compensation award has been prepared. You will be notified when payment processing begins.',
  COMPENSATION: 'Your compensation is being processed. You will be notified once payment is disbursed and the R&R process begins.',
  RR: 'Your resettlement and rehabilitation support is in progress. The field team will share the next arrangements with you.',
  POSSESSION: 'The acquisition is complete. Please contact the help desk if you need support with any remaining assistance.'
};

const stageOrder = Object.keys(progressByStatus);

function createCitizenRouter(prisma) {
  const router = express.Router();

  router.get('/case/:caseId', requireAuth, requireRole('CITIZEN'), async (req, res, next) => {
    try {
      const { caseId } = req.params;
      if (req.user.linkedCaseId !== caseId) {
        return res.status(403).json({ error: 'You can only access your own case' });
      }

      const parcel = await prisma.parcel.findUnique({
        where: { id: caseId },
        select: {
          parcelCode: true,
          village: true,
          acquisitionStatus: true,
          compensation: {
            select: { amountEstimated: true, amountPaid: true, status: true }
          },
          rrRecord: {
            select: { status: true, remarks: true }
          },
          events: {
            orderBy: { eventDate: 'asc' },
            select: { eventType: true, eventDate: true }
          }
        }
      });

      if (!parcel) {
        return res.status(404).json({ error: 'Case not found' });
      }

      const currentStatus = parcel.acquisitionStatus;
      const eventTypes = new Set(parcel.events.map((event) => event.eventType));
      const timeline = parcel.events.map((event) => ({
        eventType: event.eventType,
        eventDate: event.eventDate,
        completed: true
      }));
      if (!eventTypes.has(currentStatus)) {
        timeline.push({ eventType: currentStatus, eventDate: null, completed: false });
      }

      return res.json({
        parcelCode: parcel.parcelCode,
        village: parcel.village,
        acquisitionStatus: currentStatus,
        progressPercent: progressByStatus[currentStatus] || 0,
        compensation: parcel.compensation
          ? {
              estimated: parcel.compensation.amountEstimated,
              paid: parcel.compensation.amountPaid,
              status: parcel.compensation.status
            }
          : null,
        rr: parcel.rrRecord
          ? { status: parcel.rrRecord.status, remarks: parcel.rrRecord.remarks }
          : null,
        timeline,
        nextSteps: nextStepsByStatus[currentStatus] || 'Your case is being reviewed. You will be updated when there is progress.'
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = createCitizenRouter;
