import express from 'express';
import { adminOnly, protect } from '../middlewares/auth.js';
import {
  completeLecture,
  enrollCourse,
  getAllEnrollments,
  getEnrollmentByCourse,
  // getLearningProgress,
  incompleteLecture,
  // markLectureComplete,
  myEnrollments,
} from '../controller/enrollmentController.js';

const enrollmentRouter = express.Router();

enrollmentRouter.post('/', enrollCourse);

enrollmentRouter.get('/me', protect, myEnrollments);

enrollmentRouter.get('/', adminOnly, getAllEnrollments);

enrollmentRouter.get('/course/:courseId', protect, getEnrollmentByCourse);
// enrollmentRouter.post('/:enrollmentId/complete-lecture', protect, markLectureComplete);
// enrollmentRouter.get('/progress', protect, getLearningProgress);

enrollmentRouter.post('/:enrollmentId/complete-lecture', protect, completeLecture);
enrollmentRouter.post('/:enrollmentId/incomplete-lecture', protect, incompleteLecture)

export default enrollmentRouter;
