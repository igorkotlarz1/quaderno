"""The open datasets the dictionary is built from. Nothing of them is stored in the repository:
`python -m app.lexicon.build` downloads them on the server. The same list is shown in the app
("Źródła słownika") and in the README, because all three licenses require credit to the authors."""

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class Source:
    id: str
    name: str
    role: str  # what we take from it
    authors: str
    license: str
    license_url: str
    homepage: str
    url: str  # what the build script downloads
    sha256: str | None  # pinned when the file never changes; None for regularly updated dumps
    encoding: str = "utf-8"

    def public(self) -> dict:
        d = asdict(self)
        d.pop("encoding")
        return d


FREQUENCY = Source(
    id="frequencywords",
    name="FrequencyWords, Italian 50k (2018)",
    role="how often each word form is used in spoken Italian (film and TV subtitles)",
    authors="Hermit Dave; built from the OpenSubtitles 2018 corpus (opensubtitles.org) as published by OPUS "
    "(P. Lison, J. Tiedemann, 2016)",
    license="CC BY-SA 4.0",
    license_url="https://creativecommons.org/licenses/by-sa/4.0/",
    homepage="https://github.com/hermitdave/FrequencyWords",
    url="https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/it/it_50k.txt",
    sha256="bb96cdcb56d28342c1e909db6b2525448b7767136b7e86a2ccc649a1be66fc19",
)

MORPHIT = Source(
    id="morphit",
    name="Morph-it! 0.4.8",
    role="which dictionary form (lemma) an inflected form belongs to: finestre → finestra, parlo → parlare",
    authors="Marco Baroni, Eros Zanchetta (SSLMIT, University of Bologna)",
    license="CC BY-SA 2.0 (dual-licensed with LGPL)",
    license_url="https://creativecommons.org/licenses/by-sa/2.0/",
    homepage="https://docs.sslmit.unibo.it/doku.php?id=resources:morph-it",
    # The original site blocks scripts; this is an unchanged copy of the 0.4.8 release, checked by hash.
    url="https://raw.githubusercontent.com/TraMOOC-Impleval/lemmatize_italian_data/master/morph-it_048.txt",
    sha256="705da3220c8b7dafa0731f057303da0c474efe248abe6d7ae331d1e470fd55fa",
    encoding="latin-1",
)

WIKTIONARY = Source(
    id="plwiktionary",
    name="Wikisłownik (Polish Wiktionary), Italian entries, via kaikki.org",
    role="the Polish meanings of each Italian word, in the order Wiktionary lists them",
    authors="Wikisłownik contributors; extracted with wiktextract by Tatu Ylonen (kaikki.org)",
    license="CC BY-SA 4.0 and GFDL (same as Wiktionary)",
    license_url="https://creativecommons.org/licenses/by-sa/4.0/",
    homepage="https://kaikki.org/plwiktionary/j%C4%99zyk%20w%C5%82oski/index.html",
    url="https://kaikki.org/plwiktionary/j%C4%99zyk%20w%C5%82oski/kaikki.org-dictionary-j%C4%99zykw%C5%82oski.jsonl",
    sha256=None,  # regenerated from new dumps; the hash of what was used is stored in lex_meta
)

ALL = (FREQUENCY, MORPHIT, WIKTIONARY)
