const util = require('util');
const exec = util.promisify(require('child_process').exec);

import { getWorkspaceFolder } from './workspace';

export class Git {
  static exists() {
    return this.execute(getWorkspaceFolder(), '', ['--version']);
  }

  static async add() {
    const { stdout: changes } = await this.diff(['--cached']);

    if (changes.length === 0) {
      await this.execute(getWorkspaceFolder(), 'add', [`--all`]);
      const { stdout: changes } = await this.diff(['--cached']);
      if (changes.length === 0) {
        throw new Error("No files were added to staging.");
      }
    }
  }

  static async commit(message: string, options: string[]) {
    return this.execute(getWorkspaceFolder(), 'commit', [`--message="${message}"`, ...options]);
  }

  static execute(cwd: string, command?: string, options: string[] = []) {
    return exec(`git ${command} ${options.join(' ')}`, { cwd });
  }

  private static async diff(options: string[] = []) {
    return this.execute(getWorkspaceFolder(), 'diff', [...options]);
  }

  static async emptyCommit(message: string = 'nothing to see here') {
    return this.execute(getWorkspaceFolder(), 'commit', ['--allow-empty', `-m "${message}"`]);
  }
}
