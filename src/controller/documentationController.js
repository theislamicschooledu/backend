import Documentation from "../models/Documentation.js";
import cloudinary from "../utils/cloudinary.js";

const isAdmin = (req) => req.user && req.user.role === "admin";

const uploadImageStream = async (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const uploadTimeout = setTimeout(() => {
      reject(new Error('Image upload timeout'));
    }, 30000);

    const stream = cloudinary.uploader.upload_stream(
      { 
        folder: `documentation/${folder}`,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
          { width: 800, height: 800, crop: 'limit' },
          { quality: 'auto:good' }
        ]
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

export const createDocumentation = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ 
        success: false, 
        error: "Access denied. Admin only." 
      });
    }

    const { sections } = req.body;
    const files = req.files || {};

    if (!sections || typeof sections !== 'object') {
      return res.status(400).json({
        success: false,
        error: "Invalid request body. 'sections' object required."
      });
    }

    const doc = new Documentation();
    
    for (const [sectionName, sectionData] of Object.entries(sections)) {
      if (!doc.isValidSection(sectionName)) {
        return res.status(400).json({
          success: false,
          error: `Invalid section: ${sectionName}`
        });
      }

      if (!files[sectionName] || !files[sectionName][0]) {
        return res.status(400).json({
          success: false,
          error: `Image required for ${sectionName}`
        });
      }

      const file = files[sectionName][0];
      
      // Basic file validation
      if (!file.mimetype.startsWith('image/')) {
        return res.status(400).json({
          success: false,
          error: `Only image files allowed for ${sectionName}`
        });
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        return res.status(400).json({
          success: false,
          error: `Image size too large for ${sectionName}. Max 5MB allowed.`
        });
      }

      const uploadResult = await uploadImageStream(
        file.buffer, 
        sectionName
      );

      doc.sections.set(sectionName, {
        ...sectionData,
        image: uploadResult.secure_url,
        imagePublicId: uploadResult.public_id
      });
    }

    await doc.save();

    res.status(201).json({ 
      success: true, 
      message: "Documentation created successfully",
      data: doc 
    });
  } catch (error) {
    console.error("Create Documentation Error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Internal server error" 
    });
  }
};

export const getDocumentation = async (req, res) => {
  try {
    const docs = await Documentation.find({});
    
    res.json({ 
      success: true, 
      count: docs.length,
      data: docs 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message || "Internal server error" 
    });
  }
};

export const updateDocumentation = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ 
        success: false, 
        error: "Access denied. Admin only." 
      });
    }

    const { docId } = req.params;
    const { sections } = req.body;
    const files = req.files || {};

    if (!docId) {
      return res.status(400).json({
        success: false,
        error: "Documentation ID required"
      });
    }

    const doc = await Documentation.findById(docId);
    if (!doc) {
      return res.status(404).json({ 
        success: false, 
        error: "Documentation not found" 
      });
    }

    for (const [sectionName, sectionData] of Object.entries(sections || {})) {
      if (!doc.isValidSection(sectionName)) {
        return res.status(400).json({
          success: false,
          error: `Invalid section: ${sectionName}`
        });
      }

      const existingSection = doc.sections.get(sectionName);
      const updatedSection = { ...existingSection?.toObject(), ...sectionData };

      // Handle image upload if new file provided
      if (files[sectionName] && files[sectionName][0]) {
        const file = files[sectionName][0];
        
        // File validation
        if (!file.mimetype.startsWith('image/')) {
          return res.status(400).json({
            success: false,
            error: `Only image files allowed for ${sectionName}`
          });
        }

        // Delete old image if exists
        if (existingSection?.imagePublicId) {
          try {
            await cloudinary.uploader.destroy(existingSection.imagePublicId);
          } catch (cloudinaryError) {
            console.error(`Failed to delete old image for ${sectionName}:`, cloudinaryError);
            // Continue with upload despite delete error
          }
        }

        const uploadResult = await uploadImageStream(
          file.buffer, 
          sectionName
        );

        updatedSection.image = uploadResult.secure_url;
        updatedSection.imagePublicId = uploadResult.public_id;
      }

      doc.sections.set(sectionName, updatedSection);
    }

    await doc.save();

    res.json({ 
      success: true, 
      message: "Documentation updated successfully",
      data: doc 
    });
  } catch (error) {
    console.error("Update Documentation Error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Internal server error" 
    });
  }
};

export const deleteSection = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ 
        success: false, 
        error: "Access denied. Admin only." 
      });
    }

    const { docId, sectionName } = req.params;

    if (!docId || !sectionName) {
      return res.status(400).json({
        success: false,
        error: "Documentation ID and section name required"
      });
    }

    const doc = await Documentation.findById(docId);
    if (!doc) {
      return res.status(404).json({ 
        success: false, 
        error: "Documentation not found" 
      });
    }

    if (!doc.sections.has(sectionName)) {
      return res.status(404).json({ 
        success: false, 
        error: "Section not found" 
      });
    }

    const section = doc.sections.get(sectionName);
    
    // Delete image from Cloudinary
    if (section.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(section.imagePublicId);
      } catch (cloudinaryError) {
        console.error(`Failed to delete image from Cloudinary:`, cloudinaryError);
        // Continue with deletion despite Cloudinary error
      }
    }

    // Remove section from map
    doc.sections.delete(sectionName);
    await doc.save();

    res.json({ 
      success: true, 
      message: `${sectionName} section deleted successfully` 
    });
  } catch (error) {
    console.error("Delete Section Error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Internal server error" 
    });
  }
};

export const getDocumentationById = async (req, res) => {
  try {
    const { docId } = req.params;
    
    const doc = await Documentation.findById(docId);
    if (!doc) {
      return res.status(404).json({ 
        success: false, 
        error: "Documentation not found" 
      });
    }

    res.json({ 
      success: true, 
      data: doc 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message || "Internal server error" 
    });
  }
};