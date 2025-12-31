import { upload } from "../middlewares/upload.js";
import Documentation from "../models/Documentation.js";
import cloudinary from "../utils/cloudinary.js";

const isAdmin = (req) => req.user && req.user.role === "admin";

const uploadImageStream = async (buffer, folder, fileName) => {
  return new Promise((resolve, reject) => {
    const uploadTimeout = setTimeout(() => {
      reject(new Error('Image upload timeout after 30 seconds'));
    }, 30000);

    const stream = cloudinary.uploader.upload_stream(
      { 
        folder: `documentation/${folder}`,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        transformation: [
          { width: 1200, height: 800, crop: 'limit' },
          { quality: 'auto:good' }
        ],
        public_id: fileName ? `${fileName}_${Date.now()}` : undefined,
        overwrite: true
      },
      (error, result) => {
        clearTimeout(uploadTimeout);
        if (error) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
        } else {
          resolve(result);
        }
      }
    );
    
    stream.on('error', (error) => {
      clearTimeout(uploadTimeout);
      reject(error);
    });
    
    stream.end(buffer);
  });
};


const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    if (result.result !== 'ok') {
      throw new Error(`Failed to delete image: ${result.result}`);
    }
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw error;
  }
};

const handleCreateOrUpdate = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Admin only." 
      });
    }

    const {
      principalVoiceTitle,
      principalVoiceText,
      ourMission,
      ourVision,
      onlineFeatures,
      ourAchievement,
      helpline,
      email,
      headOffice,
      website,
      facebook,
      youtube,
      whatsapp,
      telegram
    } = req.body;

    if (!principalVoiceTitle || !principalVoiceText) {
      return res.status(400).json({
        success: false,
        message: "Principal voice title and text are required"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Principal voice photo is required"
      });
    }

    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        message: "Only image files are allowed"
      });
    }

    const existingDoc = await Documentation.findOne();

    let uploadResult;
    let oldPublicId = null;

    try {
      const fileName = `principal_voice_${Date.now()}`;
      
      if (existingDoc && existingDoc.principalVoice.photoPublicId) {
        oldPublicId = existingDoc.principalVoice.photoPublicId;
      }
      
      uploadResult = await uploadImageStream(
        req.file.buffer, 
        'principal-voice',
        fileName
      );
    } catch (uploadError) {
      console.error('Image upload error:', uploadError);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload image to Cloudinary'
      });
    }

    const parseArrayField = (field) => {
      if (!field) return [];
      if (Array.isArray(field)) return field;
      if (typeof field === 'string') {
        try {
          const parsed = JSON.parse(field);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return field.split(',').map(item => item.trim()).filter(item => item);
        }
      }
      return [];
    };

    const documentationData = {
      principalVoice: {
        photo: uploadResult.secure_url,
        photoPublicId: uploadResult.public_id,
        title: principalVoiceTitle,
        text: principalVoiceText
      },
      ourMission: ourMission || '',
      ourVision: ourVision || '',
      onlineFeatures: parseArrayField(onlineFeatures),
      ourAchievement: parseArrayField(ourAchievement),
      contact: {
        helpline: parseArrayField(helpline),
        email: parseArrayField(email),
        headOffice: headOffice || '',
        website: parseArrayField(website)
      },
      socialMedia: {
        facebook: facebook || '',
        youtube: youtube || '',
        whatsapp: whatsapp || '',
        telegram: telegram || ''
      }
    };

    if (existingDoc) {
      if (oldPublicId && oldPublicId !== uploadResult.public_id) {
        try {
          await deleteImage(oldPublicId);
          console.log('Old image deleted from Cloudinary:', oldPublicId);
        } catch (deleteError) {
          console.error('Failed to delete old image from Cloudinary:', deleteError);
        }
      }

      const updatedDoc = await Documentation.findOneAndUpdate(
        {},
        { $set: documentationData },
        { 
          new: true, 
          runValidators: true,
          upsert: false
        }
      );

      return res.status(200).json({
        success: true,
        message: 'Documentation updated successfully',
        data: updatedDoc,
      });
    } else {
      const newDoc = await Documentation.create(documentationData);

      return res.status(201).json({
        success: true,
        message: 'Documentation created successfully',
        data: newDoc,
      });
    }

  } catch (error) {
    console.error('Error in create/update documentation:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getDocumentation = async (req, res) => {
  try {
    const documentation = await Documentation.findOne();

    if (!documentation) {
      return res.status(404).json({
        success: false,
        message: 'No documentation found',
        data: null
      });
    }

    return res.status(200).json({
      success: true,
      data: documentation,
    });
  } catch (error) {
    console.error('Error in getDocumentation:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const createOrUpdateDocumentation = [
  upload.single('principalVoicePhoto'),
  handleCreateOrUpdate
];

export const deleteDocumentation = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Admin only." 
      });
    }

    const documentation = await Documentation.findOne();

    if (!documentation) {
      return res.status(404).json({
        success: false,
        message: 'Documentation not found',
      });
    }

    if (documentation.principalVoice.photoPublicId) {
      try {
        await deleteImage(documentation.principalVoice.photoPublicId);
        console.log('Image deleted from Cloudinary:', documentation.principalVoice.photoPublicId);
      } catch (deleteError) {
        console.error('Failed to delete image from Cloudinary:', deleteError);
      }
    }

    await Documentation.deleteOne({ _id: documentation._id });

    return res.status(200).json({
      success: true,
      message: 'Documentation deleted successfully',
    });
  } catch (error) {
    console.error('Error in deleteDocumentation:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};