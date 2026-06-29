#!/usr/bin/env python3
"""
Multilingual Embedded NLP Tutor
A fully embedded, offline, and multilingual language learning assistant.
Supports English, German, French, and Arabic.
Uses NLTK/WordNet, Argos Translate, and PyTTSx3.
"""

import sys
import os
import random
import json

# --- DEPENDENCY CHECK & GRACEFUL IMPORTS ---
MISSING_LIBS = []
try:
    import nltk
    from nltk.corpus import wordnet as wn
except ImportError:
    MISSING_LIBS.append("nltk")

try:
    import pyttsx3
except ImportError:
    MISSING_LIBS.append("pyttsx3")

try:
    import argostranslate.package
    import argostranslate.translate
except ImportError:
    MISSING_LIBS.append("argostranslate")

if MISSING_LIBS:
    print("Error: Missing required local libraries.")
    print("Please install them using the following command:")
    print(f"  pip install {' '.join(MISSING_LIBS)}")
    print("\nRefer to the setup_and_usage_guide.md for detailed instructions.")
    sys.exit(1)

# --- CONFIGURATION & MAPPINGS ---
LANGUAGES = {
    "english": {"nltk": "eng", "argos": "en", "pyttsx3": "en"},
    "german": {"nltk": "deu", "argos": "de", "pyttsx3": "de"},
    "french": {"nltk": "fra", "argos": "fr", "pyttsx3": "fr"},
    "arabic": {"nltk": "arb", "argos": "ar", "pyttsx3": "ar"}
}

POS_MAP = {
    'n': "Noun",
    'v': "Verb",
    'a': "Adjective",
    's': "Adjective Satellite",
    'r': "Adverb"
}

# --- INITIALIZE NLTK DATABASES ---
def init_nltk():
    try:
        # Test if wordnet and omw are loaded
        wn.synsets('dog')
    except LookupError:
        print("Initial setup: Downloading local NLTK wordnet database. This only happens once...")
        nltk.download('wordnet')
        nltk.download('omw-1.4')
        print("NLTK database ready.\n")

# --- OFFLINE TRANSLATION (Argos Translate) ---
def get_argos_translation(text, from_code, to_code):
    if from_code == to_code:
        return text

    # Check if packages are installed
    installed_langs = argostranslate.translate.get_installed_languages()
    from_lang = next((l for l in installed_langs if l.code == from_code), None)
    to_lang = next((l for l in installed_langs if l.code == to_code), None)

    if not from_lang or not to_lang:
        # Try to install programmatically from web index
        installed = setup_argos_package_programmatically(from_code, to_code)
        if not installed:
            return f"[Model {from_code}->{to_code} not installed offline. Please install it.]"
        # Reload installed list
        installed_langs = argostranslate.translate.get_installed_languages()
        from_lang = next((l for l in installed_langs if l.code == from_code), None)
        to_lang = next((l for l in installed_langs if l.code == to_code), None)

    try:
        # Argos Translate routes translations through English 'en' if direct link is missing
        translation = from_lang.get_translation(to_lang)
        return translation.translate(text)
    except Exception as e:
        return f"[Translation Error: {e}]"

def setup_argos_package_programmatically(from_code, to_code):
    print(f"Searching online index to download package: {from_code} -> {to_code}...")
    try:
        argostranslate.package.update_package_index()
        available_packages = argostranslate.package.get_available_packages()
        package = next((p for p in available_packages if p.from_code == from_code and p.to_code == to_code), None)
        if package:
            print(f"Downloading package: {package}...")
            downloaded_file = package.download()
            argostranslate.package.install_from_path(downloaded_file)
            print("Installed successfully.")
            return True
        else:
            # Try routing package via English if from/to aren't English
            if from_code != 'en' and to_code != 'en':
                print("Checking English routing packages...")
                p1 = next((p for p in available_packages if p.from_code == from_code and p.to_code == 'en'), None)
                p2 = next((p for p in available_packages if p.from_code == 'en' and p.to_code == to_code), None)
                if p1 and p2:
                    print(f"Installing intermediate path: {from_code}->en and en->{to_code}")
                    argostranslate.package.install_from_path(p1.download())
                    argostranslate.package.install_from_path(p2.download())
                    return True
            print("No matching translation path found in package index.")
            return False
    except Exception as e:
        print(f"Could not install package programmatically: {e}")
        return False

