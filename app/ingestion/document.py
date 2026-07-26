import io
import os
import shutil

import fitz
import pytesseract
from docx import Document as DocxDocument
from PIL import Image
from pypdf import PdfReader

from app.ingestion.common import IngestResult, IngestionError
from app.ingestion.transliteration import transliterate_devanagari

SUPPORTED_EXTENSIONS = {".md", ".txt", ".pdf", ".docx"}

TESSERACT_FALLBACK_PATHS = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
)

TESSDATA_FALLBACK_DIRS = (
    r"C:\Program Files\Tesseract-OCR\tessdata",
    r"C:\Program Files (x86)\Tesseract-OCR\tessdata",
)

TESSERACT_INSTALL_HINT = (
    "OCR fallback requires Tesseract OCR, which isn't installed or isn't on PATH. Install it: "
    "Windows -- https://github.com/UB-Mannheim/tesseract/wiki or `winget install "
    "UB-Mannheim.TesseractOCR`; macOS -- `brew install tesseract`; Linux -- `apt install tesseract-ocr`."
)

HINDI_LANGPACK_INSTALL_HINT = (
    "Hindi OCR requires the Tesseract Hindi language pack (hin.traineddata), which isn't installed. "
    "Download it from https://github.com/tesseract-ocr/tessdata_fast/raw/main/hin.traineddata and place it in "
    "your tessdata folder (e.g. C:\\Program Files\\Tesseract-OCR\\tessdata); "
    "macOS/Linux -- `brew install tesseract-lang` or `apt install tesseract-ocr-hin`."
)


def _tessdata_dir() -> str | None:
    env_dir = os.environ.get("TESSDATA_PREFIX")
    if env_dir and os.path.isdir(env_dir):
        return env_dir
    tesseract_dir = os.path.dirname(pytesseract.pytesseract.tesseract_cmd)
    candidate = os.path.join(tesseract_dir, "tessdata")
    if os.path.isdir(candidate):
        return candidate
    for candidate in TESSDATA_FALLBACK_DIRS:
        if os.path.isdir(candidate):
            return candidate
    return None


def _ensure_tesseract(lang: str = "eng") -> None:
    """Resolves a usable tesseract binary for pytesseract, checking PATH first and then
    common Windows install locations (a fresh install may not be on PATH yet for an
    already-running process). Raises a clear, actionable error if none is found --
    never silently skips OCR or guesses. Also verifies every requested language's
    .traineddata file is present, so a missing Hindi pack fails clearly instead of
    silently falling back to English-only recognition.
    """
    if not shutil.which(pytesseract.pytesseract.tesseract_cmd):
        for candidate in TESSERACT_FALLBACK_PATHS:
            if os.path.exists(candidate):
                pytesseract.pytesseract.tesseract_cmd = candidate
                break
        else:
            raise IngestionError(TESSERACT_INSTALL_HINT)

    tessdata_dir = _tessdata_dir()
    for code in lang.split("+"):
        if tessdata_dir and not os.path.exists(os.path.join(tessdata_dir, f"{code}.traineddata")):
            if code == "hin":
                raise IngestionError(HINDI_LANGPACK_INSTALL_HINT)
            raise IngestionError(f"Tesseract language pack '{code}' not found in {tessdata_dir}.")


def _extract_text_file(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


def _extract_pdf(path: str) -> str:
    reader = PdfReader(path)
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(pages)


def _ocr_pdf(path: str, lang: str = "eng+hin") -> str:
    """Fallback for PDFs with no extractable text layer (scanned documents, photos saved
    as PDF): rasterizes each page and runs Tesseract OCR on it, recognizing English and
    Hindi (Devanagari) text. Any Devanagari OCR output is transliterated to Roman script
    to match how Whisper-transcribed Hindi speech is stored (see transliteration.py).
    """
    _ensure_tesseract(lang)
    texts = []
    with fitz.open(path) as pdf:
        for page in pdf:
            pixmap = page.get_pixmap(dpi=300)
            image = Image.open(io.BytesIO(pixmap.tobytes("png")))
            page_text = pytesseract.image_to_string(image, lang=lang)
            texts.append(transliterate_devanagari(page_text))
    return "\n".join(texts)


def _extract_docx(path: str) -> str:
    doc = DocxDocument(path)
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs)


def process_uploaded_document(file_path: str) -> IngestResult:
    if not os.path.exists(file_path):
        raise IngestionError(f"Uploaded file not found on disk: {file_path}")

    ext = os.path.splitext(file_path)[1].lower()
    ocr_attempted = False

    if ext in (".md", ".txt"):
        text = _extract_text_file(file_path)
    elif ext == ".pdf":
        text = _extract_pdf(file_path).strip()
        if not text:
            ocr_attempted = True
            text = _ocr_pdf(file_path)
    elif ext == ".docx":
        text = _extract_docx(file_path)
    else:
        raise IngestionError(
            f"Unsupported document file type: {ext or '(no extension)'}. Supported: {sorted(SUPPORTED_EXTENSIONS)}"
        )

    text = text.strip()
    if not text:
        if ext == ".pdf":
            detail = (
                "No extractable text found in this PDF, even after OCR."
                if ocr_attempted
                else "No extractable text found in this PDF."
            )
            raise IngestionError(f"{detail} It may be a blank page or an image with no readable text.")
        raise IngestionError(f"No extractable text found in this {ext} file.")

    return IngestResult(raw_text=text)
