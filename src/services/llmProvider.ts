import type { Config } from '../config.js';
import type { ParsedJob, ParsedCompany } from './jobParser.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

export interface LLMProvider {
  generate(systemPrompt: string, userPrompt: string): Promise<string>;
  providerName: string;
  modelName: string;
}

// ---------------------------------------------------------------------------
// OpenAI provider
// ---------------------------------------------------------------------------

class OpenAIProvider implements LLMProvider {
  readonly providerName = 'openai';
  readonly modelName: string;
  private readonly reasoningEffort: string;
  private readonly apiKey: string;

  constructor(apiKey: string, model: string, reasoningEffort: string) {
    this.apiKey = apiKey;
    this.modelName = model;
    this.reasoningEffort = reasoningEffort;
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<string> {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: this.apiKey });

    const useReasoning = this.reasoningEffort && this.reasoningEffort !== 'none';

    logger.info('Calling OpenAI', {
      model: this.modelName,
      reasoningEffort: useReasoning ? this.reasoningEffort : 'off',
    });

    const params: Record<string, unknown> = {
      model: this.modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: false,
    };

    if (useReasoning) {
      params['reasoning_effort'] = this.reasoningEffort;
    } else {
      params['temperature'] = 0.7;
    }

    const response = await client.chat.completions.create(
      params as unknown as Parameters<typeof client.chat.completions.create>[0]
    );

    if ('choices' in response) {
      return response.choices[0]?.message?.content ?? '';
    }
    return '';
  }
}

// ---------------------------------------------------------------------------
// Anthropic provider
// ---------------------------------------------------------------------------