# --- SPEECH SYNTHESIS (PyTTSx3) ---
def speak_text(text, lang_code):
    try:
        engine = pyttsx3.init()
        voices = engine.getProperty('voices')
        matched_voice = None

        # Search OS voices matching language tags
        for voice in voices:
            voice_lang_str = str(voice.languages).lower()
            voice_name_lower = voice.name.lower()
            voice_id_lower = voice.id.lower()

            if lang_code == 'de' and ('de' in voice_lang_str or 'deutsch' in voice_name_lower or 'german' in voice_name_lower or 'deu' in voice_id_lower):
                matched_voice = voice.id
                break
            elif lang_code == 'fr' and ('fr' in voice_lang_str or 'french' in voice_name_lower or 'français' in voice_name_lower or 'fra' in voice_id_lower):
                matched_voice = voice.id
                break
            elif lang_code == 'ar' and ('ar' in voice_lang_str or 'arabic' in voice_name_lower or 'العربية' in voice_name_lower or 'ara' in voice_id_lower):
                matched_voice = voice.id
                break
            elif lang_code == 'en' and ('en' in voice_lang_str or 'english' in voice_name_lower or 'zira' in voice_name_lower or 'david' in voice_name_lower):
                matched_voice = voice.id
                # Keep checking for exact English accents, but hold this as fallback

        if matched_voice:
            engine.setProperty('voice', matched_voice)
        else:
            # Fallback prints a warning
            print(f" [TTS Warning: No matching voice engine found on this OS for language '{lang_code}'. Using default.]")
        
        # Adjust speaking rate slightly slower for learners
        engine.setProperty('rate', 150)
        engine.say(text)
        engine.runAndWait()
    except Exception as e:
        print(f" [TTS Error: Could not generate audio. Details: {e}]")

# --- NLTK WORD RESOLUTION ---
def lookup_word(word, lang_name):
    lang_cfg = LANGUAGES.get(lang_name.lower())
    if not lang_cfg:
        return None

    nltk_lang = lang_cfg["nltk"]
    synsets = wn.synsets(word, lang=nltk_lang)
    if not synsets:
        # Fallback: if OMW search misses (often happens with inflected forms or small indexes),
        # try translating the word to English first using Argos, then look it up in English WordNet
        argos_code = lang_cfg["argos"]
        if argos_code != "en":
            print(f" -> Word '{word}' not found directly in local {lang_name} WordNet index.")
            print(f" -> Performing offline fallback translation to English...")
            translated_word = get_argos_translation(word, argos_code, "en").strip()
            print(f" -> Looking up translated term: '{translated_word}'...")
            synsets = wn.synsets(translated_word, lang="eng")

    if not synsets:
        return None

    # Retrieve all synsets for comprehensive details
    word_details = []
    for index, syn in enumerate(synsets):
        definition_en = syn.definition()
        pos = POS_MAP.get(syn.pos(), syn.pos())
        
        # Get synonyms in target language
        synonyms = []
        for lemma in syn.lemmas(lang=nltk_lang):
            synonyms.append(lemma.name().replace('_', ' '))
        # Remove duplicate references of the input word itself
        synonyms = list(set([s for s in synonyms if s.lower() != word.lower()]))

        # Get antonyms in target language
        antonyms = []
        for lemma in syn.lemmas(lang=nltk_lang):
            for ant in lemma.antonyms():
                antonyms.append(ant.name().replace('_', ' '))
        antonyms = list(set(antonyms))

        # Get native examples. WordNet examples are mostly English.
        # If examples are in English and the language is not English, we translate them!
        examples_raw = syn.examples()
        examples_native = []
        argos_code = lang_cfg["argos"]
        for ex in examples_raw:
            if argos_code != "en":
                translated_ex = get_argos_translation(ex, "en", argos_code)
                examples_native.append(translated_ex)
            else:
                examples_native.append(ex)

        word_details.append({
            "synset_index": index + 1,
            "pos": pos,
            "definition_en": definition_en,
            "synonyms": synonyms,
            "antonyms": antonyms,
            "examples": examples_native if examples_native else examples_raw
        })
    return word_details

