const multer = require("multer");
const ApiError = require("../utils/ApiError");

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(ApiError.badRequest("Only PDF files are accepted"));
    }
    cb(null, true);
  },
});

module.exports = { uploadPdf: upload.single("file") };