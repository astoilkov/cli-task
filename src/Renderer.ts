import Task from './Task';
import * as figures from 'figures';
import * as minimist from 'minimist';
import chalk, { Chalk } from 'chalk';
import exitHook = require('exit-hook');
import { format, inspect } from 'util';
import * as logUpdate from 'log-update';
import { Step, StepStatus } from './Step';

// TODO: include https://github.com/sindresorhus/term-size when not enough rows

const argv = minimist(process.argv.slice(2));
const print = argv.hasOwnProperty('print') ? argv.print == 'true' : true;
const colors = argv.hasOwnProperty('colors') ? argv.colors == 'true' : process.stdout.isTTY;
const animate = argv.hasOwnProperty('animate') ? argv.animate == 'true' : process.stdout.isTTY;
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export class Renderer {
  private static _task: Task;
  private static _logs: string[] = [];
  private static _lastRenderedText: string = '';
  private static _spinnerFrameIndex: number = 0;
  private static _chalk: Chalk = new chalk.constructor({ enabled: colors });

  public static play(task: Task) {
    if (!print) {
      return;
    }

    this._task = task;

    this._update();
    this._overrideConsoleLog();
    exitHook(this._exitHook.bind(this));
    setInterval(() => this._update(), 120).unref();
  }

  private static _update() {
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
    this._spinnerFrameIndex = this._spinnerFrameIndex < spinnerFrames.length - 1
      ? this._spinnerFrameIndex + 1
      : 0;
  }

  private static _getErrorsText() {
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

  private static _getTextAtLevel(task: Task, level: number) {
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

  private static _getStepText(step: Step) {
    let text = '';

    switch (step.status) {
      case StepStatus.Running:
        text += process.platform == 'win32' || !animate
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

  private static _exitHook() {
    this._update();

    logUpdate.done();
  }

  private static _overrideConsoleLog() {
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
  }
}
