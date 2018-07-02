#!/usr/bin/env node

import Task from './Task';
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

if (task instanceof Task) {
  task.exec({
    print: argv.hasOwnProperty('print') ? argv.print : true,
    colors: argv.hasOwnProperty('colors') ? argv.colors : process.stdout.isTTY,
    animate: argv.hasOwnProperty('animate') ? argv.animate : process.stdout.isTTY,
  });
} else {
  process.stderr.write(`${taskPath} doesn't module.exports a Task instance`);
  process.exit(1);
}
