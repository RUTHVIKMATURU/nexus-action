require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const mentorshipRoutes = require('./routes/mentorshipRoutes');

const app = express();

const frontendUrl = process.env.FRONTEND_URL;
if (!frontendUrl) {
    console.error('CRITICAL: FRONTEND_URL is not defined in environment variables.');
    process.exit(1);
}

// Middleware
app.use(express.json()); // Parses incoming JSON requests
app.use(cors({
    origin: frontendUrl, // Strictly only allows requests from your Vite frontend
    credentials: true
}));

// Basic Health Check Route (Unprotected)
app.get('/api/health', (req, res) => {
    let firebaseStatus = 'unknown';
    let firebaseError = null;
    try {
        const { getApps, initializeApp, cert } = require('firebase-admin/app');
        if (getApps().length === 0) {
            const str = process.env.FIREBASE_ADMIN_CONFIG;
            if (!str) throw new Error("No config string found");
            const serviceAccount = JSON.parse(str);
            initializeApp({ credential: cert(serviceAccount) });
        }
        firebaseStatus = 'success';
    } catch (e) {
        firebaseStatus = 'failed';
        firebaseError = e.message;
    }
    res.status(200).json({ 
        status: 'healthy', 
        message: 'NexusAction Core API is running',
        firebase_init_status: firebaseStatus,
        firebase_error: firebaseError
    });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('MongoDB connection error:', err));

// Routes (Protected)
app.use('/api', mentorshipRoutes);

const PORT = process.env.PORT;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});