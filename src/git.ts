import { workspace } from 'vscode';

const util = require('util');
const exec = util.promisify(require('child_process').exec);

export class Git {
  static exists() {
    return this.execute('', ['--version']);
  }

  static commit(message: string) {
    return this.execute('commit', [`--message=${message}`, '--quiet', '--all']);
  }

  private static execute(command?: string, options: string[] = []) {
    const { rootPath: cwd } = workspace;

    return exec(`git ${command} ${options.join(' ')}`, { cwd });
  }
}
