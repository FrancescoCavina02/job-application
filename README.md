# Job Application Automator

A local web tool that generates tailored CVs and motivation letters from a job posting URL.

Paste a URL, click Generate, and the system fetches the job posting, parses its content, reads your CV source files, sends everything to an LLM, and saves two output files to disk.

---

## Requirements

- Node.js 18 or later
- An OpenAI or Anthropic API key

---

## Setup

**1. Clone or open the repository**

```bash
cd /path/to/job-application
```

**2. Install dependencies**

```bash
npm install
```

**3. Create your environment file**

```bash
cp .env.example .env
```

Edit `.env` and fill in your API key and preferred settings:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-4o
```

**4. Add your CV files**

Place your existing CV files inside the `CVs/` folder:

```
CVs/
  Francesco_Cavina_CV.pdf
  Francesco_Cavina_CV.docx
```

Supported formats: **PDF**, **DOCX**, **TXT**, **Markdown**.

---

## Running the app

```bash
npm start
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

For development with auto-restart on file changes:

```bash
npm run dev
```

---

## Usage

1. Open the app at `http://localhost:3000`
2. Paste a job posting URL into the input field
3. Click **Generate application materials**
4. The system will:
   - Fetch the job posting page
   - Extract and parse the main content
   - Read your CV files from `./CVs`
   - Send everything to the configured LLM
   - Save two output files to the output directory
5. The generated files will be shown in the results panel

---

## Output files

Files are saved to the directory configured by `OUTPUT_DIR` (defaults to the current working directory):

```
CV_[Company_Name].md
Motivation-letter_[Company_Name].md
```

If a file with that name already exists, a timestamp is appended to avoid overwriting.

---

## Configuration

All settings are controlled via environment variables (see `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `LLM_PROVIDER` | `openai` | `openai` or `anthropic` |
| `OPENAI_API_KEY` | — | Your OpenAI API key |
| `ANTHROPIC_API_KEY` | — | Your Anthropic API key |
| `LLM_MODEL` | `gpt-4o` | Model name (e.g. `gpt-4o`, `o3`, `claude-opus-4-5`) |
| `LLM_REASONING_EFFORT` | `medium` | For OpenAI o-series models: `low`, `medium`, `high` |
| `OUTPUT_DIR` | `.` | Where to save generated files |
| `CV_DIR` | `./CVs` | Where to read CV source files from |
| `CANDIDATE_WEBSITE` | `https://francesco-cavina.netlify.app/` | Your website, included in the LLM prompt |
| `PORT` | `3000` | Local server port |

### Switching providers

**OpenAI:**
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-4o
```

**Anthropic:**
```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
LLM_MODEL=claude-opus-4-5
```

---

## Playwright fallback (JS-rendered pages)

If a job posting page requires JavaScript to render (e.g. some ATS platforms), the system automatically falls back to Playwright headless Chromium.

To enable this, install the Playwright browser:

```bash
npx playwright install chromium
```

This step is optional — the app works fine without it for most sites.

---

## Project structure

```
job-application/
  src/
    index.ts              Entry point
    config.ts             Environment config
    server.ts             Express server
    routes/api.ts         API endpoints
    services/
      jobFetcher.ts       Fetch job posting HTML
      jobParser.ts        Extract and parse content
      cvLoader.ts         Parse CV files
      llmProvider.ts      LLM provider abstraction
      outputWriter.ts     Save output files
    db/database.ts        SQLite persistence
    utils/
      logger.ts           Console logger
      sanitize.ts         Filename sanitization
  public/
    index.html            Frontend UI
    style.css
    app.js
  CVs/                    Place your CV files here
  data/                   SQLite database (auto-created)
  .env.example            Config template
```

---

## Type checking

```bash
npm run typecheck
```

---

## History

The app stores every generation run in a local SQLite database at `data/applications.db`. Past runs appear in the sidebar of the UI.
