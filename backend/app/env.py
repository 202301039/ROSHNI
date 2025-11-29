"""
Centralized environment loader for the backend.

`.env` is always loaded first, then `.env.local` overrides it. This matches the
expected Docker vs. local dev workflow: Docker images pick up `.env`, while
local developers drop overrides into `.env.local`.
"""
from __future__ import annotations

from pathlib import Path
from typing import Iterable

from dotenv import load_dotenv

_APP_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _APP_DIR.parent
_PROJECT_ROOT = _BACKEND_DIR.parent
_ENV_LOADED = False

_DEFAULT_ENV_PATHS = (
    _PROJECT_ROOT / ".env",
    _PROJECT_ROOT / ".env.local",
    _BACKEND_DIR / ".env",
    _BACKEND_DIR / ".env.local",
)


def _load_if_exists(path: Path, *, override: bool) -> None:
    if path.exists():
        load_dotenv(path, override=override)


def load_environment(extra_paths: Iterable[Path] | None = None) -> None:
    """Load environment variables once for the process."""

    global _ENV_LOADED
    if _ENV_LOADED:
        return

    for path in _DEFAULT_ENV_PATHS:
        _load_if_exists(path, override=path.name.endswith(".env.local"))

    if extra_paths:
        for path in extra_paths:
            _load_if_exists(path, override=True)

    _ENV_LOADED = True


__all__ = ["load_environment"]
