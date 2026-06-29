const mongoose = require("mongoose");
// Import the native promises DNS tracker module from Node.js
const dns = require("node:dns/promises"); 

const connectDB = async () => {
  try {
    // FORCE Node to resolve outside API calls via Cloudflare's secure DNS routing
    // This allows Mistral and MongoDB connections to bypass local Windows IPv6 network freezes
    dns.setServers(["1.1.1.1", "1.0.0.1"]); 

    const conn = await mongoose.connect(process.env.MONGO_URI || process.env.DATABASE_URL);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Database connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = { connectDB };