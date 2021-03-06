#!/usr/bin/env node

import { join } from 'path';
import { accessSync } from 'fs';
import * as minimist from 'minimist';

let argv = minimist(process.argv.slice(2));
let taskName = argv._[0];
let taskPath = join(process.cwd(), 'tasks', taskName + '.js');

try {
  accessSync(taskPath);
} catch (err) {
  process.stderr.write(`the task file path doesn't exist: ${taskPath}`);
  process.exit(1);
}

let task = require(taskPath.replace(/.js$/, ''));

if (task && isTask(task.default)) {
  task = task.default;
}

if (isTask(task)) {
  // update argv to enable changing arguments from the loaded task
  argv = minimist(process.argv.slice(2));

  task.run({
    print: argv.hasOwnProperty('print') ? argv.print == 'true' : true,
    colors: argv.hasOwnProperty('colors') ? argv.colors == 'true' : process.stdout.isTTY,
    animate: argv.hasOwnProperty('animate') ? argv.animate == 'true' : process.stdout.isTTY,
  });
} else {
  process.stderr.write(`${taskPath} doesn't module.exports a Task instance`);
  process.exit(1);
}

function isTask(obj: any) {
  return obj && typeof obj.add == 'function' &&
    typeof obj.withOptions == 'function' && Array.isArray(obj.steps);
}
