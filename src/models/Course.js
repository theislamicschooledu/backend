import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    thumbnail: String,
    thumbnailPublicId: String,
    price: { type: Number, required: true },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CourseCategory',
      required: true,
    },
    description: { type: String, required: true },
    features: [
      {
        type: String,
        required: true,
      },
    ],
    teachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    lectures: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lecture' }],
    enrollmentStart: { type: Date, required: true },
    enrollmentEnd: { type: Date, required: true },
    courseStart: { type: Date, required: true },
    duration: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'published', 'rejected'],
      default: 'pending',
    },
    featured: { type: Boolean, default: false },
    coupons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' }],
    studentCount: {
      type: Number,
      default: 0,
    },
    averageRating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    reviews: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        rating: { type: Number, min: 1, max: 5 },
        comment: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model('Course', courseSchema);