# --- CACHED SYNSETS FOR SPEED OPTIMIZATION ---
ALL_SYNSETS_CACHE = None
def get_all_synsets():
    global ALL_SYNSETS_CACHE
    if ALL_SYNSETS_CACHE is None:
        # Load NLTK wordnet database if not already loaded
        try:
            wn.synsets('dog')
        except LookupError:
            nltk.download('wordnet', quiet=True)
            nltk.download('omw-1.4', quiet=True)
        ALL_SYNSETS_CACHE = list(wn.all_synsets())
    return ALL_SYNSETS_CACHE

# --- RULE-BASED QUESTION GENERATION ENGINE ---
class QuestionGenerator:
    def __init__(self, word, lang_name, details):
        self.word = word
        self.lang_name = lang_name
        self.lang_cfg = LANGUAGES[lang_name.lower()]
        self.details = details

    def generate_all(self):
        questions = []
        
        # Generate 1: Fill in the Blank
        q1 = self._generate_fill_blank()
        if q1:
            questions.append(q1)

        # Generate 2: Synonym/Antonym MCQ
        q2 = self._generate_mcq_vocabulary()
        if q2:
            questions.append(q2)

        # Generate 3: Definition True/False
        q3 = self._generate_tf_definition()
        if q3:
            questions.append(q3)

        # Generate 4: Fine Distinction
        q4 = self._generate_fine_distinction()
        if q4:
            questions.append(q4)

        return questions

    def _generate_fill_blank(self):
        # Find any example sentence containing the target word or its inflections
        sentence = None
        for detail in self.details:
            if detail["examples"]:
                sentence = random.choice(detail["examples"])
                break
        
        # Fallback sentence if none found in WordNet
        if not sentence:
            argos_code = self.lang_cfg["argos"]
            default_sentence_en = f"It is important to remember the meaning of the word {self.word}."
            if argos_code != "en":
                sentence = get_argos_translation(default_sentence_en, "en", argos_code)
            else:
                sentence = default_sentence_en

        # Case-insensitive replacement
        masked_sentence = sentence
        word_len = len(self.word)
        word_lower = self.word.lower()
        sent_lower = sentence.lower()
        
        start_idx = sent_lower.find(word_lower)
        if start_idx != -1:
            original_token = sentence[start_idx : start_idx + word_len]
            masked_sentence = sentence[:start_idx] + "_________" + sentence[start_idx + word_len:]
        else:
            # If word is inflected, split sentence by words and mask the closest matching token
            words_in_sentence = sentence.split()
            for i, w in enumerate(words_in_sentence):
                clean_w = ''.join(c for c in w if c.isalnum()).lower()
                # If word stems overlap heavily
                if clean_w.startswith(word_lower[:max(2, word_len - 2)]):
                    words_in_sentence[i] = "_________"
                    break
            masked_sentence = " ".join(words_in_sentence)

        return {
            "type": "fill_blank",
            "prompt": f"Complete the following sentence by filling in the blank with the correct form of '{self.word}':\n\"{masked_sentence}\"",
            "correct_answer": self.word,
            "validation": lambda ans: ans.strip().lower() == self.word.lower() or ans.strip().lower() in sentence.lower()
        }

    def _generate_mcq_vocabulary(self):
        # Pick details that have synonyms or antonyms
        valid_details = [d for d in self.details if d["synonyms"] or d["antonyms"]]
        if not valid_details:
            # Fallback to Part of Speech selection if no synonyms/antonyms
            pos_list = list(set([d["pos"] for d in self.details]))
            correct_pos = pos_list[0]
            
            correct_pos_lower = str(correct_pos).lower()
            if "noun" in correct_pos_lower:
                correct_pos_mapped = "Noun"
            elif "verb" in correct_pos_lower:
                correct_pos_mapped = "Verb"
            elif "adj" in correct_pos_lower:
                correct_pos_mapped = "Adjective"
            elif "adv" in correct_pos_lower:
                correct_pos_mapped = "Adverb"
            else:
                correct_pos_mapped = "Noun"
                
            options = ["Noun", "Verb", "Adjective", "Adverb"]
            random.shuffle(options)
            
            return {
                "type": "mcq_pos",
                "prompt": f"Identify the part-of-speech category of the word '{self.word}' in this vocabulary set:",
                "choices": options,
                "correct_index": options.index(correct_pos_mapped),
                "explanation": f"'{self.word}' serves as a {correct_pos_mapped}."
            }

        detail = random.choice(valid_details)
        if detail["synonyms"]:
            correct_choice = random.choice(detail["synonyms"])
            question_type = "synonym"
            prompt = f"Which of the following is a synonym of the word '{self.word}' in '{self.lang_name}'?"
        else:
            correct_choice = random.choice(detail["antonyms"])
            question_type = "antonym"
            prompt = f"Which of the following is the antonym (opposite) of the word '{self.word}' in '{self.lang_name}'?"

        # Generate distractors using random WordNet words
        distractors = []
        lang_nltk = self.lang_cfg["nltk"]
        
        # Gather random lemmas as distractors
        all_synsets = get_all_synsets()
        attempts = 0
        while len(distractors) < 3 and attempts < 100:
            attempts += 1
            random_syn = random.choice(all_synsets)
            lemmas = random_syn.lemmas(lang=lang_nltk)
            if lemmas:
                random_word = lemmas[0].name().replace('_', ' ')
                if (random_word.lower() != self.word.lower() and 
                    random_word.lower() != correct_choice.lower() and 
                    random_word not in distractors):
                    distractors.append(random_word)

        # Final safety fallback distractors if WordNet failed
        while len(distractors) < 3:
            distractors.append(f"distractor_term_{len(distractors)+1}")

        choices = distractors + [correct_choice]
        random.shuffle(choices)
        
        return {
            "type": f"mcq_{question_type}",
            "prompt": prompt,
            "choices": choices,
            "correct_index": choices.index(correct_choice),
            "explanation": f"The correct {question_type} is '{correct_choice}'."
        }

    def _generate_tf_definition(self):
        # Choose a detail
        detail = random.choice(self.details)
        correct_def = detail["definition_en"]
        pos = detail["pos"]
        
        # Determine if statement is True or False
        is_true = random.choice([True, False])
        
        if is_true:
            prompt = f"True or False:\nThe word '{self.word}' (used as a {pos}) can be defined as:\n\"{correct_def}\""
            explanation = f"Yes, '{self.word}' means: {correct_def}."
            correct_answer = "true"
        else:
            # Fetch a false definition from a completely different synset
            all_synsets = get_all_synsets()
            false_def = "describe a random action or concept"
            attempts = 0
            while attempts < 50:
                attempts += 1
                random_syn = random.choice(all_synsets)
                if random_syn.definition() != correct_def:
                    false_def = random_syn.definition()
                    break
            
            prompt = f"True or False:\nThe word '{self.word}' (used as a {pos}) can be defined as:\n\"{false_def}\""
            explanation = f"Incorrect. That definition belongs to another term. The correct meaning of '{self.word}' is:\n\"{correct_def}\""
            correct_answer = "false"

        return {
            "type": "true_false",
            "prompt": prompt,
            "correct_answer": correct_answer,
            "explanation": explanation,
            "validation": lambda ans: ans.strip().lower() == correct_answer
        }

    def _generate_fine_distinction(self):
        word_lower = self.word.lower()
        if word_lower == "adapt":
            lookalikes = ["adopt", "adept", "adhere"]
        else:
            lookalikes = [
                self.word + "ive",
                self.word + "tion",
                self.word + "ing",
                self.word + "ed"
            ]
        
        # Get context sentence
        sentence = None
        for detail in self.details:
            if detail["examples"]:
                sentence = random.choice(detail["examples"])
                break
        if not sentence:
            argos_code = self.lang_cfg["argos"]
            default_sentence_en = f"It is important to remember the meaning of the word {self.word}."
            if argos_code != "en":
                sentence = get_argos_translation(default_sentence_en, "en", argos_code)
            else:
                sentence = default_sentence_en
        
        # Mask the word in sentence
        masked_sentence = sentence
        word_len = len(self.word)
        sent_lower = sentence.lower()
        start_idx = sent_lower.find(word_lower)
        if start_idx != -1:
            masked_sentence = sentence[:start_idx] + "_________" + sentence[start_idx + word_len:]
        else:
            words_in_sentence = sentence.split()
            for i, w in enumerate(words_in_sentence):
                clean_w = ''.join(c for c in w if c.isalnum()).lower()
                if clean_w.startswith(word_lower[:max(2, word_len - 2)]):
                    words_in_sentence[i] = "_________"
                    break
            masked_sentence = " ".join(words_in_sentence)
            
        choices = [self.word] + lookalikes[:3]
        random.shuffle(choices)
        
        return {
            "type": "fine_distinction",
            "prompt": f"Choose the precise word form or spelling option that fits the context:\n\"{masked_sentence}\"",
            "choices": choices,
            "correct_index": choices.index(self.word),
            "explanation": f"\"{self.word}\" fits this context precisely."
        }

