# 📘 Smart Flashcards & Quiz Generator — Product Description

---

## 🧭 Product Overview

**Smart Flashcards & Quiz Generator** is a premium, AI-powered educational web application designed to transform any study material — PDFs, images, DOCX files, or pasted text — into interactive flashcards, AI-generated quizzes, and intelligent summaries. Built for students and self-learners, it combines the power of Google Gemini AI with a rich, modern interface to create a personalized and gamified learning experience.

> **One-liner:** Upload your notes → AI extracts everything → Study with flashcards, quizzes, and summaries — all in one place.

---

## ✨ Key Features

### 1. 🤖 AI-Powered Content Extraction & Generation
- **Direct AI File Processing**: Upload PDFs, images (PNG/JPEG), or DOCX files — the AI reads, extracts, and organizes *all* content (text, tables, formulas, vocabulary, grammar rules).
- **Smart Content Classification**: The AI automatically identifies and categorizes vocabulary, grammar rules, key concepts, and definitions.
- **Custom AI Instructions**: A dedicated textarea allows students to tell the AI exactly what to extract and how to process the material. These instructions take **absolute priority** over all default behaviors.
- **Persistent Extraction Cache**: Extracted content is saved per lesson, so re-generating study sets doesn't require re-uploading files.

### 2. 🎴 Interactive 3D Flashcards
- **3D Flip Animation**: Beautifully animated flashcard flipping with CSS 3D transforms.
- **Rich Card Content**:
  - English definition
  - Arabic translation (RTL support)
  - Part of speech
  - Contextual example sentence
  - Morpheme/root breakdown
  - Synonyms & antonyms chips
  - Mnemonic association (mental link)
  - Grammatical article (for German, French, etc.)
- **Card Controls**: Previous, Next, Shuffle, Speak Word (TTS), Delete, and Rate.
- **Leech Detection**: Cards repeatedly marked incorrect are flagged as "Leeches" with a dedicated AI Help button to simplify the term.

### 3. 📝 AI Quiz Generator
- **Exam-Style Mimicry**: Upload a past exam as a blueprint, and the AI generates new questions that clone its style, difficulty, phrasing, and distractor patterns.
- **Diverse Question Types**: Context, synonym, antonym, definition, grammar, collocation, inference, usage — based on the exam blueprint.
- **Per-Word Question Control**: Configure exactly how many questions to generate per vocabulary term (1–50).
- **Quiz Modes**: Standard quiz with progress bar, timer mode, and score tracking.
- **Instant Feedback**: Color-coded correct/incorrect indicators with explanations after each question.
- **PDF Export**: Export the full quiz as a formatted PDF document using html2pdf.js.

### 4. 📄 AI Study Material Summary
- **Markdown-Formatted Summaries**: The AI generates concise, well-organized summaries with headings, bullet points, and bold key terms.
- **Regenerate On Demand**: Re-generate the summary at any time with a single click.

### 5. 🧠 Spaced Repetition System (SRS)
A full Anki-like spaced repetition engine built into the flashcard system:
- **3-Button Rating**: Again (incorrect), Good (medium), Easy (learned) — each adjusting the card's review interval.
- **Ease Factor Algorithm**: Dynamic ease factor per card, with configurable:
  - Starting ease
  - Again penalty
  - Again interval (hours)
  - Good bonus
  - Easy bonus
  - Easy interval multiplier
- **Review Queue**: Cards are automatically scheduled based on their SRS status (New → Learning → Review → Mastered).
- **Leech Threshold**: Configurable number of mistakes before a card is flagged as a "leech" for special attention.

### 6. 🎮 Gamification & Achievements
- **XP System**: Earn XP for studying, completing quizzes, and daily activity.
- **Level Progression**: Level up as you accumulate XP, with a visual progress bar.
- **Daily Streak Tracker**: 🔥 Consecutive study day counter with streak-break warnings.
- **Achievement Badges**:
  - 🌅 **Early Bird** — Studied before 8:00 AM
  - 📚 **Vocabulary Master** — Learned 100+ words
  - *(More badges unlockable)*
- **Confetti Celebrations**: Visual confetti animation on milestones (using canvas-confetti).

### 7. 📂 Content Explorer & Folder Organization
- **Hierarchical Folder Structure**: Organize content into Languages → Units → Lessons.
- **Breadcrumb Navigation**: Visual path indicators (e.g., English > Unit 1 > Lesson A).
- **Global Search**: Search vocabulary across all folders instantly.
- **Mixed Study Mode**: Select multiple lessons and study combined flashcards or take a mixed quiz.
- **CRUD Operations**: Add, rename, delete, and move languages, units, and lessons.

### 8. 💬 AI Lesson Assistant (Chat)
- **Contextual AI Chat Sidebar**: A sliding panel where students can ask the AI about vocabulary meanings, request simpler explanations, or get extra examples.
- **Conversation History**: Chat messages are saved per lesson for continuity.
- **Bilingual Support**: The AI responds in Arabic and English as needed.

### 9. 📊 Insights & Analytics
- **Study statistics dashboard** with vocabulary counts, mastery percentages, and difficulty distribution.
- **Quiz performance history** tracking scores over time.

### 10. 🔧 Flexible Settings & Configuration
- **Engine Mode**: Switch between AI Engine (Gemini-powered) and Local Engine (offline NLP).
- **Custom API Provider**: Configure custom API base URL and model (e.g., OpenAI, Anthropic, or any OpenAI-compatible endpoint).
- **Daily Study Goal**: Set a personal target for daily word mastery.
- **Dark Mode**: Full dark/light theme toggle with system preference detection.

