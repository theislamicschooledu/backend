import Enrollment from '../models/Enrollment.js';
import Course from '../models/Course.js';
import User from '../models/User.js';
import uddoktapayConfig from '../config/uddoktapay.js';
import CryptoJS from 'crypto-js';
import axios from 'axios';
import Coupon from '../models/Coupon.js';

// Initialize payment with UddoktaPay (with coupon support)
export const initiatePayment = async (req, res) => {
  try {
    const { courseId, couponCode } = req.body;
    const studentId = req.user._id;

    // Validate course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    // Check if user is already enrolled
    const existingEnrollment = await Enrollment.findOne({
      student: studentId,
      course: courseId,
    });

    if (existingEnrollment) {
      if (existingEnrollment.paymentStatus === 'completed') {
        return res.status(400).json({
          success: false,
          message: 'You are already enrolled in this course',
        });
      }
    }

    let finalAmount = course.price;
    let discountAmount = 0;
    let couponId = null;

    // Validate and apply coupon if provided
    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: couponCode.trim().toUpperCase(),
        course: courseId,
      });

      if (!coupon) {
        return res.status(400).json({
          success: false,
          message: 'Invalid coupon code',
        });
      }

      // Check coupon validity
      if (coupon.expiryDate && new Date() > new Date(coupon.expiryDate)) {
        return res.status(400).json({
          success: false,
          message: 'Coupon has expired',
        });
      }

      if (coupon.usedCount >= coupon.usageLimit) {
        return res.status(400).json({
          success: false,
          message: 'Coupon usage limit reached',
        });
      }

      // Check if user has already used this coupon
      const existingCouponUsage = await Enrollment.findOne({
        student: studentId,
        couponUsed: coupon._id,
      });

      if (existingCouponUsage) {
        return res.status(400).json({
          success: false,
          message: 'You have already used this coupon',
        });
      }

      // Calculate discount
      if (coupon.discountType === 'percentage') {
        discountAmount = (course.price * coupon.discountValue) / 100;
        finalAmount = course.price - discountAmount;
      } else if (coupon.discountType === 'flat') {
        discountAmount = coupon.discountValue;
        finalAmount = Math.max(0, course.price - coupon.discountValue);
      }

      couponId = coupon._id;
    }

    // Generate unique transaction ID
    const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    let enrollment;

    if (existingEnrollment) {
      existingEnrollment.transactionId = transactionId;
      existingEnrollment.amount = finalAmount;
      existingEnrollment.originalAmount = course.price;
      existingEnrollment.discountAmount = discountAmount;
      existingEnrollment.couponUsed = couponId;
      existingEnrollment.paymentStatus = 'pending';
      existingEnrollment.paymentDetails = null;
      enrollment = await existingEnrollment.save();
    } else {
      enrollment = await Enrollment.create({
        student: studentId,
        course: courseId,
        transactionId,
        amount: finalAmount,
        originalAmount: course.price,
        discountAmount: discountAmount,
        couponUsed: couponId,
        currency: 'BDT',
        paymentMethod: 'uddoktapay',
      });
    }

    // Prepare payment data for UddoktaPay
    const paymentData = {
      full_name: req.user.name,
      email: req.user.email,
      amount: finalAmount,
      metadata: {
        student_id: studentId.toString(),
        course_id: courseId,
        enrollment_id: enrollment._id.toString(),
        transaction_id: transactionId,
        coupon_used: couponCode || null,
        discount_amount: discountAmount,
      },
      redirect_url: uddoktapayConfig.successUrl,
      cancel_url: uddoktapayConfig.cancelUrl,
      webhook_url: uddoktapayConfig.webhookUrl,
    };

    // Generate signature for UddoktaPay
    const signature = CryptoJS.MD5(
      `${uddoktapayConfig.apiKey}${paymentData.amount}${paymentData.email}${paymentData.metadata.transaction_id}`
    ).toString();

    // Make request to UddoktaPay
    const paymentResponse = await axios.post(
      `${uddoktapayConfig.baseURL}/checkout-v2`,
      paymentData,
      {
        headers: {
          'RT-UDDOKTAPAY-API-KEY': uddoktapayConfig.apiKey,
          accept: 'application/json',
          'content-type': 'application/json',
        },
      }
    );

    if (paymentResponse.data.status === true) {
      res.status(200).json({
        success: true,
        message: 'Payment initiated successfully',
        payment_url: paymentResponse.data.payment_url,
        transaction_id: transactionId,
        amount: finalAmount,
        discount: discountAmount,
        original_amount: course.price,
      });
    } else {
      // Update enrollment status to failed
      await Enrollment.findByIdAndUpdate(enrollment._id, {
        paymentStatus: 'failed',
        paymentDetails: { error: paymentResponse.data.message },
      });

      res.status(400).json({
        success: false,
        message: paymentResponse.data.message || 'Payment initiation failed',
      });
    }
  } catch (error) {
    console.error('Payment initiation error:', error);

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Handle UddoktaPay webhook (আপডেট)
export const handleWebhook = async (req, res) => {
  try {
    const {
      invoice_id,
      transaction_id,
      payment_status,
      payment_method,
      amount,
      metadata,
    } = req.body;

    // Find enrollment by transaction ID
    const enrollment = await Enrollment.findOne({
      transactionId: transaction_id,
    })
      .populate('course')
      .populate('student')
      .populate('couponUsed');

    if (!enrollment) {
      return res
        .status(404)
        .json({ success: false, message: 'Enrollment not found' });
    }

    if (payment_status === 'COMPLETED') {
      // Update enrollment status
      enrollment.paymentStatus = 'completed';
      enrollment.paymentDetails = {
        invoice_id,
        payment_method,
        paid_amount: amount,
        paid_at: new Date(),
      };

      await enrollment.save();

      // Update coupon usage count if coupon was used
      if (enrollment.couponUsed) {
        await Coupon.findByIdAndUpdate(enrollment.couponUsed._id, {
          $inc: { usedCount: 1 },
        });
      }

      // Add course to student's enrolled courses
      await User.findByIdAndUpdate(enrollment.student._id, {
        $addToSet: { enrolledCourses: enrollment.course._id },
      });

      // Increment student count in course
      await Course.findByIdAndUpdate(enrollment.course._id, {
        $inc: { studentCount: 1 },
      });

      // console.log(`Payment completed for enrollment: ${enrollment._id}`);


    } else if (payment_status === 'FAILED') {
      enrollment.paymentStatus = 'failed';
      await enrollment.save();
    } else if (payment_status === 'CANCELLED') {
      enrollment.paymentStatus = 'cancelled';
      await enrollment.save();
    }

    res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res
      .status(500)
      .json({ success: false, message: 'Webhook processing failed' });
  }
};

// Validate coupon before payment
export const validateCoupon = async (req, res) => {
  try {
    const { couponCode, courseId } = req.body;
    const studentId = req.user._id;

    const coupon = await Coupon.findOne({
      code: couponCode.trim().toUpperCase(),
      course: courseId,
    }).populate('course', 'title price');

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code for this course',
      });
    }

    // Check coupon validity
    if (coupon.expiryDate && new Date() > new Date(coupon.expiryDate)) {
      return res.status(400).json({
        success: false,
        message: 'Coupon has expired',
      });
    }

    if (coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({
        success: false,
        message: 'Coupon usage limit reached',
      });
    }

    // Check if user has already used this coupon
    const existingCouponUsage = await Enrollment.findOne({
      student: studentId,
      couponUsed: coupon._id,
    });

    if (existingCouponUsage) {
      return res.status(400).json({
        success: false,
        message: 'You have already used this coupon',
      });
    }

    // Calculate discount
    let discountedPrice = coupon.course.price;
    let discountAmount = 0;

    if (coupon.discountType === 'percentage') {
      discountAmount = (coupon.course.price * coupon.discountValue) / 100;
      discountedPrice = coupon.course.price - discountAmount;
    } else if (coupon.discountType === 'flat') {
      discountAmount = coupon.discountValue;
      discountedPrice = Math.max(0, coupon.course.price - coupon.discountValue);
    }

    res.status(200).json({
      success: true,
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        originalPrice: coupon.course.price,
        discountedPrice: discountedPrice,
        discountAmount: discountAmount,
        savings: discountAmount,
      },
    });
  } catch (error) {
    console.error('Coupon validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Coupon validation failed',
    });
  }
};

