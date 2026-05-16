import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Handlebars from "handlebars";
import { gitRoot } from "./git.js";

export const DEFAULT_PROMPTS_DIR = join(gitRoot(), ".ralph", "prompts");
export const PROMPTS_PARTIALS_SUBDIR = "partials";

/** Template context: strings, numbers, booleans for {{#if}}, etc. */
export type PromptContext = Record<string, unknown>;

export class PromptLoader {
  readonly dir: string;
  private readonly hbs = Handlebars.create();
  private readonly compiled = new Map<string, Handlebars.TemplateDelegate>();
  private partialsRegistered = false;

  constructor(promptsDir?: string) {
    this.dir = promptsDir ?? DEFAULT_PROMPTS_DIR;
  }

  path(name: string): string {
    return join(this.dir, `${name}.md`);
  }

  partialPath(name: string): string {
    return join(this.dir, PROMPTS_PARTIALS_SUBDIR, `${name}.md`);
  }

  /** Raw template source (no Handlebars). */
  load(name: string): string {
    const filePath = this.path(name);
    if (!existsSync(filePath)) {
      throw new Error(
        `Ralph prompt template not found: ${filePath}\nExpected markdown files under ${this.dir}/`,
      );
    }
    return `${readFileSync(filePath, "utf-8").trimEnd()}\n`;
  }

  /** Raw partial source from `partials/<name>.md`. */
  loadPartial(name: string): string {
    const filePath = this.partialPath(name);
    if (!existsSync(filePath)) {
      throw new Error(
        `Ralph prompt partial not found: ${filePath}\nExpected markdown files under ${join(this.dir, PROMPTS_PARTIALS_SUBDIR)}/`,
      );
    }
    return `${readFileSync(filePath, "utf-8").trimEnd()}\n`;
  }

  private registerPartials(): void {
    if (this.partialsRegistered) return;
    if (!existsSync(this.dir)) {
      throw new Error(`Prompts directory not found: ${this.dir}`);
    }
    const partialsDir = join(this.dir, PROMPTS_PARTIALS_SUBDIR);
    if (!existsSync(partialsDir)) {
      this.partialsRegistered = true;
      return;
    }
    for (const entry of readdirSync(partialsDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) {
        continue;
      }
      const name = entry.name.replace(/\.md$/, "");
      this.hbs.registerPartial(name, this.loadPartial(name));
    }
    this.partialsRegistered = true;
  }

  private compile(name: string): Handlebars.TemplateDelegate {
    const cached = this.compiled.get(name);
    if (cached) return cached;
    this.registerPartials();
    const template = this.hbs.compile(this.load(name), { noEscape: true });
    this.compiled.set(name, template);
    return template;
  }

  /** Render a template with Handlebars (variables, {{#if}}, {{> partial}}). */
  render(name: string, context: PromptContext): string {
    try {
      const out = this.compile(name)(context);
      return out.endsWith("\n") ? out : `${out}\n`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to render ${name}.md: ${msg}`);
    }
  }

  /** Clear compiled cache (e.g. after editing templates in a long-lived process). */
  clearCache(): void {
    this.compiled.clear();
    this.partialsRegistered = false;
  }
}
