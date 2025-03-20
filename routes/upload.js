const express = require('express');
const router = express.Router();
const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');
require('dotenv').config();

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Upload endpoint
router.post('/upload-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image file provided' });
        }

        const formData = new FormData();
        formData.append('image', req.file.buffer.toString('base64'));
        formData.append('key', process.env.IMGBB_API_KEY);

        const response = await axios.post('https://api.imgbb.com/1/upload', formData, {
            headers: formData.getHeaders()
        });

        // console.log('Image upload response:', response.data);

        res.json({
            success: true,
            data: {
                url: response.data.data.url,
                delete_url: response.data.data.delete_url
            }
        });
    } catch (error) {
        console.error('Image upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload image',
            error: error.message
        });
    }
});

module.exports = router;