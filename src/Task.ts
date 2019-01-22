import * as minimist from 'minimist';
import { Renderer, IRendererOptions } from './Renderer';
import { Step, IStepOptions, IStepState, StepStatus } from './Step';

export default class Task {
  public steps: Step[] = [];
  private options: { [key: string]: any; } = {};
  private stateValues: { [key: string]: any; } = {};

  constructor() {
    let handleError = (err?: Error) => {
      if (this._getCurrentStep()) {
        this._getCurrentStep().failure(err);
      } else if (err) {
        throw err;
      }

      process.exit(1);
    };

    process.on('uncaughtException', handleError);
    process.on('unhandledRejection', handleError);
  }

  add(step: Task | IStepOptions | ((state: IStepState) => void)) {
    if (step instanceof Task) {
      this.steps.push(new Step({
        child: step
      }));
    } else if (step instanceof Function) {
      this.steps.push(new Step({
        exec: step
      }));
    } else {
      // task: ITaskOptions
      this.steps.push(new Step(step));
    }

    return this;
  }

  run(options?: IRendererOptions) {
    new Renderer(this, options);

    return this._execTasks(this);
  }

  withOptions(options: { [key: string]: any; }) {
    let copy = new Task();

    copy.options = options;
    copy.steps = this.steps;
    copy.stateValues = this.stateValues;

    return copy;
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
      await this._execTask(task.steps[i], task.options);
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
          step.failure(err);
        }
      }

      if (step.status == StepStatus.Failure) {
        reject();
      } else if (step.concurrent) {
        resolve();
      } else if (result && result.then instanceof Function && result.catch instanceof Function) {
        result.then(done).catch((err: Error) => step.failure(err));
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

      get: (key: string) => this.stateValues[key],
      set: (key: string, value: any) => this.stateValues[key] = value,

      info: (message: string) => {
        this._getCurrentStep().info = message;
      },
      fail: (message?: Error | string) => {
        this._getCurrentStep().failure(message);

        process.exit(1);
      }
    };
  }
}
