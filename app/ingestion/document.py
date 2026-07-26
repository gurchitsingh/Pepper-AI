import io
import os
import shutil

import fitz
import pytesseract
from docx import Document as DocxDocument
from PIL import Image
from pypdf import PdfReader

from app.ingestion.common import IngestResult, IngestionError

SUPPORTED_EXTENSIONS = {".md", ".txt", ".pdf", ".docx"}

TESSERACT_FALLBACK_PATHS = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
)

TESSERACT_INSTALL_HINT = (
    "OCR fallback requires Tesseract OCR, which isn't installed or isn't on PATH. Install it: "
    "Windows -- https://github.com/UB-Mannheim/tesseract/wiki or `winget install "
    "UB-Mannheim.TesseractOCR`; macOS -- `brew install tesseract`; Linux -- `apt install tesseract-ocr`."
)


def _ensure_tesseract() -> None:
    """Resolves a usable tesseract binary for pytesseract, checking PATH first and then
    common Windows install locations (a fresh install may not be on PATH yet for an
    already-running process). Raises a clear, actionable error if none is found --
    never silently skips OCR or guesses.
    """
    if shutil.which(pytesseract.pytesseract.tesseract_cmd):
        return
    for candidate in TESSERACT_FALLBACK_PATHS:
        if os.path.exists(candidate):
            pytesseract.pytesseract.tesseract_cmd = candidate
            return
    raise IngestionError(TESSERACT_INSTALL_HINT)


def _extract_text_file(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


def _extract_pdf(path: str) -> str:
    reader = PdfReader(path)
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(pages)


def _ocr_pdf(path: str, lang: str = "eng") -> str:
    """Fallback for PDFs with no extractable text layer (scanned documents, photos saved
    as PDF): rasterizes each page and runs Tesseract OCR on it. English only for now.
    """
    _ensure_tesseract()
    texts = []
    with fitz.open(path) as pdf:
        for page in pdf:
            pixmap = page.get_pixmap(dpi=300)
            image = Image.open(io.BytesIO(pixmap.tobytes("png")))
            texts.append(pytesseract.image_to_string(image, lang=lang))
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
