# Multilingual Embedded NLP Tutor - Setup & Usage Guide

This guide details instructions to install, configure, and operate the fully embedded, offline language learning tutor.

---

## 📋 Prerequisites

1. **Python 3.8 or higher** installed on the local system.
2. **pip** (Python package installer) configured.

---

## 🛠️ Step 1: Install Python Libraries

Install the required local processing libraries via terminal command line:

```bash
pip install nltk pyttsx3 argostranslate
```

### Library Descriptions:
- **`nltk`**: Local semantic dictionary lookup using WordNet and Open Multilingual WordNet.
- **`pyttsx3`**: Local offline speech synthesizer utilizing OS-native speech engines.
- **`argostranslate`**: Local offline Neural Machine Translation engine using OpenNMT.

---

## 💾 Step 2: Download NLTK Language Corpora

NLTK requires downloading the `wordnet` and `omw-1.4` packages for multilingual lookups. The script **downloads these programmatically** on its first startup.

If you wish to pre-download them manually offline:
1. Open a Python shell:
   ```bash
   python
   ```
2. Run the downloader:
   ```python
   import nltk
   nltk.download('wordnet')
   nltk.download('omw-1.4')
   exit()
   ```

---

## 🌍 Step 3: Install Argos Translate Language Packages

Argos Translate requires offline language packages (`.argosmodel`) to translate text. 

The script will **automatically attempt online package resolution and installation** if models are missing (requires internet once). 

To configure Argos Translate **entirely offline**:
1. Download model packages manually from the [Argos Translate Index](https://www.argosopentech.com/argostranslate/languages/):
   - **German to English:** `de_en.argosmodel` (and `en_de.argosmodel`)
   - **French to English:** `fr_en.argosmodel` (and `en_fr.argosmodel`)
   - **Arabic to English:** `ar_en.argosmodel` (and `en_ar.argosmodel`)
2. Install the downloaded files using the Argos Translate CLI:
   ```bash
   argos-translate-cli install-path /path/to/downloaded/model.argosmodel
   ```
3. Or install programmatically inside a Python shell:
   ```python
   import argostranslate.package
   argostranslate.package.install_from_path('/path/to/downloaded/model.argosmodel')
   ```

---

## 🚀 Step 4: Running the Tutor

Run the interactive CLI application:

```bash
python multilingual_embedded_nlp_tutor.py
```

### Menu Actions:
1. **Word Analysis & Semantic Lookup**: Look up definitions, parts of speech, synonyms, antonyms, and translated examples in any of the target languages.
2. **Offline Translation Engine**: Offline translation between any pair of supported languages (e.g. French -> Arabic, German -> English).
3. **Speak Words or Sentences**: Pronunciation tool.
4. **Generate Rule-Based Vocabulary Quizzes**: Starts an interactive rule-based test covering definitions (True/False), parts of speech, synonyms, or fill-in-the-blank contextual sentences.

---

## 🔧 Troubleshooting

### 🔊 Text-to-Speech Voice Issues
- **Windows:** Speech engines rely on **SAPI5**. Ensure French, German, or Arabic language pack speech voices are installed in Windows Settings (Settings -> Time & Language -> Speech -> Manage Voices).
- **Linux:** Install `espeak` and corresponding language packages:
  ```bash
  sudo apt-get install espeak espeak-ng-de espeak-ng-fr espeak-ng-ar
  ```
- **macOS:** Install voices in macOS System Preferences (Accessibility -> Spoken Content -> System Speech Voice).

### 🧩 WordNet Falls Back to English
- The local Open Multilingual WordNet index is smaller than the English index. If OMW doesn't find a direct match (e.g. for specific inflections or rare words), the tutor automatically translates the input word to English and fetches the matching semantic definition, ensuring you still get accurate definition breakdowns.