class AnthropicProvider implements LLMProvider {
  readonly providerName = 'anthropic';
  readonly modelName: string;
  private readonly apiKey: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.modelName = model;
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<string> {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: this.apiKey });

    logger.info('Calling Anthropic', { model: this.modelName });

    const response = await client.messages.create({
      model: this.modelName,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const block = response.content[0];
    if (block?.type === 'text') return block.text;
    return '';
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createProvider(config: Config): LLMProvider {
  if (config.llmProvider === 'openai') {
    if (!config.openaiApiKey) throw new Error('OPENAI_API_KEY is not set in environment.');
    return new OpenAIProvider(config.openaiApiKey, config.llmModel, config.llmReasoningEffort);
  }
  if (config.llmProvider === 'anthropic') {
    if (!config.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY is not set in environment.');
    return new AnthropicProvider(config.anthropicApiKey, config.llmModel);
  }
  throw new Error(`Unknown LLM_PROVIDER: "${config.llmProvider}"`);
}

// ---------------------------------------------------------------------------
// Candidate CV — single authoritative LaTeX source
// ---------------------------------------------------------------------------
// This is the complete Overleaf LaTeX document that defines the canonical CV.
// It is embedded directly so GPT receives perfect, unambiguous source material
// instead of PDF-extracted text (which degrades ligatures and loses formatting).
// Education, Projects, and Podcasts sections are fixed and must not be changed.
// The intro paragraph, Technical and Analytical Skills categories/bullets, and
// job experience bullets may all be refactored as described in the task instructions.

const CANDIDATE_CV_LATEX = `%-------------------------
% Francesco Cavina CV in a Cindy Peng-inspired layout
% Paste directly into Overleaf and compile with pdfLaTeX
%-------------------------

\\documentclass[letterpaper,10pt]{article}

\\usepackage{setspace}
\\setstretch{1.04}
\\usepackage[T1]{fontenc}
\\usepackage[english]{babel}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fontawesome5}
\\usepackage{tabularx}
\\usepackage{microtype}
\\usepackage[normalem]{ulem}
\\usepackage{xcolor}
\\usepackage[
  letterpaper,
  top=0.62in,
  bottom=0.62in,
  left=0.68in,
  right=0.68in
]{geometry}

\\setlength{\\parindent}{0pt}
\\setlength{\\tabcolsep}{0pt}
\\raggedright
\\raggedbottom
\\urlstyle{same}

\\titleformat{\\section}
  {\\large\\scshape\\raggedright}
  {}{0em}{}
  [\\vspace{-1pt}\\titlerule]

\\titlespacing*{\\section}{0pt}{11pt}{6pt}

\\setlist[itemize]{
  leftmargin=0.20in,
  label=\\textbullet,
  itemsep=1.5pt,
  topsep=2.5pt,
  parsep=0pt,
  partopsep=0pt
}

\\newcommand{\\resumelink}[2]{%
  \\href{#1}{\\uline{#2}}%
}

\\newcommand{\\resumeSubheading}[4]{%
  \\vspace{3pt}
  \\begin{tabular*}{\\textwidth}{@{}l@{\\extracolsep{\\fill}}r@{}}
    \\textbf{#1} & #2 \\\\
    \\textit{#3} & \\textit{#4}
  \\end{tabular*}
  \\vspace{-1pt}
}

\\newcommand{\\resumeProjectHeading}[2]{%
  \\vspace{1pt}
  \\begin{tabular*}{\\textwidth}{@{}l@{\\extracolsep{\\fill}}r@{}}
    #1 & #2
  \\end{tabular*}
  \\vspace{-2pt}
}

\\newcommand{\\resumeEducationListStart}{%
  \\vspace{-3pt}
  \\begin{itemize}[
    leftmargin=0.20in,
    topsep=0pt,
    itemsep=1.5pt,
    parsep=0pt,
    partopsep=0pt
  ]
}

\\newcommand{\\resumeEducationListEnd}{%
  \\end{itemize}
  \\vspace{4pt}
}

\\newcommand{\\resumeProjectItemListStart}{%
  \\vspace{-2pt}
  \\begin{itemize}[
    leftmargin=0.20in,
    topsep=0pt,
    itemsep=1.5pt,
    parsep=0pt,
    partopsep=0pt
  ]
}

\\newcommand{\\resumeProjectItemListEnd}{%
  \\end{itemize}
  \\vspace{6pt}
}

\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{4pt}}

\\begin{document}

%----------HEADER----------
\\begin{center}
  {\\fontsize{25}{28}\\selectfont\\bfseries Francesco Cavina}\\\\[5pt]

  \\small
  \\faEnvelope\\
  \\resumelink
    {mailto:f.cavi2002@gmail.com}
    {f.cavi2002@gmail.com}
  \\hspace{5pt}$|$\\hspace{5pt}
  \\faLinkedin\\
  \\resumelink
    {https://www.linkedin.com/in/francesco-cavina-8a7440145}
    {LinkedIn}
  \\hspace{5pt}$|$\\hspace{5pt}
  \\faGlobe\\
  \\resumelink
    {https://francesco-cavina.netlify.app/}
    {Website}
  \\hspace{5pt}$|$\\hspace{5pt}
  \\faMapMarker*\\
  Amsterdam, Netherlands
\\end{center}

\\vspace{4pt}

{\\small\\centering
Data and AI engineer with a BSc in Econometrics and Data Science from VU Amsterdam and incoming MSc studies at VU Amsterdam. Experience building production data pipelines, governed AI ready interfaces, evaluation workflows and full stack tools. Relevant for research driven teams that need reliable data foundations, careful model testing and practical software around machine learning systems. Interested in applied AI products where models, internal tooling and end user needs have to work together.\\par
}

\\vspace{4pt}

%----------TECHNICAL AND ANALYTICAL SKILLS----------
\\section{Technical and Analytical Skills}

{\\small
\\begin{itemize}[leftmargin=0.16in]
  \\item
  \\textbf{Programming:}
  Python, SQL, TypeScript, JavaScript

  \\item
  \\textbf{AI and data workflows:}
  PySpark, LLM workflows, RAG, ChromaDB, metadata driven ingestion, schema inference, data quality workflows

  \\item
  \\textbf{Backend and product:}
  FastAPI, REST APIs, Next.js, React, Tailwind CSS, self service tools, user focused prototypes

  \\item
  \\textbf{Infrastructure:}
  Docker, Kubernetes, Terraform, Azure, Databricks, Airflow, Git, SQLAlchemy

  \\item
  \\textbf{Quantitative work:}
  econometrics, probability, statistics, forecasting, model evaluation, walk forward validation, optimization
\\end{itemize}
}

%----------RELEVANT EXPERIENCE----------
\\section{Relevant Experience}

\\resumeSubheading
  {Robodata}
  {September 2025 - June 2026}
  {Data \\& AI Platform Engineer}
  {Amsterdam, Netherlands}

\\resumeItemListStart
  \\item
  Built privacy aware data platform components that combined metadata driven ingestion, schema inference and PII classification for enterprise AI use.

  \\item
  Developed Python, PySpark and SQL pipelines using Bronze, Silver and Gold architecture so datasets could be reused more consistently across downstream workflows.

  \\item
  Built local LLM workflows for data discovery, field classification and metadata generation.

  \\item
  Created AI ready data interfaces and self service tooling that made governed datasets easier for non specialist users to query and understand.

  \\item
  Documented platform components, workflow logic and design choices to support adoption, handover and future development.

  \\item
  Used Docker, Kubernetes, Terraform, Azure, Databricks, Airflow and SQLAlchemy in production work.
\\resumeItemListEnd

\\resumeSubheading
  {QuantFi}
  {October 2022 - May 2023}
  {Operational Trader}
  {Amsterdam, Netherlands}

\\resumeItemListStart
  \\item
  Developed and tested Python based forecasting strategies using Random Forest, XGBoost, neural networks and walk forward validation.

  \\item
  Built data ingestion, retraining and daily forecast workflows in Python and SQL to support recurring operational decisions.

  \\item
  Created dashboards comparing model signals, realized performance and forecast quality.

  \\item
  Evaluated outputs with attention to overfitting, changing conditions, assumptions and practical usability.

  \\item
  Worked in a setting where clarity, timely decisions and reproducible workflows mattered daily.
\\resumeItemListEnd

\\resumeSubheading
  {Vrije Universiteit Amsterdam}
  {June 2022 - November 2024}
  {Student Assistant - Teaching Assistant}
  {Amsterdam, Netherlands}

\\resumeItemListStart
  \\item
  Taught weekly Probability Theory tutorials to first year Econometrics students.

  \\item
  Explained abstract mathematical ideas through assumptions, reasoning steps and practical examples rather than memorized procedures.

  \\item
  Built a student portfolio system for first year students with practical tools and information regarding logistics and practical details about university matters.

  \\item
  Created a refresher math course on Sowiso platform for incoming student in order to brush their general math skills.

  \\item
  Represented the programme during Open Days and communicated technical content clearly to prospective students.
\\resumeItemListEnd

%----------EDUCATION----------
\\newpage
\\section{Education}

\\resumeSubheading
  {Vrije Universiteit Amsterdam}
  {2026-2029}
  {MSc in Econometrics and Operations Research}
  {Amsterdam, Netherlands}

\\resumeEducationListStart
  \\item
  Track Business Engineering and Data Driven Decision Making
\\resumeEducationListEnd

\\resumeSubheading
  {Vrije Universiteit Amsterdam}
  {2026-2029}
  {MSc in Business Analytics}
  {Amsterdam, Netherlands}

\\resumeEducationListStart
  \\item
  Track Computational Intelligence
\\resumeEducationListEnd

\\resumeSubheading
  {Vrije Universiteit Amsterdam}
  {2021-2024}
  {BSc in Econometrics and Data Science}
  {Amsterdam, Netherlands}

\\resumeEducationListStart
  \\item
  7.8/10

  \\item
  Thesis:
  \\textit{Nonstandard Probabilities in an Internal Probability Space},
  grade 8.5/10

  \\item
  Core courses: Data Structures and Algorithms, Database Fundamentals and Applications, Advanced Simulation for Finance, Economics and Business, Numerical Methods, Econometrics III, Data Science Methods.
\\resumeEducationListEnd

\\resumeSubheading
  {University of Leeds}
  {2024}
  {Minor in Pure Mathematics}
  {Leeds, England}

\\resumeEducationListStart
  \\item
  8.5/10

  \\item
  Courses: Calculus in the Complex Plane, Metric and Function Spaces, Groups and Vector Spaces, Geometry of Curves and Surfaces.
\\resumeEducationListEnd

%----------PROJECTS----------
\\section{Projects}

\\resumeProjectHeading
  {
    \\textbf{
      1)
      \\resumelink
        {https://francesco-cavina.netlify.app/}
        {AI Powered Personal Website}
    }
    $|$
    \\resumelink
      {https://github.com/FrancescoCavina02/My-Website}
      {https://github.com/FrancescoCavina02/My-Website}
  }
  {November 2025 - present}

\\resumeProjectItemListStart
  \\item
  Next.js, TypeScript, FastAPI, Python, Tailwind CSS

  \\item
  Built a full stack portfolio with a FastAPI backend that parses an Obsidian vault into structured API endpoints for notes, quotes and chat functionality. Designed it as a self service knowledge interface, combining content modelling, backend automation, frontend usability and LLM based interaction.
\\resumeProjectItemListEnd

\\resumeProjectHeading
  {
    \\textbf{
      2)
      \\resumelink
        {https://spiritualchatbot1.netlify.app/}
        {RAG Knowledge Chatbot}
    }
    $|$
    \\resumelink
      {https://github.com/FrancescoCavina02/Spiritual-chatbot}
      {https://github.com/FrancescoCavina02/Spiritual-chatbot}
  }
  {November 2025 - present}

\\resumeProjectItemListStart
  \\item
  Python, FastAPI, ChromaDB, sentence transformers, LLM APIs

  \\item
  Built a retrieval augmented chatbot using semantic chunking, vector search, structured prompts and citation based responses. Focused on reliable retrieval, traceable answers, hallucination reduction and reusable workflow design.
\\resumeProjectItemListEnd

\\resumeProjectHeading
  {
    \\textbf{
      3)
      \\resumelink
        {https://dodgeballclubamsterdam.com}
        {Dodgeball Club Amsterdam}
    }
    $|$
    \\resumelink
      {https://github.com/FrancescoCavina02/DCA-website}
      {https://github.com/FrancescoCavina02/DCA-website}
  }
  {June 2025 - present}

\\resumeProjectItemListStart
  \\item
  Built and maintain a public website using HTML, CSS and JavaScript. Focused on clear navigation, simple content management and practical usability for club members.
\\resumeProjectItemListEnd

%----------PODCASTS----------
\\section{Podcasts}

\\vspace{3pt}

{\\small
\\textbf{
  \\resumelink
    {https://www.youtube.com/playlist?list=PLZrhMJ5eusE8uuobIez54pc5Gb7BdwBB6}
    {Math and Beyond}
}
--- Created and hosted an interview podcast exploring mathematics, physics, cosmology, and computer science through conversations on scientific ideas and research.

\\vspace{5pt}

\\textbf{
  \\resumelink
    {https://www.youtube.com/playlist?list=PLZrhMJ5eusE_ACw6Ec3TqCbvDVZ6HP809}
    {Back to the Stone Age}
}
--- Created and hosted a multidisciplinary interview podcast covering mathematics, physics, cosmology, psychology, and philosophy, with a focus on foundational questions and connections across fields.
}

\\end{document}`;

// ---------------------------------------------------------------------------
// Inspiration palette — compiled from all past tailored CVs
// ---------------------------------------------------------------------------
// This is a curated reference distilled from every version of the candidate's CV
// produced for different employers (Fastned, Gaide, IMC Trading, NIBC, STX,
// THEC, VU, Van Lanschot Kempen, and the general baseline).
// GPT may draw on any entry here as inspiration when tailoring the LaTeX CV
// above. These are NOT additional facts to add wholesale — they are alternative
// phrasings, angles, and category arrangements that GPT may use when a different
// framing would serve a specific target better.

const CV_INSPIRATION_PALETTE = `=== CANDIDATE CV INSPIRATION PALETTE ===

The following is a curated reference of alternative phrasings, skill categories,
bullet point angles, and intro paragraph styles drawn from the candidate's full
history of tailored CVs. This palette exists so GPT knows the full range of
framings available for the canonical LaTeX CV above. Use it as creative guidance,
not as a source of additional facts.

--- 1. INTRO PARAGRAPH STYLES ---

(A) Quantitative / trading focus:
"Quantitative data and AI engineer with a BSc in Econometrics and Data Science
from Vrije Universiteit Amsterdam and MSc studies in Econometrics and Operations
Research and Business Analytics. Experience in operational trading, Python and SQL
workflows, forecasting pipelines, dashboards, model evaluation, data visualisation
and AI ready data interfaces. Strong fit for [role] work that combines market
interest, quantitative analysis, data tooling and practical decision support."

(B) AI agent / automation focus:
"Data and AI engineer with a BSc in Econometrics and Data Science from VU Amsterdam
and incoming MSc studies. Experience building LLM workflows, RAG prototypes,
governed data interfaces, Python data pipelines, APIs and full stack tools. Strong
fit for student AI agent engineering work that turns practical workflow problems into
agents, integrations, automations and usable internal tools."

(C) EdTech / communication focus:
"Data and AI engineer with a BSc in Econometrics and Data Science from VU Amsterdam
and incoming MSc studies. Experience building privacy aware AI workflows, RAG systems,
governed data interfaces, automated data pipelines, and full stack prototypes. Former
VU teaching assistant with experience explaining abstract concepts clearly to first
year students. Strong fit for educational technology work that combines practical AI
development, clear communication, responsible GenAI use, and support for online and
blended education."

(D) Finance operations / decision support focus:
"Quantitative data and AI engineer with a BSc in Econometrics and Data Science from
Vrije Universiteit Amsterdam and incoming MSc studies. Experience in operational
trading, Python and SQL workflows, automated data pipelines, dashboards, model
evaluation and self service data tools. Strong fit for finance operations work that
combines accurate data handling, cross team information flows, process improvement
and practical analysis in a trading environment."

(E) General product / platform focus (baseline):
"Data and AI engineer with a BSc in Econometrics and Data Science from VU Amsterdam
and incoming MSc studies at VU Amsterdam. Experience building production data
pipelines, governed AI ready interfaces, evaluation workflows and full stack tools.
Relevant for research driven teams that need reliable data foundations, careful model
testing and practical software around machine learning systems."

(F) Process automation / internal tooling focus:
"Data and AI engineer with a BSc in Econometrics and Data Science from VU Amsterdam
and incoming MSc studies. Experience building privacy aware AI workflows, governed
data interfaces, automated pipelines and full stack prototypes. Strong interest in
agentic automation, internal process improvement and practical AI tools that help
teams reduce repetitive work and make better operational decisions."

(G) Business case / network analysis focus:
"Quantitative student with a BSc in Econometrics and Data Science from Vrije
Universiteit Amsterdam and incoming MSc studies. Experience building forecasting
workflows, data pipelines, dashboards, model evaluation processes and self service
data tools. Strong fit for business case and network analysis work that requires
structured assumptions, clear models, and practical decision support."

--- 2. TECHNICAL SKILLS — ALTERNATIVE CATEGORIES AND BULLETS ---

The baseline CV uses five skill categories. Below are alternative category names and
bullets that have appeared across tailored versions. GPT may rename, merge, split,
add or remove categories as needed, provided the total number of skill lines stays
within the layout budget.

(A) "AI and LLM Engineering" (used for AI-heavy roles):
LLM workflows, RAG, vector search, ChromaDB, OpenAI API, Hugging Face, sentence
transformers, prompt design, structured prompts, local LLM workflows, citation based
responses, hallucination-aware evaluation, AI-assisted data discovery, structured outputs

(B) "AI and GenAI" (used for EdTech/GenAI roles):
LLM workflows, RAG, vector search, ChromaDB, OpenAI API, Hugging Face, sentence
transformers, prompt design, citation based answers, local LLM workflows

(C) "AI and Automation" (used for automation/process roles):
LLM workflows, RAG, agentic workflows, OpenAI API, Hugging Face, ChromaDB, prompt
design, AI assisted data discovery, process automation concepts, Power Automate basics,
Copilot Studio interest, workflow design

(D) "Programming and data" (combined variant):
Python, SQL, PySpark, data ingestion, automated workflows, schema inference, data quality
workflows, TypeScript, JavaScript

(E) "Data Engineering" (infrastructure-heavy variant):
Python, SQL, PySpark, Databricks, Airflow, metadata driven ingestion, schema inference,
data quality workflows

(F) "Backend and APIs" (product-heavy variant):
Python, FastAPI, SQL, REST APIs, SQLAlchemy, data pipelines, metadata-driven ingestion,
schema inference, data quality workflows

(G) "Backend and product" (baseline):
FastAPI, REST APIs, Next.js, React, Tailwind CSS, self service tools, user focused prototypes

(H) "Frontend and Product" (full-stack variant):
TypeScript, JavaScript, Next.js, React, Tailwind CSS, HTML, CSS, UI components, user
focused prototypes, self service tools

(I) "Web and product" (EdTech/product variant):
FastAPI, Next.js, React, REST APIs, Tailwind CSS, user focused prototypes, documentation,
self service tools

(J) "Low Code and Product Thinking" (automation/ops variant):
Power Automate basics, Copilot Studio interest, workflow design, documentation, user
focused prototypes, internal tooling

(K) "Data and trading tools" (trading-specific variant):
data ingestion, dashboards, performance visualisation, automated retraining workflows,
REST APIs

(L) "Machine learning" (explicit ML category):
Random Forest, XGBoost, neural networks, scikit learn, PySpark

(M) "Quantitative work" (explicit quant category):
econometrics, probability, statistics, forecasting, model evaluation, walk forward
validation, optimisation, machine learning with scikit learn, Random Forest, XGBoost,
neural networks

(N) "Quantitative analysis" (lighter quant variant):
econometrics, probability, statistics, optimisation, forecasting, model evaluation,
walk forward validation

(O) "Decision support" (finance/ops variant):
dashboards, performance visualisation, model signal comparison, assumption testing,
self service tools

(P) "Finance and operations support" (finance variant):
trading workflows, recurring forecasts, dashboarding, performance visualisation,
assumption testing, documentation

(Q) "Data visualisation and decision support":
dashboards, performance visualisation, model signal comparison, assumption testing,
self service tools, translating model output into practical recommendations

(R) "Communication" (used when teaching/explanation is central):
documentation, technical explanation, user focused prototypes, translating model
output into practical recommendations, teaching support, tutorial delivery, slide
structure, technical explanation, podcast production, interview preparation,
audio editing, research communication

(S) "Educational and media work" (EdTech variant):
teaching support, tutorial delivery, slide structure, technical explanation, podcast
production, interview preparation, audio editing, research communication

(T) "Product and communication" (hybrid variant):
self service tooling, documentation, user focused prototypes, technical explanation

(U) "Engineering tools" / "Infrastructure" / "Cloud and infrastructure":
Git, Docker, Kubernetes, Terraform, Azure, Databricks, Airflow, SQLAlchemy,
CI/CD concepts

(V) "Relevant Interests" (used in short general CVs):
data driven products, dashboarding, UX/UI, Gen AI tools, operational modelling

(W) "Relevant Strengths" (used as final category when framing soft skills as skills):
practical AI implementation not just experimentation, translating unclear workflows into
technical prototypes, building governed data access for LLM based tools, explaining
technical concepts clearly to non specialist users, comfortable working across data,
backend, automation and user interface layers

--- 3. JOB EXPERIENCE — ALTERNATIVE BULLET ANGLES ---

ROBODATA — additional and alternative bullet angles (all factually supported):
- Built privacy aware AI and data platform components for enterprise clients, including
  metadata driven ingestion, schema inference and PII classification workflows.
- Developed automated data pipelines in Python, PySpark and SQL using Bronze, Silver
  and Gold architecture.
- Built local LLM workflows for data discovery, field classification and metadata
  generation, with attention to governed use of enterprise data.
- Created AI ready data interfaces that allowed internal datasets to be queried more
  safely and consistently by LLM based tools and agents.
- Worked on self service data tooling so non specialist users could understand, operate
  and reuse technical data infrastructure.
- Documented platform components, workflows and design choices to support handover,
  adoption and future development.
- Worked on data structures and interfaces that made internal datasets easier to query,
  understand and reuse.
- Helped transform raw enterprise datasets into structured, AI-usable knowledge assets.
- Built local LLM workflows for data discovery, field classification and metadata
  generation, helping transform raw enterprise datasets into structured, AI-usable
  knowledge assets.
- Created AI-ready data interfaces that allowed governed datasets to be queried safely
  and consistently by LLM-based tools and agents.
- Worked on self-service data tooling so non-specialist users could understand, operate
  and reuse technical data infrastructure without depending on engineers for every workflow.
- Used Docker, Kubernetes, Terraform, Azure, Databricks, Airflow and SQLAlchemy across
  production platform work.

QUANTFI — additional and alternative bullet angles (all factually supported):
- Developed and tested Python based trading strategies using Random Forest, XGBoost,
  neural networks and walk forward validation.
- Developed and tested ML based trading strategies in Python using Random Forest,
  XGBoost, neural networks and walk forward validation.
- Built data ingestion, retraining and daily forecast workflows in Python and SQL to
  support recurring trading decisions.
- Built Python and SQL workflows for data ingestion, retraining and daily forecasts
  used in recurring trading decisions.
- Created dashboards and visualisations to compare model signals, realised performance
  and forecast quality.
- Created performance dashboards and visualisations to evaluate model output and
  support daily decisions.
- Evaluated model output with attention to overfitting, changing market conditions,
  assumptions and practical usability.
- Evaluated outputs for overfitting, changing market conditions and practical trading
  use, in a setting where speed and disciplined decisions mattered.
- Worked in an environment where speed, clarity and disciplined decision making mattered daily.
- Worked in an environment where clarity, disciplined analysis and timely decision making
  mattered daily.
- Worked in a setting where clarity, timely decisions and reproducible workflows mattered daily.

VU TEACHING ASSISTANT — additional and alternative bullet angles (all factually supported):
- Taught weekly Probability Theory tutorials to first year Econometrics students.
- Explained abstract mathematical concepts in a clear and practical way, with focus on
  reasoning rather than memorising procedures.
- Helped students understand the assumptions behind probability exercises and build
  confidence with formal problem solving.
- Helped students move from memorising procedures to understanding assumptions, reasoning
  steps and problem-solving strategies.
- Explained probability, mathematical reasoning and problem solving techniques in a clear
  practical way.
- Helped students move from memorising methods to understanding the assumptions behind a solution.
- Taught weekly Probability Theory tutorials to first-year Econometrics students,
  translating abstract mathematical concepts into clear, structured explanations.
- Built a student portfolio system for first year students and represented the programme
  during Open Days.
- Built a student portfolio system with practical tools and information for first year
  students and represented the EOR programme during Open Days.
- Represented the programme during Open Days, explaining the curriculum and student
  experience to prospective students.
- Teaching Assistant - Student Assistant - Student Ambassador (title variant for roles
  that value community/ambassador work).
- Created a refresher math course on Sowiso platform for incoming students to brush their
  general math skills.

--- 4. "RELEVANT STRENGTHS" / "RELEVANT FIT" BULLETS ---
(These have appeared as a final section in some CVs. GPT may add such a section if it
clearly serves the application and fits within the layout budget, but it is not required.)

- Building practical AI tools rather than only experimenting with models.
- Translating unclear workflows into usable technical prototypes.
- Explaining technical and mathematical concepts to students and non specialist users.
- Working across backend, data, AI, automation, and user interface layers.
- Thinking critically about privacy, data access, citations, and responsible GenAI use.
- Improving educational material by making structure, pacing, and explanation clearer.
- Practical AI implementation, not just experimentation.
- Building governed data access for LLM based tools.
- Strong overlap with RAG, AI-ready data interfaces, backend APIs, full-stack prototypes.
- Educational experience as a Probability Theory teaching assistant.
- Comfortable working across AI engineering, software development, documentation and
  user-facing tooling.
- Practical experience building LLM and data platform components, not only experimenting with AI tools.
- Comfortable working across AI engineering, backend APIs, data workflows, lightweight
  frontend work and documentation.
- Experience translating unclear workflows into usable prototypes and self service tools.
- Strong quantitative foundation for evaluating models, assumptions and practical output quality.
- Able to explain technical ideas clearly to students and non specialist users.

=== END OF INSPIRATION PALETTE ===`;

// ---------------------------------------------------------------------------
// Shared prompt blocks
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an elite career strategist, CV editor, and application writer. Your job is to create application materials that are specific, credible, and effective.

Prioritize accuracy over sounding impressive. Do not invent experience, employers, credentials, dates, projects, degrees, publications, tools, or achievements. If the available source material does not support a claim, do not include it.

You can however sugarcoat, embellish and dress up the results, skills, experiences mentioned, in order for them to sound better, more relevant and more impactful for the job post. 

Use the candidate's existing CV and website as the source of truth. You may reorganize, rewrite, compress, expand, and emphasize content, but you must not fabricate facts.

Write in a natural, human, conversational style. Avoid common AI sounding language, corporate filler, and melodramatic phrasing. Do not use words or phrases such as delve, tapestry, testament, robust, navigate, foster, landscape, symphony, cutting edge, passionate about, thrilled to apply, uniquely positioned, dynamic, leverage, or fast paced environment unless they appear in the job post and are genuinely necessary.

Use varied sentence lengths and sentence structures. Avoid perfectly balanced, predictable pacing. Favor active voice, concrete detail, and direct language.

Do not flatter the company. Do not overstate enthusiasm. Do not apologize. Do not include generic claims that could apply to any applicant.

Do not use the character "-" in the motivation letter prose. Avoid em dashes, en dashes, and hyphen based separators in the letter body. This restriction applies to prose text only and does not restrict LaTeX command syntax in the CV or letter document.

Confidence and factuality:
1. Use only facts supported by the CV, website, or job post.
2. If something is unclear, prioritize the job description and the target label in order to make the best reasonable inference. This does not mean lying. It means making the best possible guess based on the available information.
3. Do not mention uncertainty inside the final motivation letter unless absolutely necessary.
4. Do not include citations in the final CV or motivation letter.
5. Before finalizing, check that the output contains no invented claims.`;

function experienceTailoringBlock(targetLabel: string): string {
  return `Experience tailoring (required):

Before writing the CV, identify:
1. What the ${targetLabel} cares about most.
2. The single strongest alignment between that and the candidate's background — the primary lens (for example: data infrastructure, LLM workflows, evaluation rigour, market data operations, teaching and communication).

For each role in RELEVANT EXPERIENCE, apply that lens: foreground the bullets that best match the target's explicit priorities, reframe or drop bullets that are accurate but weakly relevant.
The facts must stay the same, however you can sugarcoat, embellish and dress up the results, skills, experiences mentioned, in order for them to sound better, more relevant and more impactful for the job post.  The emphasis, vocabulary, and ordering may change.

Reframing rules:
1. Do not copy achievement lines verbatim from source CVs if a different accurate framing from the Inspiration Palette fits this target better.
2. For each role, at least one bullet must be materially reframed — different phrasing or emphasis — not just copied verbatim.
3. Across roles, highlight a different contribution type per role where possible. Avoid repeating the same generic framing across all three entries.
4. Map at least 2 bullets across RELEVANT EXPERIENCE to concrete priorities stated in the ${targetLabel}, using only supported facts.
5. Remove bullets that are accurate but genuinely irrelevant. Do not pad with filler.
6. Never exaggeratedly invent tools, outcomes, responsibilities, or scope. However, you can sugarcoat, embellish and dress up the tools, outcomes, responsibilities, or scope mentioned, in order for them to sound better, more relevant and more impactful for the job post.  The emphasis, vocabulary, and ordering may change.

Content budget (strict):
The canonical LaTeX CV contains these bullet counts per role:
- Robodata: up to 6 bullets
- QuantFi: up to 5 bullets
- VU Teaching Assistant: up to 5 bullets
You may use fewer bullets per role if some are genuinely irrelevant. You must not add bullets beyond what appears in the LaTeX source or the Inspiration Palette.
Reframing a bullet (different phrasing, same fact) does not count as adding a new bullet and is actively encouraged.

Drawing from the Inspiration Palette:
The Inspiration Palette contains alternative bullet phrasings drawn from real past experience. Use any phrasing from the palette as a drop-in replacement when it fits this target better than the canonical wording.

Anti-sameness check:
Before finalizing, verify that the RELEVANT EXPERIENCE section could not be sent unchanged to a very different company. If the bullets would read identically for a generic AI or data company, rewrite with more specific angles.`;
}

function letterExperienceTailoringBlock(targetLabel: string): string {
  return `Experience narrative tailoring (required):

Before writing the letter, choose:
1. The single most important priority of the ${targetLabel} for this application.
2. The 1 to 2 experiences or projects that most directly support that priority.

In the letter:
- Lead with the most relevant experience, not necessarily the most recent one.
- For each experience mentioned, reframe it through this target's lens: connect it to a concrete company need, domain problem, or explicit role requirement from the ${targetLabel}.
- Do not merely list or copy-paste CV bullet points into paragraph form. A letter is not a prose CV. Synthesize the experience into a cohesive narrative. Provide context around *how* or *why* you solved a problem to demonstrate domain understanding, rather than just reciting a list of tools or tasks.
- Include only the parts of each experience that matter for this target. Omit accurate but weakly relevant details.
- Do not mention a side project unless it is clearly central to this target's priorities.
- Never exaggeratedly invent tools, outcomes, responsibilities, or scope. However, you can sugarcoat, embellish and dress up the tools, outcomes, responsibilities, or scope mentioned, in order for them to sound better, more relevant and more impactful for the job post.
- The experience paragraphs must not read as interchangeable with a letter for a very different company. If they could be sent elsewhere with only the opening changed, rewrite them.`;
}

const LETTER_VOICE_CHECK_BLOCK = `Voice check (required for the letter):
Tailoring must not make the letter sound templated, corporate, or AI generated.
Keep the prose direct, varied, and conversational while applying the tailoring rules above.
Use varied sentence lengths. Favor active voice, concrete detail, and plain language.
Do not use common AI sounding words or phrases such as delve, tapestry, testament, robust, navigate, foster, landscape, symphony, cutting edge, passionate about, thrilled to apply, uniquely positioned, dynamic, leverage, or fast paced environment unless they appear in the job post and are genuinely necessary.
Do not flatter the company. Do not overstate enthusiasm. Do not apologize.`;

const CONTACT_EMAIL_SELECTION_BLOCK = `Contact email selection (required in generation report):

The generation report must include CONTACT EMAIL with the single best address to send this spontaneous application to.

Selection priority:
1. First choice: clear hiring or general contact addresses from the extracted list, such as hr@, jobs@, careers@, recruiting@, talent@, people@, info@, or hello@.
2. If no clear HR, recruiting, or careers email exists, choose the best personal email of a senior person found on the company website who could reasonably influence hiring or be the right first contact for a working student application. Look in the extracted website content for leadership or technical leaders such as CTO, CEO, co-founder, founding engineer, VP Engineering, head of data, engineering director, or similar.
3. Prefer someone whose role is related to the company's technical work or the area the candidate would likely join.
4. Do not invent email addresses. Use only addresses present in the extracted contact email list or explicitly found in the website content.
5. Avoid generic support emails, sales emails, press emails, privacy emails, or unrelated department addresses when a better hiring related contact is available.
6. If no suitable address can be found, return CONTACT EMAIL: none found.`;

function cvContentBudgetBlock(relevanceLabel: string): string {
  return `Content length guidance (important — calibration targets, not hard limits):

The CV is set with 0.68 in margins on letterpaper. The three variable sections — intro paragraph, TECHNICAL AND ANALYTICAL SKILLS, and RELEVANT EXPERIENCE — must fill the first page without overflow or excessive whitespace. Use these approximate targets to calibrate content:

Intro paragraph:
- Target: approximately 490 to 510 characters, or roughly 70 to 75 words.
- Write two to three concise sentences. Do not write a wall of text or a single short line.

TECHNICAL AND ANALYTICAL SKILLS:
- Target: approximately 500 characters, or roughly 60 words across all skill category \\\\item lines.
- Each \\\\item should be one compact category line. Aim for 4 to 6 \\\\item categories total.
- Keep each line tight: \\\\textbf{Category name:} followed by a comma-separated list of terms.

RELEVANT EXPERIENCE bullet points:
- Target: approximately 1880 characters, or roughly 250 words across all three roles combined.
- This amounts to roughly 15 to 17 \\\\item bullets across all three roles. Distribute them based on relevance to this ${relevanceLabel} target.
- A role more central to this ${relevanceLabel} target may receive more bullets; a weaker fit may receive fewer.
- Each \\\\item should be one clear, specific sentence. Avoid run-on bullets.

These are calibration guides. The goal is a well-balanced, filled first page without overflow. If you are significantly above or below a target, adjust content by adding the most relevant missing detail or removing the weakest bullets.`;
}

// ---------------------------------------------------------------------------
// Prompt builder — Job Posting mode
// ---------------------------------------------------------------------------

export interface PromptData {
  jobUrl: string;
  parsedJob: ParsedJob;
  candidateWebsite: string;
}

export function buildPrompt(data: PromptData): { systemPrompt: string; userPrompt: string } {
  const { parsedJob, jobUrl, candidateWebsite } = data;
  const company = parsedJob.structured.company ?? 'Unknown Company';
  const role = parsedJob.structured.title ?? 'Unknown Role';

  const userPrompt = `Candidate website:
${candidateWebsite}

Company:
${company}

Role:
${role}

Job posting URL:
${jobUrl}

Relevant extracted job posting content:
${parsedJob.rawText}

Candidate CV — authoritative LaTeX source:
${CANDIDATE_CV_LATEX}

${CV_INSPIRATION_PALETTE}

Your tasks:

Task 1: Create the motivation letter.

Write a tailored motivation letter for this specific role and company.

Requirements:
1. Natural, conversational tone.
2. Specific to the company, role, and job post.
3. Based on the candidate's real experience.
4. No generic filler.
5. No exaggerated enthusiasm.
6. No unsupported claims.
7. No dash characters.
8. Suitable to send directly.
9. Strong opening that gets to the point.
10. Clear explanation of why the candidate fits the role.
11. Clear explanation of what the candidate would contribute.
12. Polished but not stiff.

Masters studies mention (required in every motivation letter):
The candidate will start in September 2026 two MSc programmes at Vrije Universiteit Amsterdam: Econometrics and Operations Research, and Business Analytics. You must include this fact exactly once in the letter.
Place it strategically, not as a random aside. Choose the moment where it best supports the letter's argument:
- When connecting quantitative, analytical, or data driven skills to the role, if the masters strengthen that link.
- When discussing availability, timeline, or part time engagement.
- When establishing the candidate's academic context before discussing fit.
Do not drop it in the closing as filler. Integrate it into a sentence that advances why the candidate fits the role or what they would contribute. One concise mention is enough.

${letterExperienceTailoringBlock('job posting, company, and role')}

${LETTER_VOICE_CHECK_BLOCK}

Task 2: Create the tailored CV.

Reformat and rewrite the CV to improve fit for this job.

Important: The source CV is provided as a complete LaTeX document. Your output for the CV must also be a valid LaTeX document using the same document class, packages, and custom commands defined in the source. Do not switch to a different format. Preserve the visual identity. The LaTeX structure — including \\item bullets, itemize environments, \\resumeItemListStart, \\resumeItemListEnd, and all custom commands — must be preserved exactly as defined in the preamble.

Allowed modifications to the LaTeX CV:
- Rewrite the intro paragraph (the \\\\centering paragraph after the header).
- Rename, reorder, add, or remove skill categories in the TECHNICAL AND ANALYTICAL SKILLS section.
- Change the skill terms within each \\\\item category line.
- Rewrite, reorder, or remove \\\\item bullets in the RELEVANT EXPERIENCE section, using the Inspiration Palette as a source of alternative phrasings.
- Reorder the roles in RELEVANT EXPERIENCE if a different order serves this target better.

Fixed sections (do not modify):
- Header (name, contact details, location).
- EDUCATION section (all entries, dates, grades, course lists).
- PROJECTS section (all three projects, all bullets, all links).
- PODCASTS section (both podcasts, all text).
- All LaTeX preamble code, custom commands, and formatting directives.

${experienceTailoringBlock('job posting or company domain')}

${cvContentBudgetBlock('job-relevant')}

Return exactly two final artifacts:

ARTIFACT 1: TAILORED CV

Provide the full tailored CV as a complete, compilable LaTeX document. Output the raw LaTeX code, no commentary before or after.

ARTIFACT 2: MOTIVATION LETTER

Provide the motivation letter as a complete, compilable LaTeX document. Use the same font stack, margins, and visual identity as the CV. Structure the letter document as follows:
- Same preamble packages as the CV (setspace, fontenc, babel, hyperref, fontawesome5, microtype, ulem, xcolor, geometry with identical margins).
- A header matching the CV header style: candidate name centred at the top in the same large bold font, followed by the same contact line (email, LinkedIn, Website, location).
- A thin horizontal rule below the header (\\\\vspace{6pt}{\\\\color{gray}\\\\hrule}\\\\vspace{16pt}) to mirror the CV section rule style.
- The date and company address block in small plain text, left aligned.
- The letter body as normal paragraphs with \\\\setlength{\\\\parskip}{8pt} and \\\\setlength{\\\\parindent}{0pt}.
- A closing block: one line for the sign-off phrase, a \\\\vspace{20pt}, and \\\\textbf{Francesco Cavina} for the name.
- Do not add a handwritten-signature placeholder, scanned image, or decorative element.
- Output the raw LaTeX code, no commentary before or after.

Also return a short internal generation report after the two artifacts with:
1. Company name used for the filename.
2. Role title detected.
3. Any warnings about missing information.
4. A checklist confirming that no unsupported claims were added.
5. For each role in RELEVANT EXPERIENCE, the tailoring angle used for this target.
6. Achievement lines that were reframed rather than copied verbatim from source CV.
7. The 1 to 2 experiences or projects foregrounded in the motivation letter and why.
8. The narrative angle used for each experience paragraph in the motivation letter.`;

  return { systemPrompt: SYSTEM_PROMPT, userPrompt };
}

// ---------------------------------------------------------------------------
// Interest prompt builder — Working Student Interest mode
// ---------------------------------------------------------------------------

export interface InterestPromptData {
  companyUrl: string;
  parsedCompany: ParsedCompany;
  candidateWebsite: string;
}

export function buildInterestPrompt(data: InterestPromptData): { systemPrompt: string; userPrompt: string } {
  const { parsedCompany, companyUrl, candidateWebsite } = data;
  const company = parsedCompany.structured.company ?? 'Unknown Company';
  const emailList = parsedCompany.structured.emails.length > 0
    ? parsedCompany.structured.emails.join('\n')
    : 'None found on this page.';

  const userPrompt = `Candidate website:
${candidateWebsite}

Company:
${company}

Company website URL:
${companyUrl}

Extracted contact email addresses found on the company website:
${emailList}

Extracted company website content:
${parsedCompany.rawText}

Candidate CV — authoritative LaTeX source:
${CANDIDATE_CV_LATEX}

${CV_INSPIRATION_PALETTE}

Context:
There is no specific job posting. The candidate wants to send a spontaneous working student application (16-24 hours per week) to this company. Your job is to understand what this company does, identify how the candidate's background is relevant, and produce compelling application materials tailored to the company's domain and work.

Your tasks:

Task 1: Create the interest letter.

Write a genuine, spontaneous interest letter expressing the candidate's interest in a working student position (16-24h/week) at this company.

Requirements:
1. Natural, conversational tone.
2. Specific to this company and its domain — show that you understand what they do.
3. Do not reference a specific open role or invent a job title. The candidate is expressing general interest in contributing as a working student.
4. Frame the request clearly around a working student engagement of 16-24 hours per week.
5. Based on the candidate's real experience from the CV materials.
6. Identify which skills and experiences from the candidate's background are most relevant to this company's work and highlight them.
7. No generic filler.
8. No exaggerated enthusiasm.
9. No unsupported claims.
10. No dash characters.
11. Suitable to send directly as an email body.
12. Strong opening that gets to the point.
13. Clear explanation of why the candidate would be a relevant fit for this company specifically.
14. Clear explanation of what the candidate could contribute.
15. Polished but not stiff.
16. Do not over-commit to a specific role that may not exist or may not be relevant — keep the role framing general but the company connection specific.

Working student engagement mention (required in every interest letter):
The candidate is applying for a working student position of 16 to 24 hours per week. You must state this clearly and concretely exactly once in the letter. Do not leave it implied.
Place it strategically, not as a random aside. Choose the moment where it best serves the letter:
- In the opening, when framing what kind of engagement the candidate is seeking before discussing fit with the company.
- When transitioning from motivation to contribution, if clarifying how the candidate would join the team in practice.
- Alongside studies, timeline, or availability, especially when combined with the September 2026 MSc start.
Do not bury it only in the closing or mention it without context. Integrate it into a sentence that makes the application request concrete. One clear mention is enough.

Masters studies mention (required in every interest letter):
The candidate will start in September 2026 two MSc programmes at Vrije Universiteit Amsterdam: Econometrics and Operations Research, and Business Analytics. You must include this fact exactly once in the letter.
Place it strategically, not as a random aside. For working student applications, strong placements include:
- Early, when framing the 16 to 24 hours per week request alongside current studies and upcoming MSc work.
- When connecting quantitative, analytical, or data driven skills to the company's domain, if the masters strengthen that link.
- When explaining timeline or availability, if the September 2026 start clarifies how the candidate can combine study and work.
Do not drop it in the closing as filler. Integrate it into a sentence that advances why the candidate fits the company or what they could contribute. One concise mention is enough.

${letterExperienceTailoringBlock('company and its domain')}

${LETTER_VOICE_CHECK_BLOCK}

Task 2: Create the tailored CV.

Reformat and rewrite the CV to improve fit for this company and its domain.

Important: The source CV is provided as a complete LaTeX document. Your output for the CV must also be a valid LaTeX document using the same document class, packages, and custom commands defined in the source. Do not switch to a different format. Preserve the visual identity. The LaTeX structure — including \\item bullets, itemize environments, \\resumeItemListStart, \\resumeItemListEnd, and all custom commands — must be preserved exactly as defined in the preamble.

Allowed modifications to the LaTeX CV:
- Rewrite the intro paragraph (the \\\\centering paragraph after the header).
- Rename, reorder, add, or remove skill categories in the TECHNICAL AND ANALYTICAL SKILLS section.
- Change the skill terms within each \\\\item category line.
- Rewrite, reorder, or remove \\\\item bullets in the RELEVANT EXPERIENCE section, using the Inspiration Palette as a source of alternative phrasings.
- Reorder the roles in RELEVANT EXPERIENCE if a different order serves this target better.

Fixed sections (do not modify):
- Header (name, contact details, location).
- EDUCATION section (all entries, dates, grades, course lists).
- PROJECTS section (all three projects, all bullets, all links).
- PODCASTS section (both podcasts, all text).
- All LaTeX preamble code, custom commands, and formatting directives.

${experienceTailoringBlock('company domain')}

${cvContentBudgetBlock('company-relevant')}

${CONTACT_EMAIL_SELECTION_BLOCK}

Return exactly two final artifacts:

ARTIFACT 1: TAILORED CV

Provide the full tailored CV as a complete, compilable LaTeX document. Output the raw LaTeX code, no commentary before or after.

ARTIFACT 2: MOTIVATION LETTER

Provide the interest letter as a complete, compilable LaTeX document. Use the same font stack, margins, and visual identity as the CV. Structure the letter document as follows:
- Same preamble packages as the CV (setspace, fontenc, babel, hyperref, fontawesome5, microtype, ulem, xcolor, geometry with identical margins).
- A header matching the CV header style: candidate name centred at the top in the same large bold font, followed by the same contact line (email, LinkedIn, Website, location).
- A thin horizontal rule below the header (\\\\vspace{6pt}{\\\\color{gray}\\\\hrule}\\\\vspace{16pt}) to mirror the CV section rule style.
- The date and company address block in small plain text, left aligned.
- The letter body as normal paragraphs with \\\\setlength{\\\\parskip}{8pt} and \\\\setlength{\\\\parindent}{0pt}.
- A closing block: one line for the sign-off phrase, a \\\\vspace{20pt}, and \\\\textbf{Francesco Cavina} for the name.
- Do not add a handwritten-signature placeholder, scanned image, or decorative element.
- Output the raw LaTeX code, no commentary before or after.

Also return a short internal generation report after the two artifacts with:
1. Company name used for the filename.
2. Summary of what the company does, based on the website content.
3. Any warnings about missing information.
4. A checklist confirming that no unsupported claims were added.
5. CONTACT EMAIL: <the single best email address following the contact email selection rules above, or "none found" if none were available>.
6. For each role in RELEVANT EXPERIENCE, the tailoring angle used for this target.
7. Achievement lines that were reframed rather than copied verbatim from source CV.
8. The 1 to 2 experiences or projects foregrounded in the interest letter and why.
9. The narrative angle used for each experience paragraph in the interest letter.`;

  return { systemPrompt: SYSTEM_PROMPT, userPrompt };
}
