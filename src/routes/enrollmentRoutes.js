import express from 'express';
import {
  approveManualEnrollment,
  createManualEnrollment,
  getMyEnrollments,
  getPendingEnrollments,
  rejectManualEnrollment,
} from '../controller/enrollmentController.js';
import { adminOnly, protect } from '../middlewares/auth.js';

const enrollmentRouter = express.Router();

// পাবলিক রাউট - ম্যানুয়াল এনরোলমেন্ট রিকোয়েস্ট
enrollmentRouter.post('/manual', protect, createManualEnrollment);
enrollmentRouter.get('/my-enrollments', protect, getMyEnrollments);

// অ্যাডমিন রাউট
enrollmentRouter.get('/pending', protect, adminOnly, getPendingEnrollments);
enrollmentRouter.put(
  '/:enrollmentId/approve',
  protect,
  adminOnly,
  approveManualEnrollment
);
enrollmentRouter.put(
  '/:enrollmentId/reject',
  protect,
  adminOnly,
  rejectManualEnrollment
);

export default enrollmentRouter;
