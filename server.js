// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vnetwork', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed'));
    }
});

// MongoDB Schemas
const verificationSchema = new mongoose.Schema({
    verificationId: { type: String, unique: true },
    userAddress: String,
    task: String,
    screenshotPath: String,
    status: { 
        type: String, 
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
    },
    reviewedBy: String,
    reviewNotes: String,
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: Date
});

const userSchema = new mongoose.Schema({
    userAddress: { type: String, unique: true },
    referralCode: String,
    isActive: { type: Boolean, default: false },
    registrationDate: { type: Date, default: Date.now },
    tasksCompleted: {
        twitter: { type: Boolean, default: false },
        facebook: { type: Boolean, default: false },
        instagram: { type: Boolean, default: false },
        youtube: { type: Boolean, default: false },
        telegram: { type: Boolean, default: false }
    },
    dailyClaims: [{
        date: Date,
        amount: Number
    }]
});

const Verification = mongoose.model('Verification', verificationSchema);
const User = mongoose.model('User', userSchema);

// API Routes

// Submit verification
app.post('/api/submit-verification', upload.single('screenshot'), async (req, res) => {
    try {
        const { task, userAddress } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                error: 'No file uploaded' 
            });
        }
        
        // Generate unique verification ID
        const verificationId = 'VER' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
        
        // Create verification record
        const verification = new Verification({
            verificationId,
            userAddress,
            task,
            screenshotPath: req.file.path,
            status: 'pending'
        });
        
        await verification.save();
        
        // Update user tasks
        await User.findOneAndUpdate(
            { userAddress },
            { $set: { [`tasksCompleted.${task}`]: false } },
            { upsert: true, new: true }
        );
        
        res.json({
            success: true,
            verificationId,
            message: 'Verification submitted successfully'
        });
        
    } catch (error) {
        console.error('Verification submission error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Get verification status for a user
app.get('/api/verification-status/:userAddress', async (req, res) => {
    try {
        const { userAddress } = req.params;
        
        const verifications = await Verification.find({ 
            userAddress 
        }).sort({ submittedAt: -1 });
        
        // Get latest status for each task
        const statusMap = {};
        verifications.forEach(v => {
            if (!statusMap[v.task] || v.submittedAt > statusMap[v.task].submittedAt) {
                statusMap[v.task] = v;
            }
        });
        
        // Convert to simple status object
        const result = {};
        for (const [task, verification] of Object.entries(statusMap)) {
            result[task] = verification.status;
        }
        
        res.json(result);
        
    } catch (error) {
        console.error('Error getting verification status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Admin: Get pending verifications
app.get('/api/admin/pending-verifications', async (req, res) => {
    try {
        const pendingVerifications = await Verification.find({ 
            status: 'pending' 
        }).sort({ submittedAt: 1 });
        
        res.json(pendingVerifications);
        
    } catch (error) {
        console.error('Error getting pending verifications:', error);
        res.status(500).json({ error: error.message });
    }
});

// Admin: Update verification status
app.post('/api/admin/update-verification', async (req, res) => {
    try {
        const { verificationId, status, reviewNotes, reviewedBy } = req.body;
        
        const verification = await Verification.findOne({ verificationId });
        if (!verification) {
            return res.status(404).json({ error: 'Verification not found' });
        }
        
        verification.status = status;
        verification.reviewNotes = reviewNotes;
        verification.reviewedBy = reviewedBy;
        verification.reviewedAt = new Date();
        
        await verification.save();
        
        // If verified, update user tasks
        if (status === 'verified') {
            await User.findOneAndUpdate(
                { userAddress: verification.userAddress },
                { $set: { [`tasksCompleted.${verification.task}`]: true } }
            );
        }
        
        res.json({ 
            success: true, 
            message: 'Verification updated successfully' 
        });
        
    } catch (error) {
        console.error('Error updating verification:', error);
        res.status(500).json({ error: error.message });
    }
});

// User registration tracking
app.post('/api/track-registration', async (req, res) => {
    try {
        const { userAddress, referralCode } = req.body;
        
        const user = new User({
            userAddress,
            referralCode,
            isActive: true
        });
        
        await user.save();
        
        // Track referral if exists
        if (referralCode) {
            // Increment referral count for referrer
            // Add referral earning logic here
        }
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Registration tracking error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user info
app.get('/api/user/:userAddress', async (req, res) => {
    try {
        const user = await User.findOne({ 
            userAddress: req.params.userAddress 
        });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(user);
        
    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
    console.log(`Uploads directory: ${__dirname}/uploads`);
});