// Verify payment status
export const verifyPayment = async (req, res) => {
  try {
    const { transactionId } = req.params;

    const enrollment = await Enrollment.findOne({ transactionId })
      .populate('course')
      .populate('student');

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    res.status(200).json({
      success: true,
      enrollment: {
        _id: enrollment._id,
        transactionId: enrollment.transactionId,
        paymentStatus: enrollment.paymentStatus,
        amount: enrollment.amount,
        enrolledAt: enrollment.enrolledAt,
        course: {
          _id: enrollment.course._id,
          title: enrollment.course.title,
          thumbnail: enrollment.course.thumbnail,
        },
      },
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
    });
  }
};

// Get user enrollments
export const getUserEnrollments = async (req, res) => {
  try {
    const studentId = req.user._id;

    const enrollments = await Enrollment.find({ student: studentId })
      .populate('course')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      enrollments: enrollments.map((enrollment) => ({
        _id: enrollment._id,
        paymentStatus: enrollment.paymentStatus,
        amount: enrollment.amount,
        enrolledAt: enrollment.enrolledAt,
        progress: enrollment.progress,
        course: {
          _id: enrollment.course._id,
          title: enrollment.course.title,
          thumbnail: enrollment.course.thumbnail,
          duration: enrollment.course.duration,
          category: enrollment.course.category,
        },
      })),
    });
  } catch (error) {
    console.error('Get enrollments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch enrollments',
    });
  }
};
