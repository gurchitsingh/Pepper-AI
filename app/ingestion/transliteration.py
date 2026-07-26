import re

from indic_transliteration import sanscript

DEVANAGARI_RE = re.compile(r"[ऀ-ॿ]")


def transliterate_devanagari(text: str) -> str:
    """Converts any Devanagari-script substrings in `text` to Roman/Latin script
    (ITRANS scheme). Non-Devanagari text (English words, punctuation, etc.) is
    left untouched, so mixed Hindi/English text only has its Hindi portion converted.
    """
    if not text or not DEVANAGARI_RE.search(text):
        return text
    return sanscript.transliterate(text, sanscript.DEVANAGARI, sanscript.ITRANS)
