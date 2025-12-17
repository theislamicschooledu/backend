import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { generateTokenAndSetCookie } from '../utils/jwt.js';
import { sendEmail } from '../utils/sendEmail.js';
import {
  getForgetPasswordEmailHtml,
  getVerificationEmailHtml,
} from '../utils/emailTemplate.js';
import cloudinary from '../utils/cloudinary.js';

export const signUp = async (req, res) => {
  const { name, email, phone, password } = req.body;

  try {
    if (!email || !phone) {
      return res.status(400).json({ message: 'Email and Phone is required' });
    }

    if (!name || !password) {
      return res.status(400).json({ message: 'Name and Password is required' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser)
      return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    const user = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      otp: verificationToken,
      verificationTokenExpiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });

    // jwt
    generateTokenAndSetCookie(res, user._id);

    // Email sending
    await sendEmail(
      email,
      'Your verification code for sign in',
      getVerificationEmailHtml(verificationToken, name)
    );

    await user.save();

    res.status(201).json({
      success: true,
      message: 'user created successfully',
      user: {
        ...user._doc,
        password: undefined,
        otp: undefined,
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const logIn = async (req, res) => {
  try {
    const { email, phone, emailOrPhone, password } = req.body;
    const identifier = emailOrPhone || email || phone;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email/Phone and password are required',
      });
    }

    const user = await User.findOne({
      $or: [{ email: identifier }, { phone: identifier }],
    });

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid credentials' });
    }

    if (user.isBanned) {
      return res
        .status(400)
        .json({ success: false, message: 'You are banned' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid credentials' });
    }

    generateTokenAndSetCookie(res, user._id);

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      user: {
        ...user._doc,
        password: undefined,
        otp: undefined,
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const verifyOtp = async (req, res) => {
  const { email, code } = req.body;

  try {
    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email and verification code is required',
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: 'User Not found' });
    }

    if (user.verified) {
      return res
        .status(400)
        .json({ success: false, message: 'User already verified' });
    }

    if (!user.otp || !user.verificationTokenExpiresAt) {
      return res.status(400).json({
        success: false,
        message: 'No OTP found. Please request again.',
      });
    }

    if (user.otp !== code) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    if (user.verificationTokenExpiresAt < Date.now()) {
      return res.status(400).json({ success: false, message: 'OTP expired' });
    }

    user.verified = true;
    user.otp = null;
    user.verificationTokenExpiresAt = null;

    await user.save();

    res
      .status(200)
      .json({ success: true, message: 'Email verification successful' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const verifyOldPassword = async (req, res) => {
  const { oldPassword } = req.body;

  try {
    const user = await User.findById(req.user._id);

    const isMatch = await bcrypt.compare(oldPassword, user.password);

    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: 'Old password is incorrect' });
    }

    res.status(200).json({ success: true, message: 'Old password is correct' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.user._id);

    const isMatch = await bcrypt.compare(oldPassword, user.password);

    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: 'Old password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res
      .status(200)
      .json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 mins
    await user.save();

    const resetLink = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    await sendEmail(
      email,
      'Password Reset Link',
      getForgetPasswordEmailHtml(resetLink, user.name)
    );

    res
      .status(200)
      .json({ success: true, message: 'Reset link sent to your email' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid or expired reset token' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res
      .status(200)
      .json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address } = req.body;

    const user = await User.findById(id);

    if (!user)
      return res
        .status(400)
        .json({ success: false, message: 'Invalid or expired reset token' });

    user.name = name;
    user.address = address;

    if (req.file) {
      if (user.avatarPublicId) {
        await cloudinary.uploader.destroy(user.avatarPublicId);
      }

      const result = await cloudinary.uploader.upload_stream(
        { folder: 'user' },
        async (error, result) => {
          if (error) throw error;
          user.avatar = result.secure_url;
          user.avatarPublicId = result.public_id;
          await user.save();
          res.json({ success: true, message: 'User Updated Successfully' });
        }
      );

      result.end(req.file.buffer);
      return;
    }

    await user.save();
    res.json({ success: true, message: 'User Updated Successfully' });
  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const checkAuth = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-otp -password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isBanned) {
      return res.status(403).json({ message: "You're Banned" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const logOut = async (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

export const getUserCount = async (req, res) => {
  try {
    const user = await User.find().select(
      'email isBanned name phone role avatar'
    );

    if (!user)
      return res.status(404).json({ success: false, message: 'No user found' });

    const totalUser = user.length;
    const student = user.filter((student) => student.role === 'student');
    const teacher = user.filter((teacher) => teacher.role === 'teacher');
    const admin = user.filter((admin) => admin.role === 'admin');
    const banned = user.filter((banned) => admin.isBanned === true);
    const courseEnroll = user.filter(
      (student) => student.enrolledCourses?.length > 0
    );

    res.status(200).json({
      success: true,
      students: student,
      teachers: teacher,
      admins: admin,
      banned: banned,
      userCount: {
        totalUser,
        totalCourseEnroll: courseEnroll.length,
        totalStudent: student.length,
        totalTeacher: teacher.length,
        totalAdmin: admin.length,
        TotalBanned: banned.length,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getTeacherAdmin = async (req, res) => {
  try {
    const teachers = await User.find({
      $or: [{ role: 'teacher' }, { role: 'admin' }],
    });

    if (!teachers || teachers.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'No teacher or admin found' });
    }

    res.status(200).json({ success: true, teachers });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getUserDataById = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findById(id).select(
      'name email phone avatar avatarPublicId address role enrolledCourses isBanned verified'
    );

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });

    res.status(200).json({ success: true, user: user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
