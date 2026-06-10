import { join } from "node:path";

export function progressPath(stateDir: string): string {
  return join(stateDir, "progress.txt");
}

export function steeringPath(stateDir: string): string {
  return join(stateDir, "STEERING.md");
}
