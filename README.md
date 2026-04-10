# ViperLens - AI-Driven Malware Analysis Lab

**ViperLens** is a hybrid malware analysis platform that fuses static byte-code heuristics with dynamic sandbox detonation, interpreted by Gemini 1.5 Flash Reasoning.

It is designed for modern SOC workflows where analysts need both **machine-speed detection** and **human-readable reasoning**.

## Core Capabilities

| Capability | Description |
|---|---|
| **Static Analysis Engine** | Custom Python-based PE analyzer with entropy profiling, IAT extraction, section analysis, regex IOC scanning, feature vector construction, and normalized scoring. |
| **Dynamic Detonation** | Deep integration with Joe Sandbox Cloud for behavioral execution, enrichment, and normalized security-adapter output. |
| **AI Reasoning** | Comparative intelligence via Gemini 1.5 Flash to explain **why** a file is malicious using static + dynamic evidence. |
| **Security Ops UI** | Professional dark-mode dashboard with session auth, full profile/history CRUD, persistence, and tier-based Free/Premium access control. |
| **Incident Reporting** | Automated PDF incident reports for technical and executive-aligned communication. |

## Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | Node.js, Express |
| **Database** | SQLite, Sequelize ORM |
| **Analysis** | Python 3.x, `pefile`, `numpy`, `matplotlib` |
| **AI** | Google Generative AI SDK (Gemini 1.5 Flash) |
| **Frontend** | EJS templates, Tailwind CSS, Chart.js |

## Architecture

ViperLens follows a 3-layer intelligence pipeline:

1. **Local Static Heuristics (Instant)**  
   Uploaded PE files are parsed locally for entropy anomalies, suspicious API imports, and byte-pattern indicators.

2. **Remote Sandbox Detonation (Behavioral)**  
   Premium pipeline submits samples to Joe Sandbox and polls for runtime behavior (network/process/filesystem impact).

3. **AI Synthesis (Contextual Explanation)**  
   Gemini compares static and dynamic signals to generate analyst-ready reasoning and prioritized response guidance.

## Getting Started

### 1) Install Node.js dependencies

```bash
npm install
```

### 2) Install Python dependencies

```bash
pip install -r requirements.txt
```

> If you prefer, `requirements-python.txt` is also available in this repository.

### 3) Configure environment variables

Create your runtime config from `.env.example`:

```bash
cp .env.example .env
```

Then set required keys in `.env` (for example: `SESSION_SECRET`, `GEMINI_API_KEY`, Joe Sandbox credentials when available).

### 4) Run the platform

```bash
npm start
```

Server default: `http://localhost:3000`

## Project Status

⚠️ **Note on API Access:** Dynamic analysis is powered by Joe Sandbox. Account approval is currently in progress. Static analysis and AI-driven UI modules are fully functional.

## Screenshots

> Replace these placeholders with actual images from your deployment.

### Dashboard

![Dashboard Placeholder](./docs/screenshots/dashboard-placeholder.png)

### Analysis Result

![Analysis Result Placeholder](./docs/screenshots/analysis-result-placeholder.png)

### PDF Report

![PDF Report Placeholder](./docs/screenshots/pdf-report-placeholder.png)

## Security Notes

- Session-based authentication with bcrypt password hashing.
- Premium controls enforced both in UI and backend middleware.
- Per-user scan history isolation with secure ownership checks.
- Normalized sandbox adapter keeps threat-critical indicators while controlling payload size for fast AI reasoning.
