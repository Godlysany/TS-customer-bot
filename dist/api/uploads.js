"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const supabase_1 = require("../infrastructure/supabase");
const auth_1 = require("../middleware/auth");
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
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
        }
        else {
            cb(new Error('Invalid file type. Allowed: images, PDF, Word documents'));
        }
    },
});
router.post('/service-document', auth_1.authMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const fileExt = req.file.originalname.split('.').pop();
        const fileName = `${crypto_1.default.randomUUID()}.${fileExt}`;
        const filePath = `service-documents/${fileName}`;
        const { data, error } = await supabase_1.supabase.storage
            .from('crm-attachments')
            .upload(filePath, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: false,
        });
        if (error) {
            console.error('Supabase upload error:', error);
            return res.status(500).json({ error: 'Failed to upload file to storage' });
        }
        const { data: { publicUrl } } = supabase_1.supabase.storage
            .from('crm-attachments')
            .getPublicUrl(filePath);
        res.json({
            url: publicUrl,
            fileName: req.file.originalname,
            storagePath: filePath,
        });
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});
router.post('/promotion-image', auth_1.authMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedImageTypes.includes(req.file.mimetype)) {
            return res.status(400).json({ error: 'Only image files allowed for promotions' });
        }
        const fileExt = req.file.originalname.split('.').pop();
        const fileName = `${crypto_1.default.randomUUID()}.${fileExt}`;
        const filePath = `promotion-images/${fileName}`;
        const { data, error } = await supabase_1.supabase.storage
            .from('crm-attachments')
            .upload(filePath, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: false,
        });
        if (error) {
            console.error('Supabase upload error:', error);
            return res.status(500).json({ error: 'Failed to upload image to storage' });
        }
        const { data: { publicUrl } } = supabase_1.supabase.storage
            .from('crm-attachments')
            .getPublicUrl(filePath);
        res.json({
            url: publicUrl,
            fileName: req.file.originalname,
            storagePath: filePath,
        });
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});
router.delete('/file', auth_1.authMiddleware, async (req, res) => {
    try {
        const { storagePath } = req.body;
        if (!storagePath) {
            return res.status(400).json({ error: 'Storage path is required' });
        }
        const { error } = await supabase_1.supabase.storage
            .from('crm-attachments')
            .remove([storagePath]);
        if (error) {
            console.error('Supabase delete error:', error);
            return res.status(500).json({ error: 'Failed to delete file from storage' });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});
exports.default = router;
