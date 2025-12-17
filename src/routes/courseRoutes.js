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

// Course CRUD
courseRouter.post(
  '/',
  protect,
  adminOnly,
  upload.single('thumbnail'),
  createCourse
);
courseRouter.post('/courseCategory', protect, adminOnly, addCourseCategory);
courseRouter.get('/', getCourses);
courseRouter.get('/publicCourse', getPublishCourses);
courseRouter.get('/featuredCourse', getFeaturedCourses);
courseRouter.get('/teacherCourses', protect, teacherOrAdmin, getTeacherCourses);
courseRouter.get('/courseDetails/:id', getCourseDetails);
courseRouter.get('/courseCategory', getCourseCategory);
courseRouter.get(
  '/teacherCourses/:id',
  protect,
  teacherOrAdmin,
  getTeacherCourseDetails
);
courseRouter.get('/:id', protect, adminOnly, getCourseById);
courseRouter.get('/:id/lectures', protect, getCourseWithLectures);
courseRouter.put(
  '/:id',
  protect,
  adminOnly,
  upload.single('thumbnail'),
  updateCourse
);
courseRouter.delete('/:id', protect, adminOnly, deleteCourse);
courseRouter.delete(
  '/courseCategory/:id',
  protect,
  adminOnly,
  deleteCourseCategory
);

// Lecture CRUD (under course)
courseRouter.post(
  '/lectures',
  protect,
  teacherOrAdmin,
  upload.fields([{ name: 'resources', maxCount: 10 }]),
  createLecture
);

courseRouter.get(
  '/lectures/course/:courseId',
  protect,
  teacherOrAdmin,
  getLecturesByCourse
);

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

// Coupon CRUD (under course)
courseRouter.post('/:id/coupons', protect, adminOnly, addCouponToCourse);
courseRouter.put('/coupons/:couponId', protect, adminOnly, updateCoupon);
courseRouter.delete('/coupons/:couponId', protect, adminOnly, deleteCoupon);

// Review CRUD
courseRouter.post('/:courseId/reviews', protect, addReview);
courseRouter.put('/:courseId/reviews/:reviewId', protect, updateReview);
courseRouter.delete('/:courseId/reviews/:reviewId', protect, deleteReview);
courseRouter.get('/:courseId/reviews', getCourseReviews);
courseRouter.get('/:courseId/my-review', protect, getUserReviewForCourse);

export default courseRouter;
