import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    discountType: {
      type: String,
      enum: ['percentage', 'flat'],
      required: true,
    },
    discountValue: { type: Number, required: true },
    expiryDate: Date,
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    usageLimit: { type: Number, default: 1 },
    usedCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('Coupon', couponSchema);
