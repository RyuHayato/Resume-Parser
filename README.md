# Resume Parser

A web app that extracts structured information (name, email, phone, skills, education, work experience) from PDF resumes.

## Stack

- **Backend parsing:** Python (`pdfplumber`, `spaCy`, `nltk`, regex)
- **Server / API:** Node.js + Express, `multer`, `cors`
- **Frontend:** HTML5, Tailwind CSS (CDN), vanilla JS

## Project Structure

```
Resume-Parser/
├── uploads/            # temporary uploaded PDFs (auto-cleaned)
├── public/             # frontend (index.html, app.js)
├── scripts/            # parse_resume.py (Python extractor)
├── src/                # server.js (Express API)
├── requirements.txt    # Python dependencies
└── package.json        # Node dependencies
```

## Setup

### 1. Node.js dependencies

```bash
npm install
```

### 2. Python environment & dependencies

```bash
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

## Run

```bash
npm start
```

Then open http://localhost:3000 and upload a PDF resume.

## API

`POST /api/upload`

- Form field: `resume` (PDF file, max 5 MB)
- Returns JSON:

```json
{
  "name": "Jane Doe",
  "email": "jane.doe@example.com",
  "phone": "(555) 123-4567",
  "skills": ["python", "react", "..."],
  "education": "B.Sc. Computer Science, ...",
  "work_experience": ["Senior Developer, ...", "..."]
}
```

You can also run the parser directly:

```bash
venv\Scripts\python.exe scripts\parse_resume.py path\to\resume.pdf
```
