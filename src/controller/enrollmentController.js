import Enrollment from '../models/Enrollment.js';
import Course from '../models/Course.js';
import Lecture from '../models/Lecture.js';
import Coupon from '../models/Coupon.js';

// Enroll user in a course
export const enrollCourse = async (req, res) => {
  try {
    const { courseId, couponCode } = req.body;
    const userId = req.user.id; // ধরলাম authentication middleware থেকে আসবে

    // কোর্স খুঁজে বের করা
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    let finalPrice = course.price;
    let appliedCoupon = null;

    // Coupon থাকলে Apply করা
    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: couponCode,
        course: courseId,
      });

      if (!coupon) {
        return res.status(400).json({ message: 'Invalid coupon' });
      }

      if (coupon.expiryDate && coupon.expiryDate < new Date()) {
        return res.status(400).json({ message: 'Coupon expired' });
      }

      if (coupon.usedCount >= coupon.usageLimit) {
        return res.status(400).json({ message: 'Coupon usage limit reached' });
      }

      // ডিসকাউন্ট ক্যালকুলেশন
      if (coupon.discountType === 'percentage') {
        finalPrice -= (course.price * coupon.discountValue) / 100;
      } else {
        finalPrice -= coupon.discountValue;
      }

      finalPrice = Math.max(finalPrice, 0);
      appliedCoupon = coupon._id;
    }

    // Enrollment তৈরি করা
    const enrollment = new Enrollment({
      user: userId,
      course: courseId,
      price: finalPrice,
      coupon: appliedCoupon,
      paymentStatus: 'pending',
    });

    await enrollment.save();

    res.status(201).json({
      message: 'Enrollment created. Proceed to payment.',
      enrollment,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all enrollments of logged-in user
export const myEnrollments = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({
      student: req.user.id,
    }).populate('course', 'title thumbnail price');

    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Get all enrollments
export const getAllEnrollments = async (req, res) => {
  try {
    const enrollments = await Enrollment.find()
      .populate('user', 'name email')
      .populate('course', 'title')
      .populate('coupon', 'code');

    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Get enrollment for a specific course
export const getEnrollmentByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user._id;

    const enrollment = await Enrollment.findOne({
      student: studentId,
      course: courseId,
      paymentStatus: 'completed'
    }).populate('course');

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found for this course'
      });
    }

    res.status(200).json({
      success: true,
      enrollment
    });

  } catch (error) {
    console.error('Get enrollment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch enrollment'
    });
  }
};

export const completeLecture = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const { lectureId } = req.body;
    const userId = req.user._id;

    // Find enrollment
    const enrollment = await Enrollment.findById(enrollmentId);

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    // Check if user owns this enrollment
    if (enrollment.student.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    // Check if already completed
    if (enrollment.completedLectures.includes(lectureId)) {
      return res.status(200).json({
        success: true,
        message: 'Lecture already completed',
        enrollment,
        progress: enrollment.progress
      });
    }

    // Add lecture to completedLectures
    enrollment.completedLectures.push(lectureId);

    // Get course to calculate total lectures
    const course = await Course.findById(enrollment.course).select('lectures');
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Calculate progress
    const totalLectures = course.lectures.length;
    const completedCount = enrollment.completedLectures.length;
    const progress = totalLectures > 0 ? Math.round((completedCount / totalLectures) * 100) : 0;

    enrollment.progress = progress;

    // Update completion status if all lectures completed
    if (progress === 100) {
      enrollment.completionStatus = 'completed';
    }

    // Save with validation
    await enrollment.save({ validateBeforeSave: true });

    // Populate for response
    const updatedEnrollment = await Enrollment.findById(enrollmentId)
      .populate('student', 'name email')
      .populate('course', 'title category duration thumbnail')
      .populate('completedLectures');

    res.status(200).json({
      success: true,
      message: 'Lecture marked as completed',
      enrollment: updatedEnrollment,
      progress
    });

  } catch (error) {
    console.error('Complete lecture error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Optional: Mark lecture as incomplete
export const incompleteLecture = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const { lectureId } = req.body;
    const userId = req.user._id;

    const enrollment = await Enrollment.findById(enrollmentId);

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    if (enrollment.student.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    // Remove lecture from completedLectures
    enrollment.completedLectures = enrollment.completedLectures.filter(
      id => id.toString() !== lectureId
    );

    // Recalculate progress
    const course = await Course.findById(enrollment.course);
    const totalLectures = course.lectures.length;
    const completedCount = enrollment.completedLectures.length;
    const progress = Math.round((completedCount / totalLectures) * 100);

    enrollment.progress = progress;
    enrollment.completionStatus = progress === 100 ? 'completed' : 'in-progress';

    await enrollment.save();

    const updatedEnrollment = await Enrollment.findById(enrollmentId)
      .populate('completedLectures');

    res.status(200).json({
      success: true,
      message: 'Lecture marked as incomplete',
      enrollment: updatedEnrollment,
      progress
    });

  } catch (error) {
    console.error('Incomplete lecture error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// // Mark lecture as completed
// export const markLectureComplete = async (req, res) => {
//   try {
//     const { enrollmentId } = req.params;
//     const { lectureId } = req.body;
//     const studentId = req.user._id;

//     // Verify enrollment belongs to student
//     const enrollment = await Enrollment.findOne({
//       _id: enrollmentId,
//       student: studentId
//     });

//     if (!enrollment) {
//       return res.status(404).json({
//         success: false,
//         message: 'Enrollment not found'
//       });
//     }

//     // Verify lecture belongs to course
//     const lecture = await Lecture.findOne({
//       _id: lectureId,
//       course: enrollment.course
//     });

//     if (!lecture) {
//       return res.status(400).json({
//         success: false,
//         message: 'Lecture not found in this course'
//       });
//     }

//     // Add lecture to completed lectures if not already
//     if (!enrollment.completedLectures.includes(lectureId)) {
//       enrollment.completedLectures.push(lectureId);
      
//       // Calculate new progress
//       const totalLectures = await Lecture.countDocuments({ course: enrollment.course });
//       enrollment.progress = Math.round((enrollment.completedLectures.length / totalLectures) * 100);
      
//       // Mark course as completed if all lectures are done
//       if (enrollment.completedLectures.length === totalLectures) {
//         enrollment.completionStatus = 'completed';
//       }

//       await enrollment.save();
//     }

//     res.status(200).json({
//       success: true,
//       enrollment: {
//         progress: enrollment.progress,
//         completedLectures: enrollment.completedLectures,
//         completionStatus: enrollment.completionStatus
//       }
//     });

//   } catch (error) {
//     console.error('Mark lecture complete error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to mark lecture as complete'
//     });
//   }
// };

// // Get learning progress
// export const getLearningProgress = async (req, res) => {
//   try {
//     const studentId = req.user._id;

//     const enrollments = await Enrollment.find({
//       student: studentId,
//       paymentStatus: 'completed'
//     })
//     .populate('course', 'title thumbnail duration category')
//     .select('progress completedLectures completionStatus course');

//     res.status(200).json({
//       success: true,
//       enrollments
//     });

//   } catch (error) {
//     console.error('Get learning progress error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch learning progress'
//     });
//   }
// };