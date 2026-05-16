import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { gitRoot } from "./git.js";

export const DEFAULT_PROMPTS_DIR = join(gitRoot(), ".ralph", "prompts");

export class PromptLoader {
  readonly dir: string;

  constructor(promptsDir?: string) {
    this.dir = promptsDir ?? DEFAULT_PROMPTS_DIR;
  }

  path(name: string): string {
    return join(this.dir, `${name}.md`);
  }

  load(name: string): string {
    const filePath = this.path(name);
    if (!existsSync(filePath)) {
      throw new Error(
        `Ralph prompt template not found: ${filePath}\nExpected markdown files under ${this.dir}/`,
      );
    }
    return `${readFileSync(filePath, "utf-8").trimEnd()}\n`;
  }

  render(name: string, vars: Record<string, string>): string {
    const template = this.load(name);
    return template.replace(/\{(\w+)\}/g, (_, key: string) => {
      if (!(key in vars)) {
        throw new Error(`Missing placeholder in ${name}.md: {${key}}`);
      }
      return vars[key];
    });
  }
}
