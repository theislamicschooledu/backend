import express from 'express';
import {
  addCouponToCourse,
  addCourseCategory,
  createCourse,
  createLecture,
  deleteCoupon,
  deleteCourse,
  deleteCourseCategory,
  deleteLecture,
  deleteResource,
  getCourseById,
  getCourseCategory,
  getCourseDetails,
  getCourses,
  getCourseWithLectures,
  getFeaturedCourses,
  getLecture,
  getLecturesByCourse,
  getPublishCourses,
  getTeacherCourseDetails,
  getTeacherCourses,
  updateCoupon,
  updateCourse,
  updateLecture,
  getCoursesByStatus,
} from '../controller/courseController.js';
import { adminOnly, protect, teacherOrAdmin } from '../middlewares/auth.js';
import { upload } from '../middlewares/upload.js';
import {
  addReview,
  deleteReview,
  getCourseReviews,
  getUserReviewForCourse,
  updateReview,
} from '../controller/reviewController.js';

const courseRouter = express.Router();

// ==================== PUBLIC ROUTES (স্পেসিফিক রাউট আগে) ====================
courseRouter.get('/featured', getFeaturedCourses); // স্পেসিফিক
courseRouter.get('/published', getPublishCourses); // স্পেসিফিক
courseRouter.get('/status/filter', getCoursesByStatus); // স্পেসিফিক
courseRouter.get('/category', getCourseCategory); // স্পেসিফিক
courseRouter.get('/details/:id', getCourseDetails); // স্পেসিফিক প্যারামিটার
courseRouter.get('/', getCourses); // জেনেরিক
courseRouter.get('/:id', getCourseById); // ডায়নামিক প্যারামিটার (সবশেষে)

// ==================== PROTECTED ROUTES ====================
// Course CRUD (Admin only)
courseRouter.post(
  '/',
  protect,
  adminOnly,
  upload.single('thumbnail'),
  createCourse
);
courseRouter.put(
  '/:id',
  protect,
  adminOnly,
  upload.single('thumbnail'),
  updateCourse
);
courseRouter.delete('/:id', protect, adminOnly, deleteCourse);

// Category Management (Admin only)
courseRouter.post('/category', protect, adminOnly, addCourseCategory);
courseRouter.delete('/category/:id', protect, adminOnly, deleteCourseCategory);

// Teacher Routes
courseRouter.get('/teacher/my-courses', protect, teacherOrAdmin, getTeacherCourses);
courseRouter.get('/teacher/courses/:id', protect, teacherOrAdmin, getTeacherCourseDetails);

// Student enrolled course lectures
courseRouter.get('/:id/my-lectures', protect, getCourseWithLectures);

// ==================== LECTURE MANAGEMENT ====================
// Lecture CRUD (Teacher or Admin)
courseRouter.post(
  '/lectures',
  protect,
  teacherOrAdmin,
  upload.fields([{ name: 'resources', maxCount: 10 }]),
  createLecture
);
courseRouter.get('/lectures/course/:courseId', protect, teacherOrAdmin, getLecturesByCourse);
courseRouter.get('/lectures/:id', protect, teacherOrAdmin, getLecture);
courseRouter.put(
  '/lectures/:id',
  protect,
  teacherOrAdmin,
  upload.fields([{ name: 'resources', maxCount: 10 }]),
  updateLecture
);
courseRouter.delete('/lectures/:id', protect, teacherOrAdmin, deleteLecture);
courseRouter.delete(
  '/lectures/:lectureId/resources/:resourceId',
  protect,
  teacherOrAdmin,
  deleteResource
);

// ==================== COUPON MANAGEMENT ====================
// Coupon CRUD (Admin only)
courseRouter.post('/:id/coupons', protect, adminOnly, addCouponToCourse);
courseRouter.put('/coupons/:couponId', protect, adminOnly, updateCoupon);
courseRouter.delete('/coupons/:couponId', protect, adminOnly, deleteCoupon);

// ==================== REVIEW MANAGEMENT ====================
// Review CRUD
courseRouter.post('/:courseId/reviews', protect, addReview);
courseRouter.put('/:courseId/reviews/:reviewId', protect, updateReview);
courseRouter.delete('/:courseId/reviews/:reviewId', protect, deleteReview);
courseRouter.get('/:courseId/reviews', getCourseReviews);
courseRouter.get('/:courseId/my-review', protect, getUserReviewForCourse);

export default courseRouter;