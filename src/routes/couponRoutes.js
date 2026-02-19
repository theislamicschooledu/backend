// routes/couponRoutes.js
import express from 'express';
import {
  createCoupon,
  deleteCoupon,
  getCoupon,
  getCouponsByCourse,
  getValidCouponsForCourse,
  updateCoupon,
  validateCoupon,
  validateCouponForEnrollment,
} from '../controller/couponController.js';
import { protect, adminOnly } from '../middlewares/auth.js';

const couponRouter = express.Router();

// পাবলিক রাউট - কুপন ভ্যালিডেশন
couponRouter.post('/validate', validateCoupon); // এইটা আগে রাখুন

// প্রোটেক্টেড রাউট
couponRouter.post('/validate-enrollment', protect, validateCouponForEnrollment);
couponRouter.get('/valid/:courseId', protect, getValidCouponsForCourse);

// অ্যাডমিন রাউট
couponRouter.post('/', protect, adminOnly, createCoupon);
couponRouter.get('/course/:courseId', protect, adminOnly, getCouponsByCourse);
couponRouter.get('/:id', protect, adminOnly, getCoupon);
couponRouter.put('/:id', protect, adminOnly, updateCoupon);
couponRouter.delete('/:id', protect, adminOnly, deleteCoupon);

export default couponRouter;