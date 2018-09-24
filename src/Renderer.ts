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
  private task: Task;
  private chalk: Chalk;
  private logs: string[] = [];
  private options: IRendererOptions;
  private intervalId: NodeJS.Timer;
  private lastSpinnerUpdate: number;
  private spinnerFrameIndex: number = 0;

  constructor(task: Task, options?: IRendererOptions) {
    if (!options.print) {
      return;
    }

    this.task = task;
    this.options = options;
    this.lastSpinnerUpdate = Date.now();
    this.chalk = new chalk.constructor({ enabled: options.colors });

    process.on('exit', () => {
      this.update();
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
      this.logs.push(args.map(value => toString(value)).join(' '));
    };

    this.update();
    cliCursor.hide();
    this.intervalId = setInterval(() => this.update(), 60);
    this.intervalId.unref();
  }

  private update() {
    if (Date.now() - this.lastSpinnerUpdate >= 60) {
      this.lastSpinnerUpdate = Date.now();
      if (this.spinnerFrameIndex == spinnerFrames.length - 1) {
        this.spinnerFrameIndex = 0;
      } else {
        this.spinnerFrameIndex += 1;
      }
    }

    let text = '';

    text += '\n';
    text += this.getTextAtLevel(this.task, 0);

    text += this.getErrorsText();

    if (this.logs.length) {
      text += '\n';
      text += this.logs.join('\n');
    }

    if (!text.endsWith('\n')) {
      text += '\n';
    }

    logUpdate(text);
  }

  private getErrorsText() {
    let text = '';
    let queue = [...this.task.steps];

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

  private getTextAtLevel(task: Task, level: number) {
    let text = '';

    task.steps.forEach(step => {
      if (step.name) {
        text += ' '.repeat(level * 2);
        text += this.getStepText(step);
        text += '\n';
      }
      if (step.child) {
        text += this.getTextAtLevel(step.child, step.name ? level + 1 : level);
      }
    });

    return text;
  }

  private getStepText(step: Step) {
    let text = '';

    switch (step.status) {
      case StepStatus.Initial:
        text += ' ';
        break;
      case StepStatus.Running:
        text += process.platform == 'win32' || !this.options.animate
          ? this.chalk.yellow(figures.play)
          : this.chalk.yellow(spinnerFrames[this.spinnerFrameIndex]);
        break;
      case StepStatus.Success:
        text += this.chalk.green(figures.tick);
        break;
      case StepStatus.Failure:
        text += this.chalk.red(figures.cross);
        break;
    }
    text += ' ';
    text += step.name;

    if (step.status == StepStatus.Failure && step.errorMessage) {
      text += ' ' + figures.arrowRight + ' ' + this.chalk.red(step.errorMessage);
    } else if (step.info && (step.status == StepStatus.Running || step.status == StepStatus.Failure)) {
      text += ' ' + figures.arrowRight + ' ' + this.chalk.yellow(step.info);
    }

    return text;
  }
}
