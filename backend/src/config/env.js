const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI || process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'your_temporary_development_secret_key',
  
  // 1. ADD THIS SAFE FALLBACK STRING HERE:
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d', 
  
  // 2. ADD THIS FALLBACK FOR COOKIE SECURITY CHECKS:
  isProd: process.env.NODE_ENV === 'production', 

  mistralApiKey: process.env.MISTRAL_API_KEY,
  mistralModel: process.env.MISTRAL_MODEL || 'mistral-large-latest'
};