import { Router } from 'express';
import contactService, { CSVImportRow } from '../core/ContactService';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import { parse } from 'csv-parse/sync';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Create contact manually
router.post('/contacts', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await contactService.createContact(req.body, req.agent!.id);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update contact
router.put('/contacts/:id', authMiddleware, async (req, res) => {
  try {
    await contactService.updateContact(req.params.id, req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get all contacts with filters
router.get('/contacts', authMiddleware, async (req, res) => {
  try {
    const filters = {
      source: req.query.source as string,
      hasConversation: req.query.hasConversation === 'true' ? true : req.query.hasConversation === 'false' ? false : undefined,
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };
    const contacts = await contactService.getAllContacts(filters);
    res.json(contacts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get contact by ID
router.get('/contacts/:id', authMiddleware, async (req, res) => {
  try {
    const contact = await contactService.getContact(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(contact);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Search contacts
router.get('/contacts/search/:query', authMiddleware, async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const contacts = await contactService.searchContacts(req.params.query, limit);
    res.json(contacts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get contact statistics
router.get('/contacts/stats/summary', authMiddleware, async (req, res) => {
  try {
    const stats = await contactService.getContactStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk CSV upload (Master only)
router.post('/contacts/bulk-upload', authMiddleware, requireRole('master'), upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Parse CSV
    const fileContent = req.file.buffer.toString('utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CSVImportRow[];

    // Import contacts
    const result = await contactService.importContactsFromCSV(records, req.agent!.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get import batch history
router.get('/contacts/import-batches', authMiddleware, async (req, res) => {
  try {
    const uploadedBy = req.query.uploadedBy as string;
    const batches = await contactService.getImportBatches(uploadedBy);
    res.json(batches);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get contacts by batch
router.get('/contacts/batch/:batchId', authMiddleware, async (req, res) => {
  try {
    const contacts = await contactService.getContactsByBatch(req.params.batchId);
    res.json(contacts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete contact
router.delete('/contacts/:id', authMiddleware, requireRole('master'), async (req: AuthRequest, res) => {
  try {
    await contactService.deleteContact(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
