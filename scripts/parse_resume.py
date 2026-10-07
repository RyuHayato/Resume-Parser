#!/usr/bin/env python3
"""Resume Parser: extract structured data from a PDF resume and print JSON to stdout."""

import sys
import re
import json

try:
    import pdfplumber
except ImportError:
    print(json.dumps({"error": "pdfplumber is not installed"}))
    sys.exit(1)

try:
    import spacy
    NLP = spacy.load("en_core_web_sm")
except Exception:
    NLP = None


SKILLS_DICTIONARY = [
    "python", "javascript", "typescript", "java", "c++", "c#", "c", "ruby", "go", "rust",
    "php", "swift", "kotlin", "r", "sql", "html", "css", "tailwind", "bootstrap",
    "react", "angular", "vue", "node.js", "nodejs", "express", "django", "flask",
    "spring", "fastapi", "rails", "laravel", "docker", "kubernetes", "aws", "azure",
    "gcp", "git", "github", "jenkins", "ci/cd", "linux", "mongodb", "mysql",
    "postgresql", "redis", "graphql", "rest api", "machine learning", "deep learning",
    "nlp", "spacy", "nltk", "tensorflow", "pytorch", "pandas", "numpy", "excel",
    "power bi", "tableau", "figma", "photoshop", "agile", "scrum", "jenkins",
    "selenium", "pytest", "unittest", "jest", "webpack", "vite", "next.js", "nuxt",
]

EMAIL_REGEX = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_REGEX = re.compile(
    r"(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}"
)

SECTION_HEADERS = [
    "summary", "objective", "profile", "experience", "work experience",
    "professional experience", "employment history", "work history", "education",
    "skills", "technical skills", "projects", "certifications", "awards",
    "languages", "interests", "references", "volunteer", "publications",
]

EDUCATION_HEADERS = ["education", "education background", "academic background", "qualifications"]
EXPERIENCE_HEADERS = [
    "experience", "work experience", "professional experience",
    "employment history", "work history", "employment",
]


def extract_text(pdf_path: str) -> str:
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            pages.append(page.extract_text() or "")
    return "\n".join(pages)


def extract_email(text: str):
    match = EMAIL_REGEX.search(text)
    return match.group(0) if match else None


def extract_phone(text: str):
    match = PHONE_REGEX.search(text)
    return match.group(0).strip() if match else None


def extract_name(text: str):
    header_words = {h.lower() for h in SECTION_HEADERS}
    # Heuristic: first non-empty line that looks like a person's name
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if EMAIL_REGEX.search(line) or PHONE_REGEX.search(line):
            continue
        words = line.split()
        if (
            1 < len(words) <= 5
            and not any(ch.isdigit() for ch in line)
            and line.lower() not in header_words
            and all(re.match(r"^[A-Za-z.'-]+$", w) for w in words)
        ):
            return line
        break
    # Fallback: spaCy PERSON entities in the first part of the document
    if NLP is not None:
        doc = NLP(text[:1500])
        for ent in doc.ents:
            if ent.label_ == "PERSON":
                candidate = " ".join(ent.text.split())
                words = candidate.split()
                if (
                    1 < len(words) <= 4
                    and not re.search(r"(?i)email|phone|summary|skills|work", candidate)
                ):
                    return candidate
    return None


def extract_skills(text: str):
    found = []
    lowered = text.lower()
    for skill in SKILLS_DICTIONARY:
        pattern = r"(?<![A-Za-z0-9+#])" + re.escape(skill.lower()) + r"(?![A-Za-z0-9+#])"
        if re.search(pattern, lowered):
            found.append(skill)
    # Preserve original dictionary order, de-duped
    seen = set()
    ordered = []
    for s in found:
        if s not in seen:
            seen.add(s)
            ordered.append(s)
    return ordered


def find_section(text: str, headers) -> str:
    lines = text.splitlines()
    capture = False
    buf = []
    header_set = set(h.lower() for h in SECTION_HEADERS)
    for line in lines:
        stripped = line.strip().strip(":").lower()
        is_header = stripped in header_set or any(stripped == h for h in headers)
        if is_header:
            if capture:
                break
            if stripped in set(h.lower() for h in headers):
                capture = True
            continue
        if capture:
            buf.append(line)
    return "\n".join(buf).strip()


def extract_education(text: str):
    section = find_section(text, EDUCATION_HEADERS)
    return section if section else None


def extract_work_experience(text: str):
    section = find_section(text, EXPERIENCE_HEADERS)
    if not section:
        return None
    # Split into individual blocks on blank lines
    blocks = [b.strip() for b in re.split(r"\n\s*\n", section) if b.strip()]
    if len(blocks) > 1:
        return blocks
    # Fallback: split on lines that look like job headers containing a year/date range
    lines = [l.strip() for l in section.splitlines() if l.strip()]
    grouped, current = [], []
    for line in lines:
        if current and re.search(r"\(?\s*(19|20)\d{2}", line) and not line.startswith("-"):
            grouped.append("\n".join(current))
            current = [line]
        else:
            current.append(line)
    if current:
        grouped.append("\n".join(current))
    return grouped if len(grouped) > 1 else section


def parse_resume(pdf_path: str) -> dict:
    text = extract_text(pdf_path)
    if not text.strip():
        return {"error": "No extractable text found in PDF (it may be scanned/image-based)."}
    return {
        "name": extract_name(text),
        "email": extract_email(text),
        "phone": extract_phone(text),
        "skills": extract_skills(text),
        "education": extract_education(text),
        "work_experience": extract_work_experience(text),
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: parse_resume.py <path-to-pdf>"}))
        sys.exit(1)
    pdf_path = sys.argv[1]
    try:
        result = parse_resume(pdf_path)
    except FileNotFoundError:
        print(json.dumps({"error": f"File not found: {pdf_path}"}))
        sys.exit(1)
    except Exception as exc:
        print(json.dumps({"error": f"Failed to parse PDF: {exc}"}))
        sys.exit(1)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
