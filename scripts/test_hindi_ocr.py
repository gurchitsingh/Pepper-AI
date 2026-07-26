"""Standalone, isolated real-pipeline test for Hindi + English OCR fallback.

Does not touch the shared dev server/worker or the database. Renders real
sentences as bitmaps, embeds them in a PDF with zero extractable text layer,
and runs the actual app/ingestion/document.py OCR + transliteration code
against them.

Run: python scripts/test_hindi_ocr.py
"""
import os
import sys

os.environ.setdefault(
    "TESSDATA_PREFIX",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tessdata_local"),
)

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import fitz
import pytesseract
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader

from app.ingestion import document
from app.ingestion.transliteration import transliterate_devanagari

FONT_PATH = r"C:\Windows\Fonts\Nirmala.ttc"

HINDI_TEXT = "नमस्ते, यह एक हिंदी वाक्य है जो परीक्षण के लिए बनाया गया है।"
ENGLISH_TEXT = "Hello, this is an English sentence created for testing purposes."


def render_text_image(text: str, font_path: str, size: int = 40) -> Image.Image:
    font = ImageFont.truetype(font_path, size)
    dummy = Image.new("RGB", (10, 10))
    draw = ImageDraw.Draw(dummy)
    bbox = draw.textbbox((0, 0), text, font=font)
    width, height = bbox[2] - bbox[0] + 40, bbox[3] - bbox[1] + 40
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    draw.text((20, 20), text, font=font, fill="black")
    return image


def build_image_only_pdf(image: Image.Image, out_path: str) -> None:
    png_path = out_path + ".png"
    image.save(png_path)
    pdf = fitz.open()
    page = pdf.new_page(width=image.width, height=image.height)
    page.insert_image(page.rect, filename=png_path)
    pdf.save(out_path)
    pdf.close()
    os.remove(png_path)


def assert_no_text_layer(pdf_path: str) -> None:
    reader = PdfReader(pdf_path)
    extracted = "".join(page.extract_text() or "" for page in reader.pages).strip()
    assert extracted == "", f"Expected zero extractable text, got: {extracted!r}"


def run_case(label: str, source_text: str, out_path: str) -> None:
    print(f"\n{'=' * 60}\n{label}\n{'=' * 60}")
    image = render_text_image(source_text, FONT_PATH)
    build_image_only_pdf(image, out_path)
    assert_no_text_layer(out_path)
    print(f"Confirmed zero extractable text layer in {out_path} (genuine OCR test case)")

    # Reproduce _ocr_pdf's per-page raw OCR step directly (same dpi/lang) so we can show
    # the pre-transliteration Tesseract output before it's overwritten by transliteration.
    document._ensure_tesseract("eng+hin")
    with fitz.open(out_path) as pdf:
        raw_ocr = "\n".join(
            pytesseract.image_to_string(
                Image.open(__import__("io").BytesIO(page.get_pixmap(dpi=300).tobytes("png"))),
                lang="eng+hin",
            )
            for page in pdf
        ).strip()
    transliterated = transliterate_devanagari(raw_ocr).strip()

    result = document.process_uploaded_document(out_path)

    print(f"\nSource text:\n  {source_text!r}")
    print(f"\nRaw Tesseract OCR output (pre-transliteration):\n  {raw_ocr!r}")
    print(f"\nTransliterated (Roman-script) output:\n  {transliterated!r}")
    print(f"\nFull document.py pipeline output (process_uploaded_document().raw_text):\n  {result.raw_text!r}")
    print(f"\nPipeline matches manual transliteration: {result.raw_text == transliterated}")


if __name__ == "__main__":
    scratch = os.path.dirname(os.path.abspath(__file__))

    run_case("HINDI (Devanagari) OCR TEST", HINDI_TEXT, os.path.join(scratch, "_test_hindi.pdf"))
    run_case("ENGLISH OCR REGRESSION TEST", ENGLISH_TEXT, os.path.join(scratch, "_test_english.pdf"))

    print("\nAll cases completed.")
