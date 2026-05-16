"""Load and render Ralph loop prompt templates from markdown files."""

from __future__ import annotations

from pathlib import Path

DEFAULT_PROMPTS_DIR = Path(__file__).resolve().parent.parent / ".ralph" / "prompts"


class PromptLoader:
    """Read ``.md`` templates from a directory; substitute ``{placeholders}`` via str.format."""

    def __init__(self, prompts_dir: Path | None = None) -> None:
        self.dir = (prompts_dir or DEFAULT_PROMPTS_DIR).resolve()

    def path(self, name: str) -> Path:
        return self.dir / f"{name}.md"

    def load(self, name: str) -> str:
        path = self.path(name)
        if not path.is_file():
            raise FileNotFoundError(
                f"Ralph prompt template not found: {path}\n"
                f"Expected markdown files under {self.dir}/"
            )
        return path.read_text(encoding="utf-8").rstrip() + "\n"

    def render(self, name: str, **kwargs: str) -> str:
        try:
            return self.load(name).format(**kwargs)
        except KeyError as exc:
            raise KeyError(f"Missing placeholder in {name}.md: {exc}") from exc
