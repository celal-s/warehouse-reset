/**
 * Cloudinary Service for PDF uploads
 *
 * Handles uploading PDFs to Cloudinary with graceful fallback
 * when Cloudinary is not configured.
 */

const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Check if Cloudinary is configured
 * @returns {boolean}
 */
function isConfigured() {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Generate a unique public ID for return label uploads
 * @param {string} filename - Original filename
 * @param {string} sourceIdentifier - ASIN or other identifier
 * @returns {string} Sanitized public ID
 */
function generateReturnLabelPublicId(filename, sourceIdentifier) {
  // Sanitize filename: remove extension, replace spaces and special chars
  const sanitizedFilename = filename
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase()
    .substring(0, 50); // Limit length

  const sanitizedIdentifier = (sourceIdentifier || 'unknown')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 20);

  const timestamp = Date.now();

  return `${sanitizedIdentifier}_${sanitizedFilename}_${timestamp}`;
}

/**
 * Upload a PDF buffer to Cloudinary
 * @param {Buffer} buffer - PDF file buffer
 * @param {string} publicId - Public ID for the file
 * @param {string} folder - Cloudinary folder path
 * @returns {Promise<{secure_url: string}|null>} Upload result or null if failed/not configured
 */
async function uploadPdf(buffer, publicId, folder = 'warehouse/return-labels') {
  if (!isConfigured()) {
    console.warn('Cloudinary not configured - skipping PDF upload');
    return null;
  }

  try {
    // Convert buffer to data URI for upload
    const dataUri = `data:application/pdf;base64,${buffer.toString('base64')}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      resource_type: 'raw',
      folder,
      public_id: publicId,
      overwrite: true
    });

    return { secure_url: result.secure_url };
  } catch (error) {
    console.error('Cloudinary upload failed:', error.message);
    return null;
  }
}

/**
 * Upload a return label PDF
 * Convenience method that generates the public ID automatically
 * @param {Buffer} buffer - PDF file buffer
 * @param {string} filename - Original filename
 * @param {string} sourceIdentifier - ASIN or other identifier from the label
 * @returns {Promise<{secure_url: string}|null>} Upload result or null if failed
 */
async function uploadReturnLabel(buffer, filename, sourceIdentifier) {
  const publicId = generateReturnLabelPublicId(filename, sourceIdentifier);
  return uploadPdf(buffer, publicId, 'warehouse/return-labels');
}

module.exports = {
  isConfigured,
  generateReturnLabelPublicId,
  uploadPdf,
  uploadReturnLabel
};
