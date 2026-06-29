# Task List: Refactoring, UI/UX Modernization & New Features

## 1. Backend & AI Enhancements
- [x] Add `paraphrase` and `contextual_translation` question types in `backend/quiz.js`
- [x] Create POST `/api/simplify` endpoint in `server.js` and Gemini helper `simplifyTermWithGemini` in `backend/gemini.js`

## 2. Refactoring Frontend
- [x] Create `public/js/state-manager.js` to manage state and local storage persistence
- [x] Create `public/js/quiz-engine.js` to manage active quiz state, timer, scoring
- [x] Split `public/js/ui-manager.js` into modular components to fix code bloat:
  - [x] `public/js/ui-explorer.js` (Explorer tree, Breadcrumbs, Wordlist, Drag & Drop)
  - [x] `public/js/ui-flashcards.js` (Flashcard rendering, SRS ratings, Leech warnings)
  - [x] `public/js/ui-search.js` (Sidebar & Dashboard global searches)
  - [x] `public/js/ui-insights.js` (Dashboard overall progress, Folder Stats, Hard Words list)
- [x] Turn `public/js/ui-manager.js` into a clean coordinator orchestrating the modular components

## 3. UI/UX Upgrades & Features
- [x] Responsive layout with Tailwind CSS CDN
- [x] Interactive Spaced Repetition (SRS) Rating Buttons: Again, Good, Easy (visible after flip)
- [x] Leech Detection system: triggers after 5 quiz/flashcard mistakes, colors card red, pulses fire badge
- [x] Get AI Help: sends leech words to Gemini to generate simplified definitions, contextual examples, and Arabic mnemonics
- [x] Dashboard upgrades:
  - [x] Global Search inside dashboard to jump to any word's lesson
  - [x] Folder Statistics showing separate completion percentages for each language & unit
  - [x] Leech Words list to manage, reset, or simplify hard words directly
- [x] Drag & Drop reorganization: drag lessons and drop them on unit chips to relocate them instantly
- [x] Anki CSV Export for cards
- [x] Fix quiz question progress bug (reset answered status in advanceQuestion)

## 4. Verification
- [x] Run backend tests (`npm test`)
- [x] Verify frontend responsiveness and visual correctness in browser
