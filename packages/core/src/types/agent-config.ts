export interface InstalledAgent {
  name: string;
  description: string;
  model?: string;
  memory?: string;
  filePath: string;
}

export interface InstalledSkill {
  name: string;
  description: string;
  context?: string;
  agent?: string;
  allowedTools?: string[];
  dirPath: string;
}

export interface InstalledConfig {
  agents: InstalledAgent[];
  skills: InstalledSkill[];
}
