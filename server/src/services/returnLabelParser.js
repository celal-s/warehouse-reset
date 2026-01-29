const pdfParse = require('pdf-parse');
const fs = require('fs').promises;
const path = require('path');

const returnLabelParser = {
  /**
   * Parse return label filename to extract return information
   * @param {string} filename - The PDF filename
   * @returns {object} Parsed data: { asin, orderNumber, quantity, carrier, isDamaged, productNameHint }
   */
  parseFilename(filename) {
    // Remove .pdf extension and normalize
    const baseName = filename.replace(/\.pdf$/i, '').trim();

    // Extract ASIN (B followed by 9 alphanumeric characters)
    const asinMatch = baseName.match(/B[A-Z0-9]{9}/i);
    const asin = asinMatch ? asinMatch[0].toUpperCase() : null;

    // Extract order number (XXX-XXXXXXX-XXXXXXX format)
    const orderMatch = baseName.match(/\d{3}-\d{7}-\d{7}/);
    const orderNumber = orderMatch ? orderMatch[0] : null;

    // Extract quantity - look for numbers followed by unit words
    // Patterns: "30 units", "8 units", "3 damaged", "10 howtorne", "5 units return"
    let quantity = null;
    const quantityPatterns = [
      /(\d+)\s*(?:units?|adet)/i,           // "30 units", "8 units", "10 adet"
      /(\d+)\s+(?:damaged|hasarl[ıi])/i,     // "3 damaged", "5 hasarli"
      /(\d+)\s+[a-z]+\s+(?:return|iade)/i,  // "10 howtorne return", "20 olay products return"
    ];

    for (const pattern of quantityPatterns) {
      const match = baseName.match(pattern);
      if (match) {
        quantity = parseInt(match[1], 10);
        break;
      }
    }

    // If no quantity found with patterns, look for standalone numbers that aren't part of order/ASIN
    if (quantity === null) {
      // Remove order number and ASIN from string, then look for numbers
      let cleanedName = baseName;
      if (orderNumber) cleanedName = cleanedName.replace(orderNumber, '');
      if (asin) cleanedName = cleanedName.replace(new RegExp(asin, 'i'), '');

      // Match standalone numbers (not part of "RETURN 1", "RETURN 2" suffixes)
      const standaloneMatch = cleanedName.match(/\b(\d{1,3})\b(?!\s*\.pdf)/i);
      if (standaloneMatch && !cleanedName.match(/RETURN\s+\d+/i)) {
        quantity = parseInt(standaloneMatch[1], 10);
      }
    }

    // Extract carrier (UPS or FedEx, case insensitive)
    let carrier = null;
    if (/ups/i.test(baseName)) {
      carrier = 'UPS';
    } else if (/fedex/i.test(baseName)) {
      carrier = 'FedEx';
    }

    // Check if damaged
    const isDamaged = /DMG|damaged|hasarl[ıi]/i.test(baseName);

    // Extract product name hint - remaining text after removing known patterns
    let productNameHint = baseName;

    // Remove known patterns
    if (asin) productNameHint = productNameHint.replace(new RegExp(asin, 'i'), '');
    if (orderNumber) productNameHint = productNameHint.replace(orderNumber, '');
    productNameHint = productNameHint
      .replace(/\d+\s*(?:units?|adet)/gi, '')
      .replace(/ups|fedex/gi, '')
      .replace(/return\s*(?:label)?/gi, '')
      .replace(/DMG|damaged|hasarl[ıi]/gi, '')
      .replace(/WRONG/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // If hint is too short or just numbers, set to null
    if (!productNameHint || productNameHint.length < 3 || /^\d+$/.test(productNameHint)) {
      productNameHint = null;
    }

    return {
      asin,
      orderNumber,
      quantity,
      carrier,
      isDamaged,
      productNameHint
    };
  },

  /**
   * Parse PDF content to extract return information
   * @param {Buffer} pdfBuffer - The PDF file buffer
   * @returns {Promise<object>} Parsed data: { returnByDate, productName, asin }
   */
  async parsePdfContent(pdfBuffer) {
    try {
      const data = await pdfParse(pdfBuffer);
      const text = data.text || '';

      // Try to extract return deadline date
      let returnByDate = null;
      const datePatterns = [
        // Dates at the beginning of the document (no keyword required)
        /^\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/m,           // MM/DD/YYYY at start of line
        /^\s*(\d{4}-\d{2}-\d{2})/m,                            // ISO format at start of line
        /^\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/m,               // Month name at start of line
        // Original patterns with keywords
        /return\s*(?:by|before|deadline)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        /must\s*return\s*(?:by)?[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        /deadline[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s*(?:return|deadline)/i,
        // ISO date format
        /return\s*(?:by|before)?[:\s]*(\d{4}-\d{2}-\d{2})/i,
        // Month name format
        /return\s*(?:by|before)?[:\s]*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i
      ];

      for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
          // Try to parse the date
          const dateStr = match[1];
          const parsedDate = new Date(dateStr);
          if (!isNaN(parsedDate.getTime())) {
            returnByDate = parsedDate;
          }
          break;
        }
      }

      // Try to extract product name
      let productName = null;
      const productPatterns = [
        /product[:\s]+([^\n]+)/i,
        /item[:\s]+([^\n]+)/i,
        /description[:\s]+([^\n]+)/i,
        /title[:\s]+([^\n]+)/i
      ];

      for (const pattern of productPatterns) {
        const match = text.match(pattern);
        if (match && match[1].trim().length > 3) {
          productName = match[1].trim().substring(0, 255);
          break;
        }
      }

      // Try to extract ASIN from PDF content
      let asin = null;
      const asinMatch = text.match(/ASIN[:\s]*([B][A-Z0-9]{9})/i) ||
                        text.match(/\b(B[A-Z0-9]{9})\b/);
      if (asinMatch) {
        asin = asinMatch[1].toUpperCase();
      }

      return {
        returnByDate,
        productName,
        asin
      };
    } catch (error) {
      // Handle errors gracefully - return empty object if parsing fails
      console.warn('PDF parsing failed:', error.message);
      return {
        returnByDate: null,
        productName: null,
        asin: null
      };
    }
  },

  /**
   * Match parsed data to a product in the database
   * @param {object} parsedData - Parsed data from filename + PDF content
   * @param {object} db - Database connection
   * @returns {Promise<object|null>} Match result: { productId, productTitle, matchConfidence, matchType }
   */
  async matchToProduct(parsedData, db) {
    const { asin, productNameHint, productName } = parsedData;

    // Priority 1: Exact ASIN match
    if (asin) {
      try {
        const result = await db.query(`
          SELECT p.id, p.title
          FROM products p
          JOIN client_product_listings cpl ON p.id = cpl.product_id
          WHERE cpl.asin = $1
          LIMIT 1
        `, [asin]);

        if (result.rows.length > 0) {
          return {
            productId: result.rows[0].id,
            productTitle: result.rows[0].title,
            matchConfidence: 1.0,
            matchType: 'asin'
          };
        }
      } catch (error) {
        console.warn('ASIN lookup failed:', error.message);
      }
    }

    // Priority 2: Fuzzy title match using pg_trgm
    const titleToMatch = productName || productNameHint;
    if (titleToMatch && titleToMatch.length >= 3) {
      try {
        // First, ensure pg_trgm extension exists (may fail silently if no permissions)
        try {
          await db.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
        } catch (e) {
          // Extension may already exist or user may not have permissions
        }

        const result = await db.query(`
          SELECT id, title, similarity(title, $1) as sim
          FROM products
          WHERE similarity(title, $1) > 0.3
          ORDER BY sim DESC
          LIMIT 1
        `, [titleToMatch]);

        if (result.rows.length > 0) {
          return {
            productId: result.rows[0].id,
            productTitle: result.rows[0].title,
            matchConfidence: parseFloat(result.rows[0].sim),
            matchType: 'fuzzy_title'
          };
        }
      } catch (error) {
        // pg_trgm might not be available, try fallback ILIKE search
        console.warn('Fuzzy search failed, trying ILIKE fallback:', error.message);

        try {
          const result = await db.query(`
            SELECT id, title
            FROM products
            WHERE title ILIKE $1
            ORDER BY length(title)
            LIMIT 1
          `, [`%${titleToMatch}%`]);

          if (result.rows.length > 0) {
            return {
              productId: result.rows[0].id,
              productTitle: result.rows[0].title,
              matchConfidence: 0.5,
              matchType: 'ilike_title'
            };
          }
        } catch (fallbackError) {
          console.warn('ILIKE fallback also failed:', fallbackError.message);
        }
      }
    }

    return null;
  },

  /**
   * Main function to orchestrate parsing of a return label from file path
   * @param {string} filePath - Full path to the PDF file
   * @param {object} db - Database connection
   * @returns {Promise<object>} Complete parsed data for creating a return record
   */
  async parseReturnLabel(filePath, db) {
    // Read the file
    const pdfBuffer = await fs.readFile(filePath);
    const filename = path.basename(filePath);

    return this.parseFromBuffer(pdfBuffer, filename, db);
  },

  /**
   * Parse a return label from a buffer (for uploaded files)
   * @param {Buffer} pdfBuffer - The PDF file buffer
   * @param {string} filename - Original filename
   * @param {object} db - Database connection (optional, for product matching)
   * @returns {Promise<object>} Complete parsed data for creating a return record
   */
  async parseFromBuffer(pdfBuffer, filename, db = null) {
    // Parse filename
    const filenameData = this.parseFilename(filename);

    // Parse PDF content
    const pdfData = await this.parsePdfContent(pdfBuffer);

    // Merge data (PDF content takes precedence for ASIN if both exist)
    const mergedData = {
      asin: pdfData.asin || filenameData.asin,
      orderNumber: filenameData.orderNumber,
      quantity: filenameData.quantity,
      carrier: filenameData.carrier,
      isDamaged: filenameData.isDamaged,
      productNameHint: filenameData.productNameHint,
      productName: pdfData.productName,
      returnByDate: pdfData.returnByDate
    };

    // Match to product (if db is provided)
    let productMatch = null;
    if (db) {
      productMatch = await this.matchToProduct(mergedData, db);
    }

    // Build final result
    return {
      sourceIdentifier: mergedData.asin || mergedData.orderNumber,
      parsedProductName: mergedData.productName || mergedData.productNameHint,
      quantity: mergedData.quantity || 1,
      carrier: mergedData.carrier,
      returnByDate: mergedData.returnByDate,
      productId: productMatch ? productMatch.productId : null,
      matchConfidence: productMatch ? productMatch.matchConfidence : 0.0,
      isDamaged: mergedData.isDamaged,
      originalFilename: filename
    };
  }
};

module.exports = returnLabelParser;
