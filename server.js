require('dotenv').config();
const express = require('express');
const app = express();
const mongoose = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const homeRoutes = require('./routes/homeRoutes');
const helmet = require('helmet');

app.use(helmet());
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/home', homeRoutes);

app.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));