import express from 'express';
import { DocumentService } from '../core/DocumentService';
import authMiddleware from './auth';
import { isValidUUID } from '../utils/uuid-validator';

const router = express.Router();
const documentService = new DocumentService();

router.get('/service/:serviceId', authMiddleware, async (req, res) => {
  try {
    const { serviceId } = req.params;
    
    if (!isValidUUID(serviceId)) {
      return res.status(400).json({ error: 'Invalid service ID format' });
    }
    
    const documents = await documentService.getDocumentsForService(serviceId);
    res.json({ documents });
  } catch (error: any) {
    console.error('Error fetching service documents:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const document = await documentService.createDocument(req.body);
    res.json({ document });
  } catch (error: any) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid document ID format' });
    }
    
    const document = await documentService.updateDocument(id, req.body);
    res.json({ document });
  } catch (error: any) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'Invalid document ID format' });
    }
    
    await documentService.deleteDocument(id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/deliver/:bookingId', authMiddleware, async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    if (!isValidUUID(bookingId)) {
      return res.status(400).json({ error: 'Invalid booking ID format' });
    }
    
    const { timing } = req.body;

    if (!['pre_booking', 'post_booking', 'pre_appointment', 'post_appointment'].includes(timing)) {
      return res.status(400).json({ error: 'Invalid timing parameter' });
    }

    const result = await documentService.deliverDocumentsForBooking(bookingId, timing);
    res.json(result);
  } catch (error: any) {
    console.error('Error delivering documents:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
