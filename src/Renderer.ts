import Task from './Task';
import * as figures from 'figures';
import { format, inspect } from 'util';
import * as cliCursor from 'cli-cursor';
import * as logUpdate from 'log-update';
import chalk, { Chalk } from 'chalk';
import { Step, StepStatus } from './Step';

// TODO: include https://github.com/sindresorhus/term-size when not enough rows

const spinnerFrames = [
  '⠋',
  '⠙',
  '⠹',
  '⠸',
  '⠼',
  '⠴',
  '⠦',
  '⠧',
  '⠇',
  '⠏'
];

export interface IRendererOptions {
  print?: boolean;
  colors?: boolean;
  animate?: boolean;
}

export class Renderer {
  private _task: Task;
  private _chalk: Chalk;
  private _logs: string[] = [];
  private _options: IRendererOptions;
  private _intervalId: NodeJS.Timer;
  private _lastRenderedText: string;
  private _lastSpinnerUpdate: number;
  private _spinnerFrameIndex: number = 0;

  constructor(task: Task, options?: IRendererOptions) {
    if (!options.print) {
      return;
    }

    this._task = task;
    this._options = options;
    this._lastSpinnerUpdate = Date.now();
    this._chalk = new chalk.constructor({ enabled: options.colors });

    process.on('exit', () => {
      this._update();
      cliCursor.show();
    });

    console.log = (...args: any[]) => {
      let toString = (value: any) => {
        if (typeof value == 'string') {
          return format(value);
        } else {
          return inspect(value, { colors: true });
        }
      }
      this._logs.push(args.map(value => toString(value)).join(' '));
    };

    this._update();
    cliCursor.hide();
    this._intervalId = setInterval(() => this._update(), 60);
    this._intervalId.unref();
  }

  private _update() {
    if (Date.now() - this._lastSpinnerUpdate >= 60) {
      this._lastSpinnerUpdate = Date.now();
      if (this._spinnerFrameIndex == spinnerFrames.length - 1) {
        this._spinnerFrameIndex = 0;
      } else {
        this._spinnerFrameIndex += 1;
      }
    }

    let text = '';

    text += '\n';

    text += this._getTextAtLevel(this._task, 0);

    text += this._getErrorsText();

    if (this._logs.length) {
      text += '\n';
      text += this._logs.join('\n');
    }

    if (!text.endsWith('\n')) {
      text += '\n';
    }

    if (this._lastRenderedText != text) {
      logUpdate(text);
    }

    this._lastRenderedText = text;
  }

  private _getErrorsText() {
    let text = '';
    let queue = [...this._task.steps];

    while (queue.length) {
      let step = queue.pop();

      if (step.error) {
        text += inspect(step.error, { colors: true });
      }

      if (step.child) {
        queue.push(...step.child.steps);
      }
    }

    return text;
  }

  private _getTextAtLevel(task: Task, level: number) {
    let text = '';

    task.steps.forEach(step => {
      if (step.name) {
        text += ' '.repeat(level * 2);
        text += this._getStepText(step);
        text += '\n';
      }
      if (step.child) {
        text += this._getTextAtLevel(step.child, step.name ? level + 1 : level);
      }
    });

    return text;
  }

  private _getStepText(step: Step) {
    let text = '';

    switch (step.status) {
      case StepStatus.Running:
        text += process.platform == 'win32' || !this._options.animate
          ? this._chalk.yellow(figures.play)
          : this._chalk.yellow(spinnerFrames[this._spinnerFrameIndex]);
        break;
      case StepStatus.Success:
        text += this._chalk.green(figures.tick);
        break;
      case StepStatus.Failure:
        text += this._chalk.red(figures.cross);
        break;
    }

    text += ' ';

    text += step.name;

    if (step.status == StepStatus.Failure && step.errorMessage) {
      text += ' ' + figures.arrowRight + ' ' + this._chalk.red(step.errorMessage);
    } else if (step.info && (step.status == StepStatus.Running || step.status == StepStatus.Failure)) {
      text += ' ' + figures.arrowRight + ' ' + this._chalk.yellow(step.info);
    }

    return text;
  }
}
