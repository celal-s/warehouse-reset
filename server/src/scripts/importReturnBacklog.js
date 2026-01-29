/**
 * Return Label Backlog Import Script
 *
 * One-time script to import existing return label PDFs from the return-labels folder.
 *
 * Usage: node src/scripts/importReturnBacklog.js [optional-path-to-return-labels]
 *
 * The script will:
 * 1. Recursively scan the return-labels directory for PDF files
 * 2. Parse each PDF using returnLabelParser
 * 3. Create return records in the database
 * 4. Generate a summary report
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs').promises;
const path = require('path');
const db = require('../db');
const returnLabelParser = require('../services/returnLabelParser');
const returnsService = require('../services/returnsService');
const cloudinaryService = require('../services/cloudinaryService');

const RETURN_LABELS_DIR = process.argv[2] || path.join(__dirname, '../../../../return-labels');

/**
 * Recursively find all .pdf files in a directory
 * @param {string} dir - Directory path to scan
 * @returns {Promise<string[]>} Array of absolute file paths
 */
async function findPdfFiles(dir) {
  const pdfFiles = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subFiles = await findPdfFiles(fullPath);
        pdfFiles.push(...subFiles);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
        pdfFiles.push(fullPath);
      }
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Directory not found: ${dir}`);
    } else if (error.code === 'EACCES') {
      console.error(`Permission denied: ${dir}`);
    } else {
      throw error;
    }
  }

  return pdfFiles;
}

/**
 * Main import function
 */
async function importBacklog() {
  console.log('Starting return label backlog import...');
  console.log(`Source directory: ${RETURN_LABELS_DIR}`);
  console.log('');

  // Check if source directory exists
  try {
    await fs.access(RETURN_LABELS_DIR);
  } catch (error) {
    console.error(`Error: Source directory does not exist: ${RETURN_LABELS_DIR}`);
    process.exit(1);
  }

  // Generate import batch ID
  const importBatchId = `backlog-${Date.now()}`;

  // Find all PDF files
  const pdfFiles = await findPdfFiles(RETURN_LABELS_DIR);
  console.log(`Found ${pdfFiles.length} PDF files`);

  if (pdfFiles.length === 0) {
    console.log('No PDF files found. Exiting.');
    return { total: 0, successful: 0, failed: 0, matched: 0, unmatched: 0, errors: [] };
  }

  console.log('');
  console.log('Processing files...');
  console.log('');

  const results = {
    total: pdfFiles.length,
    successful: 0,
    failed: 0,
    matched: 0,
    unmatched: 0,
    uploaded: 0,
    uploadFailed: 0,
    errors: []
  };

  // Process each file
  for (const filePath of pdfFiles) {
    try {
      // Read PDF buffer for both parsing and upload
      const pdfBuffer = await fs.readFile(filePath);
      const filename = path.basename(filePath);

      // Parse the file
      const parsed = await returnLabelParser.parseReturnLabel(filePath, db);

      // Upload PDF to Cloudinary
      let labelUrl = null;
      const uploadResult = await cloudinaryService.uploadReturnLabel(
        pdfBuffer,
        filename,
        parsed.sourceIdentifier
      );

      if (uploadResult) {
        labelUrl = uploadResult.secure_url;
        results.uploaded++;
        console.log(`  [UPLOAD] ${filename} -> Uploaded to Cloudinary`);
      } else {
        results.uploadFailed++;
        console.log(`  [UPLOAD] ${filename} -> Upload skipped/failed`);
      }

      // Determine status based on match
      const status = parsed.productId ? 'pending' : 'unmatched';

      // Create return record
      await returnsService.createReturn({
        productId: parsed.productId,
        quantity: parsed.quantity || 1,
        returnType: 'pre_receipt',
        labelUrl,
        carrier: parsed.carrier,
        returnByDate: parsed.returnByDate,
        sourceIdentifier: parsed.sourceIdentifier,
        parsedProductName: parsed.parsedProductName,
        matchConfidence: parsed.matchConfidence,
        importBatchId,
        originalFilename: parsed.originalFilename,
        status // Note: status is not in createReturn params, will default to 'pending'
      });

      results.successful++;
      if (parsed.productId) {
        results.matched++;
        console.log(`  [OK] ${filename} -> Matched to product ${parsed.productId}`);
      } else {
        results.unmatched++;
        console.log(`  [??] ${filename} -> Unmatched (${parsed.sourceIdentifier || 'no identifier'})`);
      }
    } catch (error) {
      results.failed++;
      results.errors.push({ file: filePath, error: error.message });
      console.error(`  [ERR] ${path.basename(filePath)} -> Error: ${error.message}`);
    }
  }

  // Print summary
  console.log('');
  console.log('========== Import Summary ==========');
  console.log(`Total files: ${results.total}`);
  console.log(`Successful: ${results.successful}`);
  console.log(`  - Matched to products: ${results.matched}`);
  console.log(`  - Unmatched (need review): ${results.unmatched}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Uploaded to Cloudinary: ${results.uploaded}`);
  console.log(`Upload failed/skipped: ${results.uploadFailed}`);
  console.log(`Import Batch ID: ${importBatchId}`);

  if (results.errors.length > 0) {
    console.log('');
    console.log('Errors:');
    results.errors.forEach(e => console.log(`  - ${path.basename(e.file)}: ${e.error}`));
  }

  return results;
}

// Run if called directly
if (require.main === module) {
  importBacklog()
    .then(() => {
      console.log('');
      console.log('Import complete.');
      process.exit(0);
    })
    .catch(err => {
      console.error('Import failed:', err);
      process.exit(1);
    });
}

module.exports = { importBacklog, findPdfFiles };
