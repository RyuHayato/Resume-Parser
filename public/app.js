const fileInput = document.getElementById('fileInput');
const fileName = document.getElementById('fileName');
const dropZone = document.getElementById('dropZone');
const spinner = document.getElementById('spinner');
const errorMsg = document.getElementById('errorMsg');
const results = document.getElementById('results');

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('border-sky-500', 'bg-sky-50');
});
dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('border-sky-500', 'bg-sky-50');
});
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('border-sky-500', 'bg-sky-50');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

function setLoading(loading) {
  spinner.classList.toggle('hidden', !loading);
  spinner.classList.toggle('flex', loading);
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
}

function hideError() {
  errorMsg.classList.add('hidden');
}

async function handleFile(file) {
  hideError();
  results.classList.add('hidden');

  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    showError('Please upload a PDF file.');
    return;
  }

  fileName.textContent = file.name;
  setLoading(true);

  try {
    const formData = new FormData();
    formData.append('resume', file);

    const res = await fetch('/api/upload', { method: 'POST', body: formData });

    // Read raw text first; only parse as JSON when the body is actually JSON
    const rawText = await res.text();
    let data = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      // Server did not return JSON (e.g. stale/crashed server, proxy response)
      throw new Error(
        `Server returned HTTP ${res.status} with a non-JSON body: ${rawText.slice(0, 200) || '(empty response)'}`
      );
    }

    if (!res.ok || (data && data.error)) {
      throw new Error(
        (data && data.error) ||
          `Upload failed with HTTP ${res.status}: ${rawText.slice(0, 200) || '(empty response)'}`
      );
    }
    renderResults(data);
  } catch (err) {
    showError(String(err && err.message ? err.message : err));
  } finally {
    setLoading(false);
  }
}

function renderResults(data) {
  document.getElementById('rName').textContent = data.name || '—';
  document.getElementById('rEmail').textContent = data.email || '—';
  document.getElementById('rPhone').textContent = data.phone || '—';

  const skillsEl = document.getElementById('rSkills');
  skillsEl.innerHTML = '';
  (data.skills || []).forEach((skill) => {
    const tag = document.createElement('span');
    tag.className = 'bg-sky-100 text-sky-800 text-sm font-medium px-3 py-1 rounded-full';
    tag.textContent = skill;
    skillsEl.appendChild(tag);
  });
  if (!(data.skills || []).length) {
    skillsEl.textContent = 'No skills found.';
  }

  document.getElementById('rEducation').textContent =
    typeof data.education === 'string' ? data.education : (data.education || '—');

  const workEl = document.getElementById('rWork');
  workEl.innerHTML = '';
  const jobs = Array.isArray(data.work_experience)
    ? data.work_experience
    : data.work_experience
    ? [data.work_experience]
    : [];
  jobs.forEach((job) => {
    const block = document.createElement('p');
    block.className = 'whitespace-pre-line border-l-4 border-sky-200 pl-3';
    block.textContent = job;
    workEl.appendChild(block);
  });
  if (!jobs.length) {
    workEl.textContent = 'No work experience found.';
  }

  results.classList.remove('hidden');
}
