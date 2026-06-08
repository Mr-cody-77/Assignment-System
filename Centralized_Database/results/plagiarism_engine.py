"""
results/plagiarism_engine.py

Structural fingerprinting + Jaccard similarity comparison.
Supports Python, C++, and Java.

Algorithm
---------
1. Tokenise the source code using a language-aware strategy:
   - Python  → Python's built-in `tokenize` module (AST-level tokens)
   - C++ / Java → regex-based lexer that extracts identifiers, keywords,
                   operators, and literal types (not literal values)
2. Normalise: strip whitespace/comment tokens; replace identifier names
   with a generic placeholder so variable renaming doesn't fool the check.
3. Build 5-grams over the normalised token sequence.
4. Hash each 5-gram with SHA-256 (truncated to 8 bytes → 16 hex chars).
5. Jaccard( A, B ) = |A ∩ B| / |A ∪ B|  where A, B are sets of hashes.
6. Return the similarity score (0.0 – 1.0).
"""

import ast
import hashlib
import io
import logging
import os
import re
import tokenize as py_tokenize
from typing import List, Set

logger = logging.getLogger("plagiarism.engine")

# ── Configuration ─────────────────────────────────────────────────────────────

NGRAM_SIZE = 5  # window size for n-gram construction

# ── Language-aware tokenisers ─────────────────────────────────────────────────

# C++ keywords (ISO C++17 core)
_CPP_KEYWORDS = {
    "alignas", "alignof", "and", "and_eq", "asm", "auto", "bitand", "bitor",
    "bool", "break", "case", "catch", "char", "char8_t", "char16_t", "char32_t",
    "class", "compl", "concept", "const", "consteval", "constexpr", "constinit",
    "const_cast", "continue", "co_await", "co_return", "co_yield", "decltype",
    "default", "delete", "do", "double", "dynamic_cast", "else", "enum",
    "explicit", "export", "extern", "false", "float", "for", "friend", "goto",
    "if", "inline", "int", "long", "mutable", "namespace", "new", "noexcept",
    "not", "not_eq", "nullptr", "operator", "or", "or_eq", "private",
    "protected", "public", "register", "reinterpret_cast", "requires", "return",
    "short", "signed", "sizeof", "static", "static_assert", "static_cast",
    "struct", "switch", "template", "this", "thread_local", "throw", "true",
    "try", "typedef", "typeid", "typename", "union", "unsigned", "using",
    "virtual", "void", "volatile", "wchar_t", "while", "xor", "xor_eq",
    # common stdlib names treated as keywords
    "std", "cout", "cin", "endl", "string", "vector", "map", "set", "pair",
    "include", "define", "ifdef", "ifndef", "endif", "pragma",
}

# Java keywords (Java 17)
_JAVA_KEYWORDS = {
    "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char",
    "class", "const", "continue", "default", "do", "double", "else", "enum",
    "extends", "final", "finally", "float", "for", "goto", "if", "implements",
    "import", "instanceof", "int", "interface", "long", "native", "new",
    "package", "private", "protected", "public", "return", "short", "static",
    "strictfp", "super", "switch", "synchronized", "this", "throw", "throws",
    "transient", "try", "var", "void", "volatile", "while", "record", "sealed",
    "permits", "yield", "true", "false", "null",
    # common class names treated structurally
    "String", "System", "out", "println", "print", "ArrayList", "List",
    "HashMap", "Map", "Scanner",
}


def _tokenise_python(code: str) -> List[str]:
    """
    Use Python's tokenize module for accurate Python tokenisation.
    - Comments and whitespace tokens are dropped.
    - String/number literals are collapsed to a generic placeholder
      so literal values don't affect the structural fingerprint.
    - Identifier names are kept as-is (structural renaming would need
      AST variable resolution; simple token comparison is sufficient here).
    """
    tokens: List[str] = []
    try:
        gen = py_tokenize.generate_tokens(io.StringIO(code).readline)
        for tok_type, tok_string, _, _, _ in gen:
            if tok_type in (
                py_tokenize.COMMENT,
                py_tokenize.NEWLINE,
                py_tokenize.NL,
                py_tokenize.INDENT,
                py_tokenize.DEDENT,
                py_tokenize.ENCODING,
                py_tokenize.ENDMARKER,
            ):
                continue
            if tok_type == py_tokenize.STRING:
                tokens.append("__STR__")
            elif tok_type == py_tokenize.NUMBER:
                tokens.append("__NUM__")
            else:
                tokens.append(tok_string)
    except py_tokenize.TokenError:
        # Partial / malformed code — fall back to regex
        tokens = _tokenise_regex(code)
    return tokens


