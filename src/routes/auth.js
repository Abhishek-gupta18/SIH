const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { requireAuth } = require('../middleware/auth');

function createAuthRouter(prisma) {
  const router = express.Router();

  router.post('/login', async (req, res, next) => {
    try {
      const { email, password, caseId } = req.body || {};
      let user;

      if (caseId) {
        user = await prisma.user.findFirst({ where: { linkedCaseId: caseId } });
      } else if (email && password) {
        user = await prisma.user.findUnique({ where: { email } });
        if (user && !['ADMIN', 'OFFICER'].includes(user.role)) {
          user = null;
        }
        if (user && !(await bcrypt.compare(password, user.passwordHash))) {
          user = null;
        }
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured');
      }

      const payload = {
        userId: user.id,
        role: user.role,
        linkedCaseId: user.linkedCaseId
      };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          linkedCaseId: user.linkedCaseId
        }
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  return router;
}

module.exports = createAuthRouter;