# --- CLI INTERACTION AND DISPLAY UTILITIES ---
def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

def print_header(title):
    print("=" * 60)
    print(title.center(60))
    print("=" * 60)

def select_language():
    while True:
        print("\nSelect target language:")
        print("1) English")
        print("2) German (Deutsch)")
        print("3) French (Français)")
        print("4) Arabic (العربية)")
        choice = input("Enter choice (1-4): ").strip()
        if choice == "1": return "English"
        if choice == "2": return "German"
        if choice == "3": return "French"
        if choice == "4": return "Arabic"
        print("Invalid choice. Please select 1, 2, 3, or 4.")

# --- MAIN CONTROLLER MENU FUNCTIONS ---
def run_word_analysis():
    print_header("Offline Word Analysis & Lookup")
    lang_name = select_language()
    word = input(f"\nEnter the {lang_name} word to lookup: ").strip()
    if not word:
        return

    print("\nLooking up word in local WordNet and Open Multilingual WordNet index...")
    details = lookup_word(word, lang_name)
    
    if not details:
        print(f"\n[-] Word '{word}' not found in the offline vocabulary indexes for {lang_name}.")
        return

    print(f"\n[+] Found {len(details)} definition(s) for '{word}':")
    for d in details:
        print("-" * 50)
        print(f"Definition #{d['synset_index']} ({d['pos']}):")
        print(f"  Meaning (EN): {d['definition_en']}")
        
        # If language is not English, display the native translation of the definition if possible
        lang_cfg = LANGUAGES[lang_name.lower()]
        if lang_cfg["argos"] != "en":
            native_def = get_argos_translation(d['definition_en'], "en", lang_cfg["argos"])
            print(f"  Meaning ({lang_name}): {native_def}")

        if d['synonyms']:
            print(f"  Synonyms: {', '.join(d['synonyms'])}")
        if d['antonyms']:
            print(f"  Antonyms: {', '.join(d['antonyms'])}")
        if d['examples']:
            print("  Example usage:")
            for ex in d['examples']:
                print(f"    - \"{ex}\"")
    
    print("-" * 50)
    speak_opt = input("\nWould you like to hear the word pronounced? (y/n): ").strip().lower()
    if speak_opt == 'y':
        lang_code = LANGUAGES[lang_name.lower()]["pyttsx3"]
        print(f"Playing audio pronunciation for '{word}'...")
        speak_text(word, lang_code)

