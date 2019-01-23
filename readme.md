# cli-task
> Task runner for developers minimalists

## Install

```
$ npm install cli-task
```

## Usage

```javascript
const execa = require('execa');
const chalk = require('chalk');
const task = require('cli-task');
const jetpack = require('fs-jetpack');
const tmpPath = path.join(os.tmpdir(), 'dependency-size');

task()
    .add({
        name: 'init npm folder',
        exec: () => {
            return execa('npm', [
                'init',
                '--force'
            ], {
                cwd: tmpPath
            });
        }
    })
    .add({
        name: 'install dependency',
        exec: (state) => {
            return execa('npm', [
                'install',
                state.argv._[0]
            ], {
                cwd: tmpPath
            });
        }
    })
    .add({
        name: 'measure size',
        exec: (state) => {
            return jetpack.inspectTreeAsync(tmpPath).then(tree => {
                console.log(chalk.white(prettyBytes(tree.size)));
            });
        }
    })
    .run();
```

## API

### task.add(options)

Add a step to the task

#### options
Type: `Object`

##### name
Type: `string`

The name of the task to be displayed when being printed on the screen.

##### exec
Type: `Function`

The callback function which will be executed.

### task.run()

Executes the task
