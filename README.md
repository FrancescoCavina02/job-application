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

**4. Embed your CV source**

The application uses an embedded canonical LaTeX CV source within `src/services/llmProvider.ts` to ensure layout consistency. The legacy `./CVs` directory and parsing of PDF/DOCX files are no longer used for active generation.

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

The tool operates in two main modes (Job Posting application and Spontaneous Company Interest application) and offers both fully automatic LLM generation and manual copy-paste prompt generation.

### Job Posting Mode (Specific Role)
1. Open the app at `http://localhost:3000`
2. Paste a job posting URL into the input field
3. Select an action:
   - **Generate application materials**: Fetches/crawls the job page, extracts description/metadata, constructs the LLM prompt, calls the LLM to write a tailored LaTeX CV and a matching LaTeX motivation letter, and writes them to the output directory.
   - **Create prompt**: Fetches/crawls the job page, parses content, and outputs the complete system + user prompt to a text file in `output/prompts/`. You can copy-paste this prompt into ChatGPT 5.6 Sol (or other web interfaces) for manual generation.

### Company Interest Mode (Spontaneous Working Student)
1. Open the app at `http://localhost:3000`
2. Paste the company's main website URL
3. Select an action:
   - **Generate application materials**: Crawls multiple company pages to identify the domain/business case and extract contact emails, builds the spontaneous interest prompt, runs the LLM, and writes a tailored LaTeX CV and matching interest letter to the output directory.
   - **Create prompt**: Crawls the company site, identifies contact emails, structures the spontaneous application instructions, and saves the complete prompt to `output/prompts/` for manual copy-pasting.

---

## Output files

Generated files are saved to the directory configured by `OUTPUT_DIR` (defaults to the current working directory):

- **LaTeX Outputs** (saved as `.md` files containing raw, compilable LaTeX):
  ```
  CV_[Company_Name].md
  Motivation-letter_[Company_Name].md
  ```
- **Copy-Pasteable Prompts**:
  Saved to the `prompts` subfolder within the output directory (e.g. `output/prompts/`):
  ```
  output/prompts/[Company_Name]_prompt_[Timestamp].txt
  ```

If an output file already exists, a timestamp is appended to prevent overwriting.

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
| `OUTPUT_DIR` | `.` | Where to save generated files and prompts |
| `CV_DIR` | `./CVs` | (Legacy/Deprecated) CV directory path |
| `CANDIDATE_WEBSITE` | `https://francesco-cavina.netlify.app/` | Your website, included in the LLM prompt |
| `PORT` | `3000` | Local server port |
| `PROMPT_AUTOMATION_ENABLED` | `true` | Set to `false` to skip the ChatGPT browser handoff after prompt creation |
| `CHATGPT_URL` | `https://chatgpt.com/` | ChatGPT URL opened by prompt browser automation |
| `CHATGPT_MODEL_NAME` | `GPT 5.6 SOL high` | Visible ChatGPT model label selected by prompt browser automation |


### Prompt post-processing and ChatGPT handoff

When you click **Create prompt**, the server now post-processes the generated prompt before saving it:

1. It performs a quick web lookup for the parsed company name and adds the most general official homepage beside the `Company:` value, for example `Company Name — https://company.com`. If no reliable homepage is found, the company line is left unchanged and a warning is returned.
2. It copies the final prompt to the macOS clipboard with `pbcopy`.
3. If enabled, it opens `chatgpt.com` in a normal Playwright-controlled Chromium window, attempts to enable ChatGPT temporary chat mode, selects `GPT 5.6 SOL high`, and pastes the prompt into the message box without sending it.

Configure the handoff with these environment variables:

| Variable | Default | Description |
|---|---|---|
| `PROMPT_AUTOMATION_ENABLED` | `true` | Set to `false` to skip the browser handoff. The prompt homepage lookup and clipboard copy still run. |
| `CHATGPT_URL` | `https://chatgpt.com/` | ChatGPT URL to open. |
| `CHATGPT_MODEL_NAME` | `GPT 5.6 SOL high` | Visible model-picker label to select. |

Setup notes:

- Clipboard copying requires macOS and the system `pbcopy` command. On non-macOS systems the prompt is still saved, returned by the API, and printed to the server console with a clear manual-copy message.
- Browser handoff uses Playwright Chromium. Install it with:

  ```bash
  npx playwright install chromium
  ```

- Run the app from a graphical macOS session, not a headless SSH session. You may need to grant Terminal, iTerm, VS Code, or your Node runtime macOS Accessibility/Automation permissions in **System Settings → Privacy & Security**.
- Log in to ChatGPT in the opened Playwright browser profile if prompted. ChatGPT UI labels can change; if automation cannot find the temporary-chat toggle, model picker, or message box, it fails safely after the prompt is already copied or printed.

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
      cvLoader.ts         (Legacy/Unused) Parse CV files
      llmProvider.ts      LLM provider abstraction (contains embedded LaTeX source CV)
      outputWriter.ts     Save output files
    db/database.ts        SQLite persistence
    utils/
      logger.ts           Console logger
      sanitize.ts         Filename sanitization
  public/
    index.html            Frontend UI
    style.css
    app.js
  output/                 Output files directory
    prompts/              Generated prompt text files saved here
  CVs/                    (Legacy) CV files directory
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
