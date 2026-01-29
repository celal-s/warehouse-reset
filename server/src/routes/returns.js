const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../db');
const activityService = require('../services/activityService');
const returnsService = require('../services/returnsService');
const returnLabelParser = require('../services/returnLabelParser');
const { authenticate, authorize } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

// Get all returns (with optional filters)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, client_id, urgent, product_id, limit, offset } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (client_id) filters.client_id = client_id;
    if (urgent !== undefined) filters.urgent = urgent === 'true';
    if (product_id) filters.product_id = product_id;
    if (limit) filters.limit = parseInt(limit);
    if (offset) filters.offset = parseInt(offset);

    const returns = await returnsService.getReturns(filters);
    res.json(returns);
  } catch (error) {
    next(error);
  }
});

// Get pending returns for warehouse dashboard
router.get('/pending', authenticate, authorize('admin', 'employee'), async (req, res, next) => {
  try {
    const returns = await returnsService.getPendingReturns();
    res.json(returns);
  } catch (error) {
    next(error);
  }
});

// Get unmatched returns for admin review
router.get('/unmatched', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const returns = await returnsService.getUnmatchedReturns();
    res.json(returns);
  } catch (error) {
    next(error);
  }
});

// Get single return
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const returnItem = await returnsService.getReturn(id);

    if (!returnItem) {
      return res.status(404).json({ error: 'Return not found' });
    }

    res.json(returnItem);
  } catch (error) {
    next(error);
  }
});

// Create pre-receipt return
router.post('/', authenticate, authorize('admin', 'employee'), async (req, res, next) => {
  try {
    const {
      product_id,
      quantity,
      label_url,
      carrier,
      tracking_number,
      return_by_date,
      source_identifier,
      parsed_product_name,
      client_notes,
      warehouse_notes
    } = req.body;

    const newReturn = await returnsService.createReturn({
      productId: product_id,
      quantity,
      labelUrl: label_url,
      carrier,
      trackingNumber: tracking_number,
      returnByDate: return_by_date,
      sourceIdentifier: source_identifier,
      parsedProductName: parsed_product_name,
      clientNotes: client_notes,
      warehouseNotes: warehouse_notes,
      returnType: 'pre_receipt',
      userId: req.user?.id
    });

    // Log activity (fire and forget)
    activityService.log(
      'return',
      newReturn.id,
      'created',
      'employee',
      req.user?.name || 'warehouse',
      { product_id, quantity, return_type: 'pre_receipt', tracking_number }
    ).catch(err => console.error('Activity log failed:', err));

    res.status(201).json(newReturn);
  } catch (error) {
    next(error);
  }
});

// Update return
router.patch('/:id', authenticate, authorize('admin', 'employee'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedReturn = await returnsService.updateReturn(id, updates, req.user?.id);

    if (!updatedReturn) {
      return res.status(404).json({ error: 'Return not found' });
    }

    res.json(updatedReturn);
  } catch (error) {
    next(error);
  }
});

// Mark return as shipped
router.post('/:id/ship', authenticate, authorize('admin', 'employee'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { tracking_number, carrier, warehouse_notes } = req.body;

    const shippedReturn = await returnsService.markShipped(id, {
      trackingNumber: tracking_number,
      carrier,
      warehouseNotes: warehouse_notes
    }, req.user?.id);

    if (!shippedReturn) {
      return res.status(404).json({ error: 'Return not found' });
    }

    // Log activity (fire and forget)
    activityService.log(
      'return',
      parseInt(id),
      'shipped',
      'employee',
      req.user?.name || 'warehouse',
      { tracking_number, carrier }
    ).catch(err => console.error('Activity log failed:', err));

    res.json(shippedReturn);
  } catch (error) {
    next(error);
  }
});

// Mark return as completed
router.post('/:id/complete', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const completedReturn = await returnsService.markCompleted(id, req.user?.id);

    if (!completedReturn) {
      return res.status(404).json({ error: 'Return not found' });
    }

    // Log activity (fire and forget)
    activityService.log(
      'return',
      parseInt(id),
      'completed',
      'admin',
      req.user?.name || 'warehouse',
      {}
    ).catch(err => console.error('Activity log failed:', err));

    res.json(completedReturn);
  } catch (error) {
    next(error);
  }
});

// Manually assign product to unmatched return
router.post('/:id/assign-product', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { product_id } = req.body;

    if (!product_id) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    const updatedReturn = await returnsService.assignProduct(id, product_id, req.user?.id);

    if (!updatedReturn) {
      return res.status(404).json({ error: 'Return not found' });
    }

    // Log activity (fire and forget)
    activityService.log(
      'return',
      parseInt(id),
      'product_assigned',
      'admin',
      req.user?.name || 'warehouse',
      { product_id }
    ).catch(err => console.error('Activity log failed:', err));

    res.json(updatedReturn);
  } catch (error) {
    next(error);
  }
});

// Import PDF backlog
router.post('/import-backlog', authenticate, authorize('admin'), upload.array('files'), async (req, res, next) => {
  try {
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const importBatchId = `import_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const results = {
      total: files.length,
      successful: 0,
      failed: 0,
      matched: 0,
      unmatched: 0,
      errors: []
    };

    for (const file of files) {
      try {
        // Parse the PDF file with product matching
        const parsedData = await returnLabelParser.parseFromBuffer(file.buffer, file.originalname, db);

        // Determine status based on match
        const status = parsedData.productId ? 'pending' : 'unmatched';

        // Create return record with parsed data
        await returnsService.createReturn({
          productId: parsedData.productId,
          quantity: parsedData.quantity || 1,
          returnType: 'pre_receipt',
          carrier: parsedData.carrier,
          returnByDate: parsedData.returnByDate,
          sourceIdentifier: parsedData.sourceIdentifier,
          parsedProductName: parsedData.parsedProductName,
          matchConfidence: parsedData.matchConfidence,
          importBatchId,
          originalFilename: parsedData.originalFilename,
          userId: req.user?.id,
          status
        });

        results.successful++;
        if (parsedData.productId) {
          results.matched++;
        } else {
          results.unmatched++;
        }
      } catch (err) {
        results.failed++;
        results.errors.push({
          filename: file.originalname,
          error: err.message
        });
      }
    }

    // Log activity for the batch import
    activityService.log(
      'return_import',
      null,
      'batch_import',
      'admin',
      req.user?.name || 'warehouse',
      { importBatchId, total: results.total, successful: results.successful, failed: results.failed }
    ).catch(err => console.error('Activity log failed:', err));

    res.json(results);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
