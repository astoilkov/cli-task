import { types } from 'util';
import * as minimist from 'minimist';
import { Renderer } from './Renderer';
import { Step, IStepOptions, IStepState, StepStatus } from './Step';

export default class Task {
  public steps: Step[] = [];

  private _options: { [key: string]: any; } = {};
  private _stateValues: { [key: string]: any; } = {};

  constructor() {
    process.on('uncaughtException', (err) =>
      this._errorOut(this._getCurrentStep(), err)
    );
    process.on('unhandledRejection', (message) =>
      this._errorOut(this._getCurrentStep(), message)
    );
  }

  add(value: Task | IStepOptions | ((state: IStepState) => void)) {
    if (value instanceof Task) {
      this.steps.push(new Step({
        child: value
      }));
    } else if (value instanceof Function) {
      this.steps.push(new Step({
        exec: value
      }));
    } else {
      this.steps.push(new Step(value));
    }

    return this;
  }

  withOptions(options: { [key: string]: any; }) {
    let copy = new Task();

    copy._options = options;
    copy.steps = this.steps;
    copy._stateValues = this._stateValues;

    return copy;
  }

  run() {
    Renderer.play(this);

    return this._execTasks(this);
  }

  private _errorOut(step: Step, err?: Error | string | {}) {
    process.exitCode = 1

    if (step) {
      step.failure(err)
    } else if (types.isNativeError(err)) {
      throw err
    }
  }

  private _getCurrentStep() {
    let queue = this.steps.slice();

    while (queue.length) {
      let step = queue.pop();

      if (step.status == StepStatus.Running || step.status == StepStatus.Failure) {
        if (step.child) {
          queue.push(...step.child.steps);
        } else {
          return step;
        }
      }
    }
  }

  private async _execTasks(task: Task) {
    for (let i = 0; i < task.steps.length; i++) {
      await this._execTask(task.steps[i], task._options);
    }
  }

  private _execTask(step: Step, options: { [key: string]: any }) {
    return new Promise((resolve, reject) => {
      step.start();

      let done = () => {
        step.success();
        resolve();
      };

      let result: any;
      if (step.exec) {
        try {
          result = step.exec(this._generateState(options));
        } catch (err) {
          this._errorOut(step, err)
        }
      }

      if (step.status == StepStatus.Failure) {
        reject();
      } else if (step.concurrent) {
        resolve();
      } else if (result && result.then instanceof Function && result.catch instanceof Function) {
        result.then(done).catch((err: Error) => this._errorOut(step, err));
      } else if (step.child) {
        this._execTasks(step.child).then(done);
      } else {
        done();
      }
    });
  }

  private _generateState(options: { [key: string]: any }): IStepState {
    let index = process.argv.indexOf('--');
    let argv: minimist.ParsedArgs;

    if (index == -1) {
      argv = minimist([]);
    } else {
      argv = minimist(process.argv.slice(index + 1));
    }

    return {
      argv: argv,
      options: options,

      get: (key: string) => this._stateValues[key],
      set: (key: string, value: any) => this._stateValues[key] = value,

      info: (message: string) => {
        this._getCurrentStep().info = message;
      },
      fail: (message?: Error | string) => {
        this._errorOut(this._getCurrentStep(), message)
      }
    };
  }
}
