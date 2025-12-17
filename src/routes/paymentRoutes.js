import express from 'express';
import { getUserEnrollments, handleWebhook, initiatePayment, validateCoupon, verifyPayment } from '../controller/paymentController.js';
import { protect } from '../middlewares/auth.js';

const paymentRouter = express.Router();

// Public routes
paymentRouter.post('/webhook', handleWebhook);

// Protected routes
paymentRouter.post('/initiate', protect, initiatePayment);
paymentRouter.post('/validate-coupon', protect, validateCoupon);
paymentRouter.get('/verify/:transactionId', protect, verifyPayment);
paymentRouter.get('/enrollments', protect, getUserEnrollments);

export default paymentRouter;