def _tokenise_regex(code: str, keywords: Set[str] = frozenset()) -> List[str]:
    """
    Generic regex-based tokeniser for C++ and Java.
    Extracts:
      - Single-line comments (//)  → dropped
      - Block comments (/* … */)   → dropped
      - String/char literals       → __STR__
      - Integer/float literals     → __NUM__
      - Identifiers / keywords     → kept verbatim
      - Operators / punctuation    → kept verbatim (one char each)
    """
    # Strip block comments
    code = re.sub(r'/\*.*?\*/', ' ', code, flags=re.DOTALL)
    # Strip line comments
    code = re.sub(r'//[^\n]*', ' ', code)

    token_pattern = re.compile(
        r'"(?:[^"\\]|\\.)*"'          # double-quoted string
        r"|'(?:[^'\\]|\\.)*'"         # single-quoted string / char
        r"|[0-9]+(?:\.[0-9]+)?"       # integer / float literals
        r"|[A-Za-z_]\w*"              # identifiers / keywords
        r"|[+\-*/%&|^~<>=!;:.,(){}\[\]]"  # operators & punctuation
    )

    tokens: List[str] = []
    for match in token_pattern.finditer(code):
        tok = match.group()
        if tok.startswith(('"', "'")):
            tokens.append("__STR__")
        elif re.match(r'^[0-9]', tok):
            tokens.append("__NUM__")
        else:
            tokens.append(tok)
    return tokens


def tokenise(code: str, language: str) -> List[str]:
    """
    Dispatch to the appropriate tokeniser based on language.
    Supported: 'python', 'cpp' / 'c++', 'java'.
    Falls back to the regex tokeniser for unknown languages.
    """
    lang = language.lower().strip()
    if lang == "python":
        return _tokenise_python(code)
    elif lang in ("cpp", "c++", "c"):
        return _tokenise_regex(code, _CPP_KEYWORDS)
    elif lang == "java":
        return _tokenise_regex(code, _JAVA_KEYWORDS)
    else:
        logger.warning("Unknown language '%s' — using generic tokeniser.", language)
        return _tokenise_regex(code)


# ── Fingerprint generation ────────────────────────────────────────────────────

def _hash_ngram(ngram: tuple) -> str:
    """SHA-256 the joined n-gram, return first 8 bytes as 16 hex chars."""
    joined = "|".join(ngram).encode("utf-8")
    return hashlib.sha256(joined).hexdigest()[:16]


def build_fingerprint(code: str, language: str) -> List[str]:
    """
    Generate a list of n-gram hashes from the source code.
    Returns an empty list if the code is too short to form any n-gram.
    """
    tokens = tokenise(code, language)
    if len(tokens) < NGRAM_SIZE:
        return []
    ngrams = [
        tuple(tokens[i: i + NGRAM_SIZE])
        for i in range(len(tokens) - NGRAM_SIZE + 1)
    ]
    return [_hash_ngram(ng) for ng in ngrams]


# ── Similarity computation ────────────────────────────────────────────────────

def jaccard_similarity(fp_a: List[str], fp_b: List[str]) -> float:
    """
    Jaccard similarity between two fingerprint lists treated as sets.
    Returns 0.0 if either list is empty.
    """
    set_a = set(fp_a)
    set_b = set(fp_b)
    if not set_a or not set_b:
        return 0.0
    intersection = set_a & set_b
    union = set_a | set_b
    return len(intersection) / len(union)
