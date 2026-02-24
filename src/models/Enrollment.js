// models/Enrollment.js
import mongoose from 'mongoose';

const enrollmentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true
    },
    transactionId: {
      type: String,
      required: true,
      unique: true
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled'],
      default: 'pending'
    },
    amount: {
      type: Number,
      required: true
    },
    originalAmount: {
      type: Number,
      required: true
    },
    discountAmount: {
      type: Number,
      default: 0
    },
    couponUsed: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon'
    },
    currency: {
      type: String,
      default: 'BDT'
    },
    paymentMethod: {
      type: String,
      default: 'uddoktapay'
    },
    paymentDetails: {
      method: String,
      submittedBy: String,
      mobileNumber: String,
      isManual: Boolean,
      submittedAt: Date,
      transactionId: String,
      couponCode: String,
      adminApprovedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      adminApprovedAt: Date,
      adminNotes: String,
      rejectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      rejectedAt: Date,
      rejectionReason: String
    },
    enrolledAt: {
      type: Date,
      default: Date.now
    },
    completionStatus: {
      type: String,
      enum: ['in-progress', 'completed'],
      default: 'in-progress'
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    completedLectures: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lecture',
      default: []
    }],
    lastActivity: {
      type: Date,
      default: Date.now
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Update lastActivity before saving
enrollmentSchema.pre('save', function(next) {
  if (this.isModified()) {
    this.lastActivity = new Date();
  }
  next();
});

// Virtual for completion percentage
enrollmentSchema.virtual('completionPercentage').get(function() {
  return this.progress;
});

enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });
enrollmentSchema.index({ lastActivity: -1 });

export default mongoose.model('Enrollment', enrollmentSchema);