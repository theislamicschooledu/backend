import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      require: true,
      trim: true,
      match: [/\S+@\S+\.\S+/, 'Invalid email address'],
    },
    phone: {
      type: String,
      unique: true,
      require: true,
      sparse: true,
      match: [/^(\+8801|01)[0-9]{9}$/, 'Invalid phone number'],
    },
    password: {
      type: String,
      required: true,
      minlength: [6, 'Password must be at least 6 characters long'],
    },
    avatar: { type: String },
    avatarPublicId: { type: String },
    address: {
      type: String,
    },
    role: {
      type: String,
      enum: ['student', 'teacher', 'admin'],
      default: 'student',
    },
    enrolledCourses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
      },
    ],
    isBanned: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },
    otp: { type: String },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    verificationTokenExpiresAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
