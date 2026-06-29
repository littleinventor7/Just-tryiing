# Smart Flashcards & Quiz Generator

A local full-stack study app that extracts English vocabulary from TXT, PDF, DOCX, or pasted text, then generates flashcards, spaced-review metadata, and varied quiz questions.

## Run

```powershell
npm.cmd start
```

Open `http://localhost:5173`.

## Test

```powershell
npm.cmd test
```

## Architecture

- `server.js` serves the frontend and exposes JSON APIs.
- `backend/nlp.js` extracts vocabulary with frequency scoring, duplicate removal, difficulty classification, part-of-speech heuristics, context examples, and fallback definitions.
- `backend/quiz.js` generates 1-2 varied questions per word across fill-in-the-blank, definition, synonym, antonym, completion, context, matching, correction, and real-life usage styles.
- `public/js/fileReaders.js` extracts text and DOCX table rows in the browser from TXT, standard DOCX, and selectable-text PDF files.
- `public/js/tableTerms.js` converts table rows into flashcard terms, preserving the left cell as the card front and English/Arabic explanation cells on the back.
- `public/js/app.js` manages the manual vocabulary table, flashcards, quiz state, local progress, dark mode, text-to-speech, export, and spaced repetition.

PDF support reads selectable embedded text. Scanned image PDFs use Tesseract-OCR for local text extraction.

## Prerequisites (OCR for Scanned PDFs)

To process scanned image PDFs locally, you need to install Tesseract-OCR.

### Quick Setup (Windows)
Run the automated setup script in PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

This script will automatically install Scoop, 7-Zip, Tesseract-OCR, and download the English and Arabic language datasets.

