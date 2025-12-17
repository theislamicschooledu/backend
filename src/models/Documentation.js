import mongoose from 'mongoose';

const VoiceSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true, 
      trim: true,
      minlength: 2,
      maxlength: 100 
    },
    designation: { 
      type: String, 
      required: true, 
      trim: true,
      minlength: 2,
      maxlength: 100 
    },
    text: { 
      type: String, 
      required: true,
      minlength: 2,
      maxlength: 2000 
    },
    image: { 
      type: String, 
      required: true 
    },
    imagePublicId: {
      type: String,
      required: true
    }
  },
  { _id: false }
);

const DocumentationSchema = new mongoose.Schema(
  {
    sections: {
      type: Map,
      of: VoiceSchema,
      default: {}
    }
  },
  { timestamps: true }
);

DocumentationSchema.methods.isValidSection = function(sectionName) {
  const validSections = ['directorVoice', 'teacherVoice', 'studentVoice', 'parentVoice'];
  return validSections.includes(sectionName);
};

export default mongoose.model('Documentation', DocumentationSchema);