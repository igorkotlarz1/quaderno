"""Normalising what was typed in class into a dictionary key.
Mirrored in web/src/lib/lexicon.ts (same test cases)."""

import re
import unicodedata

ARTICLE = re.compile(
    r"^(?:(?:il|lo|la|i|gli|le|un|uno|una)\s+|(?:l|un|dell|nell|all|sull|dall)')", re.IGNORECASE
)
# Trailing apostrophes stay: "po'" (= poco) is a word.
EDGE_PUNCT = re.compile(r"^[\s\"'«»“”„.,;:!?¿¡()\[\]-]+|[\s\"«»“”„.,;:!?¿¡()\[\]-]+$")


def normalize(text: str) -> str:
    """'  La Finestra! ' → 'finestra'; "l’amico" → 'amico'.
    Lower case, typographic apostrophes made plain, leading article removed."""
    t = text.replace("’", "'").replace("`", "'").strip().lower()
    t = EDGE_PUNCT.sub("", t)
    t = re.sub(r"\s+", " ", t)
    stripped = ARTICLE.sub("", t, count=1).strip()
    return stripped or t


def accent_key(text: str) -> str:
    """'perché' → 'perche', 'è' → 'e': lets 'citta' or 'piu' typed without accents still match."""
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")
