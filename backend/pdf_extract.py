import argparse
import io
import json
import shutil
import sys


MIN_WORDS = 8


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf_path")
    parser.add_argument("--ocr", action="store_true")
    parser.add_argument("--max-pages", type=int, default=400)
    parser.add_argument("--max-ocr-pages", type=int, default=24)
    args = parser.parse_args()

    warnings = []
    text, page_count = extract_selectable_text(args.pdf_path, args.max_pages, warnings)
    method = "selectable-text" if has_enough_text(text) else "none"
    ocr_attempted = False
    ocr_available = is_ocr_available()

    if not has_enough_text(text) and args.ocr:
        ocr_attempted = True
        if ocr_available:
            try:
                text = extract_ocr_text(args.pdf_path, min(page_count or args.max_ocr_pages, args.max_ocr_pages))
                method = "ocr" if has_enough_text(text) else "none"
                if page_count and page_count > args.max_ocr_pages:
                    warnings.append(
                        f"OCR was limited to the first {args.max_ocr_pages} pages to keep processing responsive."
                    )
            except Exception as exc:
                warnings.append(f"OCR was available but failed: {exc}")
        else:
            warnings.append(
                "No selectable text was found. This looks like a scanned PDF, but local OCR tools are not installed."
            )

    print(
        json.dumps(
            {
                "text": normalize_text(text),
                "method": method,
                "pageCount": page_count,
                "ocrAttempted": ocr_attempted,
                "ocrAvailable": ocr_available,
                "warnings": warnings,
            },
            ensure_ascii=False,
        )
    )


def extract_selectable_text(pdf_path, max_pages, warnings):
    try:
        from pypdf import PdfReader
    except Exception as exc:
        raise RuntimeError(f"Python package pypdf is required for PDF extraction: {exc}")

    reader = PdfReader(pdf_path)
    page_count = len(reader.pages)
    page_limit = min(page_count, max_pages)
    chunks = []

    if page_count > max_pages:
        warnings.append(f"Only the first {max_pages} pages were scanned for selectable text.")

    for index in range(page_limit):
        try:
            page_text = reader.pages[index].extract_text() or ""
        except Exception as exc:
            warnings.append(f"Page {index + 1} text extraction failed: {exc}")
            page_text = ""
        if page_text.strip():
            chunks.append(page_text)

    return "\n\n".join(chunks), page_count


def resolve_tesseract_path():
    import os
    import pathlib
    # 1. Check PATH
    tess_path = shutil.which("tesseract")
    if tess_path:
        return tess_path

    # 2. Check standard installation directories
    home = str(pathlib.Path.home())
    candidates = [
        os.path.join(home, "scoop", "shims", "tesseract.exe"),
        os.path.join(home, "scoop", "apps", "tesseract", "current", "tesseract.exe"),
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ]
    for candidate in candidates:
        if os.path.exists(candidate):
            return candidate
    return None


def get_ocr_languages(tess_path):
    import os
    tessdata_dir = os.path.join(os.path.dirname(tess_path), "tessdata")
    if not os.path.exists(tessdata_dir):
        # Scoop structure has shims in one folder, apps in another, check if parent is scoop shims
        parent_dir = os.path.dirname(tess_path)
        if "shims" in parent_dir:
            # Scoop app is under apps\tesseract\current\tessdata
            apps_dir = os.path.join(os.path.dirname(parent_dir), "apps", "tesseract", "current", "tessdata")
            if os.path.exists(apps_dir):
                tessdata_dir = apps_dir
    langs = ["eng"]
    if os.path.exists(os.path.join(tessdata_dir, "ara.traineddata")):
        langs.append("ara")
    return "+".join(langs)


def is_ocr_available():
    tess_path = resolve_tesseract_path()
    if not tess_path:
        return False

    try:
        import fitz  # noqa: F401
        import pytesseract  # noqa: F401
        from PIL import Image  # noqa: F401
        pytesseract.pytesseract.tesseract_cmd = tess_path
    except Exception:
        return False

    return True


def extract_ocr_text(pdf_path, max_pages):
    import fitz
    import pytesseract
    from PIL import Image

    tess_path = resolve_tesseract_path()
    if tess_path:
        pytesseract.pytesseract.tesseract_cmd = tess_path

    document = fitz.open(pdf_path)
    chunks = []
    lang = get_ocr_languages(tess_path) if tess_path else "eng"

    for page_index in range(min(len(document), max_pages)):
        page = document[page_index]
        matrix = fitz.Matrix(2, 2)
        pixmap = page.get_pixmap(matrix=matrix, alpha=False)
        image = Image.open(io.BytesIO(pixmap.tobytes("png")))
        page_text = pytesseract.image_to_string(image, lang=lang)
        if page_text.strip():
            chunks.append(page_text)

    return "\n\n".join(chunks)


def has_enough_text(text):
    return len([word for word in text.split() if word.isalpha() or word.replace("-", "").isalpha()]) >= MIN_WORDS


def normalize_text(text):
    lines = [line.strip() for line in str(text or "").replace("\r", "\n").split("\n")]
    compact = []
    blank = False

    for line in lines:
        if not line:
            if not blank:
                compact.append("")
            blank = True
            continue
        compact.append(" ".join(line.split()))
        blank = False

    return "\n".join(compact).strip()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
