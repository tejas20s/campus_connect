import express from 'express';
import authRoutes from './authRoutes.js';
import adminRoutes from './adminRoutes.js';
import opportunityRoutes from './opportunityRoutes.js';
import studentRoutes from './studentRoutes.js';
import placementRoutes from './placementRoutes.js';
import alumniRoutes from './alumniRoutes.js';

const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'CampusConnect API',
    timestamp: new Date().toISOString()
  });
});

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use(opportunityRoutes);
router.use(studentRoutes);
router.use(placementRoutes);
router.use(alumniRoutes);

export default router;
