import { Router, Request, Response } from 'express';
import multer from 'multer';
import { supabase } from '../infrastructure/supabase';
import { authMiddleware } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: images, PDF, Word documents'));
    }
  },
});

router.post(
  '/service-document',
  authMiddleware,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const fileExt = req.file.originalname.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `service-documents/${fileName}`;

      const { data, error } = await supabase.storage
        .from('crm-attachments')
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (error) {
        console.error('Supabase upload error:', error);
        return res.status(500).json({ error: 'Failed to upload file to storage' });
      }

      const { data: { publicUrl } } = supabase.storage
        .from('crm-attachments')
        .getPublicUrl(filePath);

      res.json({
        url: publicUrl,
        fileName: req.file.originalname,
        storagePath: filePath,
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to upload file' });
    }
  }
);

router.post(
  '/promotion-image',
  authMiddleware,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedImageTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: 'Only image files allowed for promotions' });
      }

      const fileExt = req.file.originalname.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `promotion-images/${fileName}`;

      const { data, error } = await supabase.storage
        .from('crm-attachments')
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (error) {
        console.error('Supabase upload error:', error);
        return res.status(500).json({ error: 'Failed to upload image to storage' });
      }

      const { data: { publicUrl } } = supabase.storage
        .from('crm-attachments')
        .getPublicUrl(filePath);

      res.json({
        url: publicUrl,
        fileName: req.file.originalname,
        storagePath: filePath,
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to upload image' });
    }
  }
);

router.delete(
  '/file',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { storagePath } = req.body;

      if (!storagePath) {
        return res.status(400).json({ error: 'Storage path is required' });
      }

      const { error } = await supabase.storage
        .from('crm-attachments')
        .remove([storagePath]);

      if (error) {
        console.error('Supabase delete error:', error);
        return res.status(500).json({ error: 'Failed to delete file from storage' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Delete error:', error);
      res.status(500).json({ error: 'Failed to delete file' });
    }
  }
);

export default router;
