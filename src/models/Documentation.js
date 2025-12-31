import mongoose from 'mongoose';

const DocumentationSchema = new mongoose.Schema(
  {
    principalVoice: {
      photo: {
        type: String,
        required: true,
      },
      photoPublicId: {
        type: String,
        required: true,
      },
      title: {
        type: String,
        required: true,
      },
      text: {
        type: String,
        required: true,
      },
    },
    ourMission: {
      type: String,
      required: true,
    },
    ourVision: {
      type: String,
      required: true,
    },
    onlineFeatures: [
      {
        type: String,
        required: true,
      },
    ],
    ourAchievement: [
      {
        type: String,
        required: true,
      },
    ],
    contact: {
      helpline: [
        {
          type: String,
          required: true,
        },
      ],
      email: [
        {
          type: String,
          required: true,
        },
      ],
      headOffice: {
        type: String,
        required: true,
      },
      website: [
        {
          type: String,
          required: true,
        },
      ],
    },
    socialMedia: {
      facebook: { type: String, required: true },
      youtube: { type: String, required: true },
      whatsapp: { type: String, required: true },
      telegram: { type: String, required: true },
    },
  },
  { timestamps: true }
);

export default mongoose.model('Documentation', DocumentationSchema);