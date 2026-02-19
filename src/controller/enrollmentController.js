import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import User from "../models/User.js";
import Coupon from "../models/Coupon.js"; // কুপন মডেল ইম্পোর্ট করুন

// ম্যানুয়াল এনরোলমেন্ট রিকোয়েস্ট তৈরি (শুধুমাত্র লগইন করা ইউজার)
export const createManualEnrollment = async (req, res) => {
  try {
    const { 
      studentName, 
      mobileNumber, 
      transactionId, 
      paymentMethod, 
      amount, 
      courseId,
      couponCode 
    } = req.body;

    // **ইম্পরট্যান্ট: ইউজার লগইন করা আছে কিনা চেক**
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'আপনাকে প্রথমে লগইন করতে হবে' 
      });
    }

    // ভ্যালিডেশন: প্রয়োজনীয় ফিল্ড চেক
    if (!studentName || !mobileNumber || !transactionId || !paymentMethod || !amount || !courseId) {
      return res.status(400).json({ 
        success: false,
        message: 'সব তথ্য প্রদান করুন' 
      });
    }

    // মোবাইল নম্বর ভ্যালিডেশন
    const mobileRegex = /^(\+8801|01)[0-9]{9}$/;
    if (!mobileRegex.test(mobileNumber)) {
      return res.status(400).json({
        success: false,
        message: 'সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)'
      });
    }

    // ট্রানজেকশন আইডি ইউনিক চেক (কেস ইন্সেনসিটিভ)
    const existingEnrollment = await Enrollment.findOne({ 
      transactionId: { $regex: new RegExp(`^${transactionId}$`, 'i') }
    });
    
    if (existingEnrollment) {
      return res.status(400).json({ 
        success: false,
        message: 'এই ট্রানজেকশন আইডি আগেই ব্যবহার করা হয়েছে' 
      });
    }

    // কোর্সের তথ্য পাওয়া
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ 
        success: false,
        message: 'কোর্স পাওয়া যায়নি' 
      });
    }

    // **লগইন করা ইউজারকেই ব্যবহার করুন**
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'ইউজার পাওয়া যায়নি'
      });
    }

    console.log('Enrollment requested by logged in user:', {
      userId: user._id.toString(),
      name: user.name,
      phone: user.phone,
      email: user.email
    });

    // চেক করুন ফর্মে দেওয়া মোবাইল নম্বর ইউজারের মোবাইল নম্বরের সাথে মিলছে কিনা
    if (user.phone !== mobileNumber) {
      return res.status(400).json({
        success: false,
        message: 'আপনার দেওয়া মোবাইল নম্বর আপনার অ্যাকাউন্টের মোবাইল নম্বরের সাথে মেলেনি'
      });
    }

    // চেক করুন ফর্মে দেওয়া নাম ইউজারের নামের সাথে মিলছে কিনা
    if (user.name !== studentName) {
      return res.status(400).json({
        success: false,
        message: 'আপনার দেওয়া নাম আপনার অ্যাকাউন্টের নামের সাথে মেলেনি'
      });
    }

    // ডুপ্লিকেট এনরোলমেন্ট চেক
    const existingUserEnrollment = await Enrollment.findOne({
      student: user._id,
      course: courseId,
      paymentStatus: { $in: ['pending', 'completed'] }
    });

    if (existingUserEnrollment) {
      return res.status(400).json({
        success: false,
        message: 'আপনি ইতিমধ্যে এই কোর্সে এনরোল করেছেন অথবা আপনার একটি পেন্ডিং রিকোয়েস্ট আছে'
      });
    }

    // **কুপন ভ্যালিডেশন ও ডিসকাউন্ট ক্যালকুলেশন**
    let finalAmount = course.price;
    let discountAmount = 0;
    let appliedCoupon = null;
    let originalAmount = course.price;

    if (couponCode) {
      console.log('Validating coupon:', couponCode, 'for course:', courseId);

      // কুপন খোঁজা
      const coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        course: courseId,
        isActive: true,
        $or: [
          { expiryDate: { $gte: new Date() } },
          { expiryDate: null }
        ]
      });

      if (!coupon) {
        return res.status(400).json({
          success: false,
          message: 'কুপনটি এই কোর্সের জন্য বৈধ নয় অথবা মেয়াদ উত্তীর্ণ হয়েছে'
        });
      }

      // ইউজেজ লিমিট চেক
      if (coupon.usedCount >= coupon.usageLimit) {
        return res.status(400).json({
          success: false,
          message: 'কুপনটির ব্যবহার সীমা শেষ হয়েছে'
        });
      }

      // চেক করুন ইউজার আগে এই কুপন ব্যবহার করেছে কিনা
      const existingCouponUsage = await Enrollment.findOne({
        student: user._id,
        couponUsed: coupon._id,
        paymentStatus: { $in: ['completed', 'pending'] }
      });

      if (existingCouponUsage) {
        return res.status(400).json({
          success: false,
          message: 'আপনি ইতিমধ্যে এই কুপন ব্যবহার করেছেন'
        });
      }

      // ডিসকাউন্ট ক্যালকুলেশন
      if (coupon.discountType === 'percentage') {
        discountAmount = (course.price * coupon.discountValue) / 100;
        if (coupon.maxDiscountAmount) {
          discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
        }
      } else {
        discountAmount = coupon.discountValue;
      }

      // ফাইনাল অ্যামাউন্ট
      finalAmount = Math.max(0, course.price - discountAmount);
      
      // অ্যামাউন্ট মিলছে কিনা চেক (ফ্রন্টএন্ড থেকে পাঠানো অ্যামাউন্ট)
      const frontendAmount = parseFloat(amount);
      if (Math.abs(finalAmount - frontendAmount) > 1) {
        return res.status(400).json({
          success: false,
          message: `অ্যামাউন্ট মেলেনি। সঠিক অ্যামাউন্ট: ${finalAmount} টাকা`
        });
      }

      appliedCoupon = coupon._id;

    } else {
      // কুপন ছাড়া অ্যামাউন্ট চেক
      if (parseFloat(amount) !== course.price) {
        return res.status(400).json({
          success: false,
          message: `সঠিক অ্যামাউন্ট দিন। কোর্সের মূল্য: ${course.price} টাকা`
        });
      }
    }

    // **এনরোলমেন্ট তৈরি**
    const enrollment = new Enrollment({
      student: user._id,
      course: courseId,
      transactionId: transactionId.toUpperCase(),
      paymentStatus: 'pending',
      amount: finalAmount,
      originalAmount: originalAmount,
      discountAmount: discountAmount,
      couponUsed: appliedCoupon,
      paymentMethod,
      paymentDetails: {
        method: paymentMethod,
        submittedBy: studentName,
        mobileNumber,
        isManual: true,
        submittedAt: new Date(),
        transactionId: transactionId,
        couponCode: couponCode || null
      }
    });

    await enrollment.save();

    // কুপন ইউজড কাউন্ট আপডেট
    if (appliedCoupon) {
      await Coupon.findByIdAndUpdate(appliedCoupon, {
        $inc: { usedCount: 1 }
      });
    }

    res.status(201).json({ 
      success: true,
      message: 'আপনার এনরোলমেন্ট রিকোয়েস্ট জমা দেওয়া হয়েছে। অ্যাডমিন অ্যাপ্রুভ করার পর আপনি এক্সেস পাবেন।',
      data: {
        enrollmentId: enrollment._id,
        amount: finalAmount,
        discountAmount: discountAmount,
        originalAmount: originalAmount
      }
    });

  } catch (error) {
    console.error('Manual enrollment error:', error);
    res.status(500).json({ 
      success: false,
      message: 'সার্ভার এরর হয়েছে। আবার চেষ্টা করুন।'
    });
  }
};
// অ্যাডমিনের জন্য পেন্ডিং এনরোলমেন্ট লিস্ট দেখা (সার্চ অপশন সহ)
export const getPendingEnrollments = async (req, res) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    let query = { 
      paymentStatus: 'pending',
      'paymentDetails.isManual': true 
    };

    // সার্চ অপশন (মোবাইল বা ট্রানজেকশন আইডি দিয়ে)
    if (search) {
      query.$or = [
        { transactionId: { $regex: search, $options: 'i' } },
        { 'paymentDetails.mobileNumber': { $regex: search, $options: 'i' } }
      ];
    }

    const enrollments = await Enrollment.find(query)
      .populate('student', 'name phone email')
      .populate('course', 'title price thumbnail')
      .populate('couponUsed', 'code discountType discountValue')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Enrollment.countDocuments(query);

    res.json({
      success: true,
      data: enrollments,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get pending enrollments error:', error);
    res.status(500).json({ 
      success: false,
      message: 'সার্ভার এরর',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// অ্যাডমিনের এনরোলমেন্ট অ্যাপ্রুভ করা
export const approveManualEnrollment = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const { adminNotes } = req.body;

    const enrollment = await Enrollment.findById(enrollmentId)
      .populate('student')
      .populate('course')
      .populate('couponUsed');

    if (!enrollment) {
      return res.status(404).json({ 
        success: false,
        message: 'এনরোলমেন্ট পাওয়া যায়নি' 
      });
    }

    // যদি ইতিমধ্যে কমপ্লিট করা থাকে
    if (enrollment.paymentStatus === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'এই এনরোলমেন্ট ইতিমধ্যে অ্যাপ্রুভ করা হয়েছে'
      });
    }

    // ট্রানজেকশন শুরু করা (ট্রানজেকশনাল অপারেশনের জন্য)
    const session = await Enrollment.startSession();
    session.startTransaction();

    try {
      // এনরোলমেন্ট স্ট্যাটাস আপডেট
      enrollment.paymentStatus = 'completed';
      enrollment.paymentDetails.adminApprovedBy = req.user._id;
      enrollment.paymentDetails.adminApprovedAt = new Date();
      enrollment.paymentDetails.adminNotes = adminNotes || 'Approved by admin';
      
      await enrollment.save({ session });

      // স্টুডেন্টের enrolledCourses আপডেট (ডুপ্লিকেট এড়িয়ে)
      await User.findByIdAndUpdate(
        enrollment.student._id,
        { $addToSet: { enrolledCourses: enrollment.course._id } },
        { session }
      );

      // কোর্সের স্টুডেন্ট কাউন্ট আপডেট
      await Course.findByIdAndUpdate(
        enrollment.course._id,
        { $inc: { studentCount: 1 } },
        { session }
      );

      await session.commitTransaction();

      // TODO: স্টুডেন্টকে নোটিফিকেশন পাঠানো (ইমেইল/এসএমএস)
      // if (enrollment.student.email) {
      //   sendApprovalEmail(enrollment.student.email, enrollment.course.title);
      // }

      res.json({ 
        success: true,
        message: 'এনরোলমেন্ট অ্যাপ্রুভ করা হয়েছে',
        data: {
          enrollmentId: enrollment._id,
          studentName: enrollment.student.name,
          courseTitle: enrollment.course.title,
          amount: enrollment.amount
        }
      });

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

  } catch (error) {
    console.error('Approve enrollment error:', error);
    res.status(500).json({ 
      success: false,
      message: 'সার্ভার এরর',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// এনরোলমেন্ট রিজেক্ট করা
export const rejectManualEnrollment = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'রিজেক্ট করার কারণ দিন'
      });
    }

    const enrollment = await Enrollment.findById(enrollmentId)
      .populate('student')
      .populate('course');

    if (!enrollment) {
      return res.status(404).json({ 
        success: false,
        message: 'এনরোলমেন্ট পাওয়া যায়নি' 
      });
    }

    // যদি ইতিমধ্যে প্রসেস করা থাকে
    if (enrollment.paymentStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'এই এনরোলমেন্ট ইতিমধ্যে প্রসেস করা হয়েছে'
      });
    }

    enrollment.paymentStatus = 'cancelled';
    enrollment.paymentDetails.rejectedBy = req.user._id;
    enrollment.paymentDetails.rejectedAt = new Date();
    enrollment.paymentDetails.rejectionReason = reason;
    
    await enrollment.save();

    // TODO: স্টুডেন্টকে নোটিফিকেশন পাঠানো
    // if (enrollment.student.email) {
    //   sendRejectionEmail(enrollment.student.email, enrollment.course.title, reason);
    // }

    res.json({ 
      success: true,
      message: 'এনরোলমেন্ট রিজেক্ট করা হয়েছে',
      data: {
        enrollmentId: enrollment._id,
        reason: reason
      }
    });

  } catch (error) {
    console.error('Reject enrollment error:', error);
    res.status(500).json({ 
      success: false,
      message: 'সার্ভার এরর',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getAllEnrollments = async (req, res) => {
  try {
    
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (status && ['pending', 'completed', 'cancelled', 'failed'].includes(status)) {
      query.paymentStatus = status;
    }

    const enrollments = await Enrollment.find(query)
      .populate('student', 'name phone email')
      .populate('course', 'title price')
      .populate('couponUsed', 'code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Enrollment.countDocuments(query);

    res.json({
      success: true,
      data: enrollments,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get all enrollments error:', error);
    res.status(500).json({ 
      success: false,
      message: 'সার্ভার এরর'
    });
  }
};

// একক এনরোলমেন্ট ডিটেইলস
export const getEnrollmentById = async (req, res) => {
  try {
    const { enrollmentId } = req.params;

    const enrollment = await Enrollment.findById(enrollmentId)
      .populate('student', 'name phone email avatar')
      .populate('course', 'title price thumbnail description')
      .populate('couponUsed', 'code discountType discountValue');

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'এনরোলমেন্ট পাওয়া যায়নি'
      });
    }

    res.json({
      success: true,
      data: enrollment
    });

  } catch (error) {
    console.error('Get enrollment by id error:', error);
    res.status(500).json({ 
      success: false,
      message: 'সার্ভার এরর'
    });
  }
};

export const getMyEnrollments = async (req, res) => {
  try {
    const userId = req.user._id;

    console.log('Fetching enrollments for user:', userId.toString());

    // সরাসরি ইউজার আইডি দিয়ে এনরোলমেন্ট খুঁজি
    const enrollments = await Enrollment.find({ 
      student: userId 
    })
    .populate({
      path: 'course',
      select: 'title thumbnail duration price category description',
      populate: {
        path: 'category',
        select: 'name'
      }
    })
    .populate('couponUsed', 'code discountType discountValue')
    .sort({ createdAt: -1 });

    console.log(`Found ${enrollments.length} enrollments`);

    res.json({
      success: true,
      data: enrollments
    });

  } catch (error) {
    console.error('Get my enrollments error:', error);
    res.status(500).json({
      success: false,
      message: 'সার্ভার এরর'
    });
  }
};