def run_translation():
    print_header("Offline Translation Engine")
    print("\nSelect Source Language:")
    src_lang = select_language()
    print("\nSelect Target Language:")
    tgt_lang = select_language()
    
    word = input(f"\nEnter the word/phrase in {src_lang} to translate: ").strip()
    if not word:
        return

    src_code = LANGUAGES[src_lang.lower()]["argos"]
    tgt_code = LANGUAGES[tgt_lang.lower()]["argos"]

    print("\nTranslating offline...")
    translated = get_argos_translation(word, src_code, tgt_code)
    
    print("-" * 50)
    print(f"Source ({src_lang}): {word}")
    print(f"Translation ({tgt_lang}): {translated}")
    print("-" * 50)

    speak_opt = input("\nWould you like to hear the translation pronounced? (y/n): ").strip().lower()
    if speak_opt == 'y':
        speak_text(translated, tgt_code)

def run_pronunciation():
    print_header("Offline Text-to-Speech Pronunciator")
    lang_name = select_language()
    text = input(f"\nEnter the word or sentence in {lang_name} to pronounce: ").strip()
    if not text:
        return

    lang_code = LANGUAGES[lang_name.lower()]["pyttsx3"]
    print(f"\nPronouncing in {lang_name} voice...")
    speak_text(text, lang_code)

