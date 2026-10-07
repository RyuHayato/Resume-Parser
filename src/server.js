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
const PARSE_SCRIPT = path.join(ROOT, 'scripts', 'parse_resume.py');

// Dynamically resolve the virtual environment's Python binary per-platform
const VENV_PYTHON =
  process.platform === 'win32'
    ? path.join(ROOT, 'venv', 'Scripts', 'python.exe')
    : path.join(ROOT, 'venv', 'bin', 'python');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(ROOT, 'public')));

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

function runParser(pythonBin, scriptPath, filePath) {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin, [scriptPath, filePath], { cwd: ROOT });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', (err) => reject(new Error(`${err.message} | stderr: ${stderr}`)));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

app.post('/api/upload', upload.single('resume'), async (req, res) => {
  const filePath = req.file ? req.file.path : null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Attach a PDF with field name "resume".' });
    }

    // Verify the venv Python exists before spawning
    if (!fs.existsSync(VENV_PYTHON)) {
      return res.status(500).json({
        error: `Virtual environment Python not found at: ${VENV_PYTHON}`,
        stderr: 'Environment detection failed - create the venv (python -m venv venv) and install requirements.',
      });
    }

    const { code, stdout, stderr } = await runParser(VENV_PYTHON, PARSE_SCRIPT, req.file.path);

    let parsed;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      return res.status(500).json({
        error: 'Parser returned invalid output.',
        stderr: stderr.trim() || stdout.trim(),
      });
    }

    if (code !== 0 || parsed.error) {
      return res.status(422).json({
        error: parsed.error || 'Failed to parse the resume.',
        stderr: stderr.trim(),
      });
    }

    return res.json(parsed);
  } catch (err) {
    return res.status(500).json({ error: 'Execution crash while running the parser.', stderr: String(err.message || err) });
  } finally {
    // Guarantee the uploaded PDF is wiped whether parsing succeeded or crashed
    if (filePath) {
      fs.unlink(filePath, () => {});
    }
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