---

## 📚 Supported Subjects & Focus Types

| Subject | Focus Options |
|---------|--------------|
| **English** | Vocabulary · Grammar · Mixed |
| **German** | Vocabulary (with articles der/die/das) · Grammar (cases) · Mixed |
| **French** | Vocabulary (with gender) · Grammar (conjugation) · Mixed |
| **Chemistry** | Concepts · Equations & Formulas · Mixed |
| **Physics** | Concepts · Laws & Problems · Mixed |
| **Biology** | Definitions · Processes · Mixed |
| **Math** | Concepts · Equations & Problems · Mixed |
| **Mechanics** | Concepts · Laws & Problems · Mixed |

Each subject triggers specialized AI behavior tailored to its domain, with auto-detection of the study material's language and subject.

---

## 📁 Supported File Formats

| Format | Method |
|--------|--------|
| **PDF** | Direct AI vision extraction (OCR-capable) |
| **Images** (PNG, JPEG) | Direct AI vision extraction |
| **DOCX** | Local XML parsing + AI enhancement |
| **Plain Text** | Direct paste into textarea |

---

## 🏗️ Technical Architecture

```
┌─────────────────────────────────────────────┐
│                  Frontend                    │
│  HTML + Tailwind CSS + Vanilla JavaScript   │
│  ┌──────────┬──────────┬──────────────────┐ │
│  │index.html│ui-manager│     api.js       │ │
│  │          │state-mgr │                  │ │
│  └──────────┴──────────┴──────────────────┘ │
└──────────────────┬──────────────────────────┘
                   │ REST API (JSON)
┌──────────────────┴──────────────────────────┐
│                  Backend                     │
│           Node.js (Pure HTTP)               │
│  ┌──────────┬──────────┬──────────────────┐ │
│  │ server.js│gemini.js │    quiz.js       │ │
│  │          │ nlp.js   │  examStyle.js    │ │
│  │          │lexicon.js│    auth.js       │ │
│  └──────────┴──────────┴──────────────────┘ │
└──────────────────┬──────────────────────────┘
                   │
       ┌───────────┴───────────┐
       │   External Services   │
       │  - HackClub AI API    │
       │  - Google Gemini API  │
       │  - Custom AI Provider │
       └───────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | HTML5, Tailwind CSS (CDN), Vanilla JavaScript (ES Modules) |
| **Fonts** | Google Fonts — Inter (body), Outfit (headings) |
| **Backend** | Node.js 20+ (pure `http` module, zero frameworks) |
| **AI Engine** | Google Gemini via HackClub proxy (OpenAI-compatible API) |
| **PDF Export** | html2pdf.js |
| **Animations** | canvas-confetti, CSS 3D transforms |
| **Markdown** | marked.js |
| **State Management** | Custom localStorage-based state with pub/sub pattern |
| **Authentication** | Simple code-based auth (backend/auth.js) |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/process` | POST | Process text/file → extract terms + generate quiz |
| `/api/generate-ai` | POST | Generate AI quiz from manual terms |
| `/api/quiz` | POST | Regenerate quiz questions locally |
| `/api/extract-file` | POST | Extract text from PDF (local) |
| `/api/extract-file-content` | POST | Extract content via AI vision |
| `/api/detect-subject` | POST | Auto-detect study material subject |
| `/api/chat` | POST | AI lesson assistant chat |
| `/api/simplify` | POST | AI simplification for leech words |
| `/api/generate-summary` | POST | Generate AI study summary |
| `/api/log-error` | POST | Frontend error logging |

---

## 📤 Export Options

| Format | Description |
|--------|-------------|
| **JSON Export** | Full study set with terms, questions, and metadata |
| **Anki CSV** | Compatible CSV for importing into Anki desktop/mobile |
| **Quiz PDF** | Formatted printable quiz document |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** version 20 or higher
- **API Key** (optional): HackClub AI API key for AI-powered features

### Installation & Launch

```bash
# 1. Install dependencies (none required — zero dependencies!)
# 2. Start the server
npm start

# Server runs at http://localhost:5173
```

### First-Time Setup
1. Open **http://localhost:5173** in your browser
2. (Optional) Paste your **HackClub API key** in the Import panel to enable AI features
3. Upload a study file or paste text
4. Click **"Generate Study Set"**
5. Start studying with flashcards, quizzes, and summaries!

---

## 🎨 Design Philosophy

The application follows a **premium, modern design** aesthetic:
- **Glassmorphism** effects with `backdrop-blur` on header and modals
- **Gradient hero banners** with decorative floating shapes
- **Micro-animations** on hover, transitions, and card flips
- **Dark mode** with carefully tuned zinc palette
- **Responsive layout** adapting from mobile to desktop
- **RTL support** for Arabic text content
- **Pill-style navigation** tabs with smooth active state transitions

---

## 🔒 Privacy & Data

- **100% Local Storage**: All study data is stored in the browser's `localStorage`. No external database.
- **No Tracking**: Zero analytics, cookies, or third-party tracking.
- **API Keys**: Stored locally in the browser, never sent to any server except the configured AI provider.
- **Self-Hosted**: Runs entirely on your local machine — your data never leaves your computer (except AI API calls for content generation).

---

## 📋 Version

- **Current Version**: 1.0.0
- **License**: Private
- **Node.js Requirement**: >= 20

---

*Built with ❤️ for students who want to study smarter, not harder.*