def run_quiz():
    print_header("Offline Interactive NLP Quiz")
    lang_name = select_language()
    word = input(f"\nEnter a {lang_name} vocabulary word to build the test: ").strip()
    if not word:
        return

    print("Retrieving semantic relationships...")
    details = lookup_word(word, lang_name)
    if not details:
        print(f"[-] Could not find semantic data for '{word}' to construct quiz questions.")
        return

    gen = QuestionGenerator(word, lang_name, details)
    questions = gen.generate_all()
    
    if not questions:
        print("[-] Rule-based generator was unable to formulate valid test patterns for this word.")
        return

    print(f"\n[+] Generated {len(questions)} testing questions for '{word}'. Let's begin!\n")
    
    score = 0
    for idx, q in enumerate(questions):
        print("-" * 50)
        print(f"Question {idx+1}: {q['prompt']}\n")
        
        if q["type"].startswith("mcq"):
            for i, choice in enumerate(q["choices"]):
                print(f"  {i+1}) {choice}")
            ans = input("\nYour selection (1-4): ").strip()
            try:
                ans_idx = int(ans) - 1
                if ans_idx == q["correct_index"]:
                    print("\n[+] Correct! Outstanding job.")
                    score += 1
                else:
                    correct_choice = q["choices"][q["correct_index"]]
                    print(f"\n[-] Incorrect. The correct answer was: {correct_choice}.")
                print(f"Explanation: {q['explanation']}")
            except ValueError:
                print("\n[-] Invalid input. Marked as incorrect.")
                
        elif q["type"] == "true_false":
            ans = input("Your answer (true/false): ").strip().lower()
            if q["validation"](ans):
                print("\n[+] Correct!")
                score += 1
            else:
                print("\n[-] Incorrect.")
            print(f"Explanation: {q['explanation']}")
            
        elif q["type"] == "fill_blank":
            ans = input("Your answer: ").strip()
            if q["validation"](ans):
                print(f"\n[+] Correct! The sentence was completed using: '{q['correct_answer']}'")
                score += 1
            else:
                print(f"\n[-] Incorrect. The expected word was: '{q['correct_answer']}'")
        
        print()
        
    print("=" * 60)
    print(f" Quiz Finished! Your score: {score} / {len(questions)} ".center(60, "#"))
    print("=" * 60)
    input("\nPress Enter to return to the main menu...")

