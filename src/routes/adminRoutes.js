import express from 'express';
import { adminOnly, protect } from '../middlewares/auth.js';
import {
  addBlogCategory,
  addQuestionCategory,
  approveAnswer,
  banUser,
  changeBlogFeatured,
  changeBlogStatus,
  changeCourseFeatured,
  changeCourseStatus,
  changeQnaFeatured,
  changeQnaStatus,
  changeRole,
  deleteBlogCategory,
  deleteQuestionCategory,
  deleteUser,
  getAllUser,
  getBlogByIdForAdmin,
  getBlogsForAdmin,
  getQuestionByIdAdmin,
  getUserById,
  unBanUser,
} from '../controller/adminController.js';
const adminRouter = express.Router();

// user control route

adminRouter.get('/users', protect, adminOnly, getAllUser);
adminRouter.get('/users/:id', protect, adminOnly, getUserById);
adminRouter.put('/:id/ban', protect, adminOnly, banUser);
adminRouter.put('/:id/unBan', protect, adminOnly, unBanUser);
adminRouter.put('/change-role', protect, adminOnly, changeRole);
adminRouter.delete('/users/:id', protect, adminOnly, deleteUser);

// blog control route
adminRouter.get('/blogs', protect, adminOnly, getBlogsForAdmin);
adminRouter.post('/blogCategory', protect, adminOnly, addBlogCategory);
adminRouter.get('/blogs/:id', protect, adminOnly, getBlogByIdForAdmin);
adminRouter.put('/blogStatus/:id', protect, adminOnly, changeBlogStatus);
adminRouter.put('/blogFeature/:id', protect, adminOnly, changeBlogFeatured);
adminRouter.delete('/blogCategory/:id', protect, adminOnly, deleteBlogCategory);

// QnA control route
adminRouter.post('/questionCategory', protect, adminOnly, addQuestionCategory);
adminRouter.get('/qna/:id', protect, adminOnly, getQuestionByIdAdmin);
adminRouter.put(
  '/:id/answers/:answerId/approve',
  protect,
  adminOnly,
  approveAnswer
);
adminRouter.put('/qnaStatus/:id', protect, adminOnly, changeQnaStatus);
adminRouter.put('/qnaFeature/:id', protect, adminOnly, changeQnaFeatured);
adminRouter.delete(
  '/questionCategory/:id',
  protect,
  adminOnly,
  deleteQuestionCategory
);

// Course control routes
adminRouter.put('/courseStatus/:id', protect, adminOnly, changeCourseStatus);
adminRouter.put('/courseFeature/:id', protect, adminOnly, changeCourseFeatured);

export default adminRouter;
