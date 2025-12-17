import express from 'express';
import {
  changePassword,
  checkAuth,
  forgotPassword,
  getTeacherAdmin,
  getUserCount,
  getUserDataById,
  logIn,
  logOut,
  resetPassword,
  signUp,
  updateUser,
  verifyOldPassword,
  verifyOtp,
} from '../controller/authController.js';
import { protect } from '../middlewares/auth.js';
import { upload } from '../middlewares/upload.js';

const authRouter = express.Router();

authRouter.post('/signup', signUp);
// for create new user
authRouter.post('/login', logIn);
// for sign in user
authRouter.post('/verify', verifyOtp);
// for verify email
authRouter.post('/verify-password', protect, verifyOldPassword);
// for verify password is correct
authRouter.post('/change-password', protect, changePassword);
// if user want to change password, should provide previous password for security.
authRouter.post('/forgot-password', forgotPassword);
// if forget password an otp is send to email
authRouter.post('/reset-password', resetPassword);
// after verify otp user can reset password
authRouter.put('/:id', protect, upload.single('user'), updateUser);
authRouter.get('/check', protect, checkAuth);
// Checking if user is authenticated
authRouter.post('/logout', logOut);
// for log out
authRouter.get('/teachers', getTeacherAdmin);
authRouter.get('/users', getUserCount);
authRouter.get('/:id', getUserDataById);

export default authRouter;
