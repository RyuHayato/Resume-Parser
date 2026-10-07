const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

const ROOT = path.join(__dirname, '..');
const UPLOADS_DIR = path.join(ROOT, 'uploads');
const PYTHON_BIN = path.join(ROOT, 'venv', 'Scripts', 'python.exe');
const PARSE_SCRIPT = path.join(ROOT, 'scripts', 'parse_resume.py');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(ROOT, 'public')));

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const isPdf =
      file.mimetype === 'application/pdf' ||
      path.extname(file.originalname).toLowerCase() === '.pdf';
    if (isPdf) cb(null, true);
    else cb(new Error('Only PDF files are allowed.'));
  },
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/upload', upload.single('resume'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Attach a PDF with field name "resume".' });
  }

  const filePath = req.file.path;
  const python = fs.existsSync(PYTHON_BIN) ? PYTHON_BIN : 'python';
  const child = spawn(python, [PARSE_SCRIPT, filePath], { cwd: ROOT });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => (stdout += d.toString()));
  child.stderr.on('data', (d) => (stderr += d.toString()));

  child.on('error', (err) => {
    cleanup();
    res.status(500).json({ error: `Failed to start parser: ${err.message}` });
  });

  child.on('close', (code) => {
    cleanup();
    let parsed;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      return res.status(500).json({
        error: 'Parser returned invalid output.',
        details: (stderr || stdout).trim(),
      });
    }
    if (code !== 0 || parsed.error) {
      return res.status(422).json({ error: parsed.error || 'Failed to parse the resume.' });
    }
    res.json(parsed);
  });

  function cleanup() {
    fs.unlink(filePath, () => {});
  }
});

// Multer errors (file type, size)
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`Resume Parser server running at http://localhost:${PORT}`);
});
