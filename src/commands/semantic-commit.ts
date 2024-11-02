import { window, workspace, ExtensionContext, QuickPickItem } from 'vscode';

import { getConfiguration, ConfigurationProperties } from '../config';
import { Git } from '../git';
import { workspaceStorageKey, scopeTemplatePlaceholder } from '../constants';
import { Command } from './common';

const enum ActionType {
  scope = 'scope',
  subject = 'subject',
  command = 'command'
}

class CommitType {
  type: string;
  description: string;
  emoji: string;
  standalone: boolean;

  constructor(type: string, description: string, emoji: string, standalone: boolean = false) {
    this.type = type;
    this.description = description;
    this.emoji = emoji;
    this.standalone = standalone;
  }

  get displayType(): string {
    const isEmojiWithCommit = getConfiguration()[ConfigurationProperties.useEmojiWithCommit];
    return this.emoji && isEmojiWithCommit ? `${this.emoji} ${this.type}` : this.type;
  }

  isStandalone(): boolean {
    return this.standalone;
  }
}

const scopeStorageKey = `${workspaceStorageKey}:scope`;

export class SemanticCommitCommand extends Command {
  identifier = 'semanticCommit';

  context: ExtensionContext;
  scope: string = "";
  commitTypes: CommitType[] = [];

  constructor(context: ExtensionContext) {
    super();

    this.context = context;
    this.loadSettings();
    workspace.onDidChangeConfiguration(() => this.loadSettings());
  }

  private loadSettings() {
    this.scope = this.getScope();
    this.commitTypes = this.retrieveCommitTypes();
  }

  private retrieveCommitTypes(): CommitType[] {
    const configTypes = getConfiguration()[ConfigurationProperties.types];
    return configTypes.map((item: any) => new CommitType(item.type, item.description, item.emoji, item.standalone));
  }

  async execute() {
    await Git.exists();

    const quickPick = this.createQuickPick(this.createQuickPickItems());
    quickPick.show();

    quickPick.onDidHide(() => {
      if (!this.isPreserveScopeEnabled) {
        this.scope = '';
      }
    });

    quickPick.onDidChangeSelection(async (items: any) => {
      if (items.length > 0) {
        const [{ actionType }] = items;

        if (actionType === ActionType.scope) {
          this.scope = quickPick.value;
          this.context.workspaceState.update(scopeStorageKey, this.scope);

          quickPick.value = '';
          quickPick.items = this.createQuickPickItems();
        } else {
          const [{ type, standalone }] = items;
          const subject = quickPick.value;
          await this.performCommit(type, actionType, standalone, subject);
          quickPick.hide();
        }
      }
    });
  }

  private get isPreserveScopeEnabled() {
    return getConfiguration()[ConfigurationProperties.preserveScope];
  }

  private get isStageAllEnabled() {
    return getConfiguration()[ConfigurationProperties.stageAll];
  }

  private get scopeTemplate() {
    const template = getConfiguration()[ConfigurationProperties.scopeTemplate];
    return template.length ? template : scopeTemplatePlaceholder;
  }

  private get hasScope() {
    return this.scope.length > 0;
  }

  private getScope() {
    return this.isPreserveScopeEnabled
      ? this.context.workspaceState.get(scopeStorageKey, '')
      : '';
  }

  private getTypes() {
    return [...getConfiguration()[ConfigurationProperties.types].sort()];
  }

  private getCommitOptions() {
    return getConfiguration()[ConfigurationProperties.commitOptions].split(' ');
  }

  private createQuickPick(items: QuickPickItem[]) {
    const quickPick = window.createQuickPick();

    quickPick.items = [...items];
    quickPick.placeholder = 'Type a value (scope or subject)';
    quickPick.ignoreFocusOut = true;

    return quickPick;
  }

  private createQuickPickItems(): QuickPickItem[] {
    const typeItems = this.commitTypes.map(item => {
      return ({
        label: `$(git-commit) Commit with "${item.displayType}" type`,
        alwaysShow: true,
        actionType: ActionType.subject,
        type: item.displayType,
        description: item.description,
        standalone: item.standalone
      });
    });

    return [
      {
        label: this.hasScope
          ? `$(gist-new) Change the message scope`
          : `$(gist-new) Add a message scope`,
        alwaysShow: true,
        actionType: ActionType.scope,
        type: '',
        description: this.hasScope ? `current: "${this.scope}"` : '',
        standalone: false
      },
      ...typeItems,
      {
        label: `$(check) Commit with an empty message`,
        alwaysShow: true,
        actionType: ActionType.command,
        type: 'emptyMessageCommand',
        description: '',
        standalone: true
      }
    ];
  }

  private async performCommit(type: string, actionType: ActionType, standalone: boolean, subject: string) {
    if (actionType === ActionType.command) {
      if (type === 'emptyMessageCommand') {
        await Git.emptyCommit();
      }
      return;
    }

    if (standalone) {
      await this.commitAction(type);
      return;
    }

    if (subject.length > 0) {
      const scope = this.hasScope
        ? this.scopeTemplate.replace(scopeTemplatePlaceholder, this.scope)
        : '';
      let message = "";
      if (subject.length > 0)
        message = `${type}${scope}: ${subject}`;
      else
        message = type;

      await this.commitAction(message);
    }
    else {

      window.showErrorMessage('The message subject cannot be empty!');
    }
  }

  private async commitAction(message: string) {
    let thereFilesToCommit = true;
    if (this.isStageAllEnabled) {
      try {
        await Git.add();
      } catch ({ message }) {
        window.showErrorMessage(message);
        thereFilesToCommit = false;
      }
    }

    if (thereFilesToCommit) {
      try {
        await Git.commit(message, this.getCommitOptions());
      } catch ({ message }) {
        window.showErrorMessage(message);
      }
    }
  }
}
