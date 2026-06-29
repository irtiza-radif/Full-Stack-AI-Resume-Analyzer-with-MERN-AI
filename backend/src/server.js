const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const serverless = require("serverless-http"); // 1. Import serverless-http
const env = require("./config/env");
const { connectDB } = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const healthRouter = require("./routes/health");
const authRouter = require("./routes/auth"); 
const resumesRouter = require("./routes/resumes");
const dashboardRouter = require("./routes/dashboard");
const insightsRouter = require("./routes/insights");
const versionsRouter = require("./routes/versions");
const historyRouter = require("./routes/history");

const app = express();

app.set("trust proxy", 1);
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

if (!env.isProd) app.use(morgan("dev"));

// Routes
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/resumes", resumesRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/insights", insightsRouter);
app.use("/api/resumes", resumesRouter); // Note: You have resumesRouter twice, keep as is
app.use("/api/history", historyRouter);

app.use(notFound);
app.use(errorHandler);

// 2. Wrap the app for Netlify
module.exports.handler = serverless(app);

// 3. Local Development Start
// This ensures app.listen ONLY runs when you run `node src/server.js` 
// locally, and not when Netlify imports this file.
if (require.main === module) {
  async function start() {
    try {
      await connectDB();
      app.listen(env.port, () => {
        console.log(`Server listening on http://localhost:${env.port} (${env.nodeEnv})`);
      });
    } catch (err) {
      console.error("Failed to start server:", err.message);
      process.exit(1);
    }
  }
  start();
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});