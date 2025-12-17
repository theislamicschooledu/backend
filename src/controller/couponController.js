import Coupon from '../models/Coupon.js';
import Course from '../models/Course.js';

// Create coupon for a course
export const createCoupon = async (req, res) => {
  try {
    const {
      code,
      discountType,
      discountValue,
      expiryDate,
      courseId,
      usageLimit
    } = req.body;

    // Validation
    if (!code?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code is required'
      });
    }

    if (!discountType || !['percentage', 'flat'].includes(discountType)) {
      return res.status(400).json({
        success: false,
        message: 'Discount type must be either percentage or flat'
      });
    }

    if (!discountValue || discountValue <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Discount value must be a positive number'
      });
    }

    if (discountType === 'percentage' && discountValue > 100) {
      return res.status(400).json({
        success: false,
        message: 'Percentage discount cannot exceed 100%'
      });
    }

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: 'Course ID is required'
      });
    }

    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({ code: code.trim().toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists'
      });
    }

    // Create coupon
    const coupon = await Coupon.create({
      code: code.trim().toUpperCase(),
      discountType,
      discountValue: parseFloat(discountValue),
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      course: courseId,
      usageLimit: usageLimit ? parseInt(usageLimit) : 1
    });

    // Add coupon to course
    await Course.findByIdAndUpdate(
      courseId,
      { $push: { coupons: coupon._id } },
      { new: true }
    );

    const populatedCoupon = await Coupon.findById(coupon._id)
      .populate('course', 'title');

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      coupon: populatedCoupon
    });

  } catch (error) {
    console.error('Create coupon error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists'
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get coupons by course
export const getCouponsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const coupons = await Coupon.find({ course: courseId })
      .populate('course', 'title')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      coupons,
      count: coupons.length
    });

  } catch (error) {
    console.error('Get coupons error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get single coupon
export const getCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id)
      .populate('course', 'title');

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    res.status(200).json({
      success: true,
      coupon
    });

  } catch (error) {
    console.error('Get coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update coupon
export const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      code,
      discountType,
      discountValue,
      expiryDate,
      usageLimit
    } = req.body;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    // Check if code is being updated and if it already exists
    if (code && code.trim().toUpperCase() !== coupon.code) {
      const existingCoupon = await Coupon.findOne({ 
        code: code.trim().toUpperCase(),
        _id: { $ne: id }
      });
      if (existingCoupon) {
        return res.status(400).json({
          success: false,
          message: 'Coupon code already exists'
        });
      }
      coupon.code = code.trim().toUpperCase();
    }

    // Update other fields
    if (discountType && ['percentage', 'flat'].includes(discountType)) {
      coupon.discountType = discountType;
    }

    if (discountValue && discountValue > 0) {
      if (discountType === 'percentage' && discountValue > 100) {
        return res.status(400).json({
          success: false,
          message: 'Percentage discount cannot exceed 100%'
        });
      }
      coupon.discountValue = parseFloat(discountValue);
    }

    if (expiryDate) {
      coupon.expiryDate = new Date(expiryDate);
    }

    if (usageLimit) {
      coupon.usageLimit = parseInt(usageLimit);
    }

    await coupon.save();

    const updatedCoupon = await Coupon.findById(id)
      .populate('course', 'title');

    res.status(200).json({
      success: true,
      message: 'Coupon updated successfully',
      coupon: updatedCoupon
    });

  } catch (error) {
    console.error('Update coupon error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete coupon
export const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    // Remove coupon from course
    await Course.findByIdAndUpdate(
      coupon.course,
      { $pull: { coupons: coupon._id } }
    );

    // Delete coupon
    await Coupon.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Coupon deleted successfully'
    });

  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Validate coupon
export const validateCoupon = async (req, res) => {
  try {
    const { code, courseId } = req.body;

    if (!code?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code is required'
      });
    }

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: 'Course ID is required'
      });
    }

    const coupon = await Coupon.findOne({ 
      code: code.trim().toUpperCase(),
      course: courseId
    }).populate('course', 'title price');

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code'
      });
    }

    // Check if coupon is expired
    if (coupon.expiryDate && new Date() > new Date(coupon.expiryDate)) {
      return res.status(400).json({
        success: false,
        message: 'Coupon has expired'
      });
    }

    // Check usage limit
    if (coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({
        success: false,
        message: 'Coupon usage limit reached'
      });
    }

    // Calculate discounted price
    let discountedPrice = coupon.course.price;
    if (coupon.discountType === 'percentage') {
      discountedPrice = coupon.course.price * (1 - coupon.discountValue / 100);
    } else if (coupon.discountType === 'flat') {
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
        savings: coupon.course.price - discountedPrice
      }
    });

  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Validate coupon for enrollment
export const validateCouponForEnrollment = async (req, res) => {
  try {
    const { code, courseId } = req.body;
    const studentId = req.user._id;

    if (!code?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code is required'
      });
    }

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: 'Course ID is required'
      });
    }

    // Find coupon
    const coupon = await Coupon.findOne({ 
      code: code.trim().toUpperCase(),
      course: courseId
    }).populate('course', 'title price');

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code for this course'
      });
    }

    // Check if coupon is expired
    if (coupon.expiryDate && new Date() > new Date(coupon.expiryDate)) {
      return res.status(400).json({
        success: false,
        message: 'Coupon has expired'
      });
    }

    // Check usage limit
    if (coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({
        success: false,
        message: 'Coupon usage limit reached'
      });
    }

    // Check if user has already used this coupon
    const existingEnrollment = await Enrollment.findOne({
      student: studentId,
      course: courseId,
      couponUsed: coupon._id
    });

    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        message: 'You have already used this coupon for this course'
      });
    }

    // Calculate discounted price
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
        savings: discountAmount
      }
    });

  } catch (error) {
    console.error('Coupon validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get valid coupons for a course
export const getValidCouponsForCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const coupons = await Coupon.find({
      course: courseId,
      $or: [
        { expiryDate: { $gte: new Date() } },
        { expiryDate: null }
      ],
      usedCount: { $lt: '$usageLimit' }
    }).select('code discountType discountValue expiryDate usageLimit usedCount');

    res.status(200).json({
      success: true,
      coupons
    });

  } catch (error) {
    console.error('Get coupons error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};