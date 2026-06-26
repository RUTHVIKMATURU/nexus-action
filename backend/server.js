require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mentorshipRoutes = require('./routes/mentorshipRoutes');

const app = express();

// Middleware
app.use(express.json()); // Parses incoming JSON requests
app.use(cors({
    origin: process.env.FRONTEND_URL, // Strictly only allows requests from your Vite frontend
    credentials: true
}));

// Routes
app.use('/api', mentorshipRoutes);

// Basic Health Check Route
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'healthy', message: 'NexusAction Core API is running' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});