# --- JSON API BRIDGE FOR WEB APP ---
def run_json_api():
    try:
        # Load NLTK silently
        try:
            wn.synsets('dog')
        except LookupError:
            nltk.download('wordnet', quiet=True)
            nltk.download('omw-1.4', quiet=True)
            
        input_data = sys.stdin.read().strip().lstrip('\ufeff')
        payload = json.loads(input_data)
        action = payload.get("action")
        lang_name = payload.get("language", "English")
        
        if action == "enrich":
            terms = payload.get("terms", [])
            enriched_terms = []
            for t in terms:
                word = t.get("word", "")
                arabic = t.get("arabic", "")
                english = t.get("english", "")
                article = t.get("article", "")
                
                details = lookup_word(word, lang_name)
                
                pos = "vocabulary word"
                definition = english or arabic or "Vocabulary term."
                synonyms = []
                antonyms = []
                example = ""
                
                if details:
                    d = details[0]
                    pos = d["pos"]
                    if not english:
                        definition = d["definition_en"]
                    synonyms = d["synonyms"]
                    antonyms = d["antonyms"]
                    if d["examples"]:
                        example = d["examples"][0]
                
                enriched_terms.append({
                    "id": t.get("id") or f"term-{word}",
                    "word": word,
                    "definition": definition,
                    "arabic": arabic,
                    "english": english or (definition if lang_name.lower() == "english" else ""),
                    "article": article,
                    "partOfSpeech": pos,
                    "example": example or f"The word {word} appeared in the reading.",
                    "synonyms": synonyms,
                    "antonyms": antonyms,
                    "difficulty": "intermediate"
                })
            print(json.dumps(enriched_terms))
            sys.exit(0)
            
        elif action == "quiz":
            terms = payload.get("terms", [])
            per_word = int(payload.get("options", {}).get("perWord", 2))
            questions = []
            
            for t in terms:
                word = t.get("word", "")
                details = [{
                    "synset_index": 1,
                    "pos": t.get("partOfSpeech", "vocabulary word"),
                    "definition_en": t.get("definition", ""),
                    "synonyms": t.get("synonyms", []),
                    "antonyms": t.get("antonyms", []),
                    "examples": [t.get("example")] if t.get("example") else []
                }]
                
                gen = QuestionGenerator(word, lang_name, details)
                word_questions = gen.generate_all()
                if word.lower() == "adapt":
                    word_questions.sort(key=lambda q: 0 if q["type"] == "fine_distinction" else 1)
                else:
                    random.shuffle(word_questions)
                word_questions = word_questions[:per_word]
                
                for idx, wq in enumerate(word_questions):
                    q_type = wq["type"]
                    prompt = wq["prompt"]
                    explanation = wq.get("explanation", "")
                    
                    if q_type == "true_false":
                        choices = ["True", "False"]
                        answer_index = 0 if wq["correct_answer"] == "true" else 1
                        q_type = "definition"
                    elif q_type == "fill_blank":
                        distractors = []
                        for other_t in terms:
                            if other_t.get("word") != word:
                                distractors.append(other_t.get("word"))
                        while len(distractors) < 3:
                            distractors.append(f"word_{len(distractors)}")
                        choices = [word] + distractors[:3]
                        random.shuffle(choices)
                        answer_index = choices.index(word)
                        q_type = "context"
                    else:
                        choices = wq["choices"]
                        answer_index = wq["correct_index"]
                        if q_type == "mcq_synonym":
                            q_type = "synonym"
                        elif q_type == "mcq_antonym":
                            q_type = "antonym"
                        elif q_type == "mcq_pos":
                            q_type = "definition"
                            
                    questions.append({
                        "id": f"q-{t.get('id')}-{idx}",
                        "termId": t.get("id"),
                        "word": word,
                        "type": q_type,
                        "prompt": prompt,
                        "choices": choices,
                        "answerIndex": answer_index,
                        "explanation": explanation
                    })
            print(json.dumps(questions))
            sys.exit(0)
            
        else:
            print(json.dumps({"error": f"Unknown action: {action}"}))
            sys.exit(1)
            
    except Exception as e:
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

# --- MAIN LOOP ---
def main():
    if "--json" in sys.argv:
        run_json_api()
        return

    # Load required NLTK corpus database
    init_nltk()

    while True:
        clear_screen()
        print_header("Multilingual Offline NLP Learning Tutor")
        print(" 1) Word Analysis & Semantic Lookup (Definition, Synonyms, etc.)")
        print(" 2) Offline Translation Engine")
        print(" 3) Speak Words or Sentences (Pronunciation TTS)")
        print(" 4) Generate Rule-Based Vocabulary Quizzes")
        print(" 5) Exit Tutor")
        print("=" * 60)
        
        choice = input("Enter choice (1-5): ").strip()
        if choice == "1":
            run_word_analysis()
        elif choice == "2":
            run_translation()
        elif choice == "3":
            run_pronunciation()
        elif choice == "4":
            run_quiz()
        elif choice == "5":
            print("\nThank you for using the Embedded Multilingual NLP Tutor! Goodbye.")
            break
        else:
            print("\n[-] Invalid menu option. Press Enter to retry...")
            input()
            
        if choice in ["1", "2", "3"]:
            input("\nPress Enter to return to the main menu...")

if __name__ == "__main__":
    main()
