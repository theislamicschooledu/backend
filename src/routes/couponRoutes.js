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
import { adminOnly, protect } from '../middlewares/auth.js';

const couponRouter = express.Router();

// Routes
couponRouter.post('/', protect, adminOnly, createCoupon);
couponRouter.get('/course/:courseId', getCouponsByCourse); // TODO
couponRouter.get('/:id', getCoupon); // TODO
couponRouter.put('/:id', protect, adminOnly, updateCoupon);
couponRouter.delete('/:id', protect, adminOnly, deleteCoupon);
couponRouter.post('/validate-enrollment', protect, validateCouponForEnrollment);
couponRouter.get('/valid/:courseId', protect, getValidCouponsForCourse);
couponRouter.post('/validate', validateCoupon); // TODO

export default couponRouter;
