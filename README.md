# porc

`porc` is a small cli tool to start multiple dependent processes in parallel. 
Primary use case is starting multiple dependent web services for local development.

## Installation

```shell
npm install --save-dev porc
```

When using Yarn:

```shell
yarn add -D porc
```

## Configuration

`porc` expects a `.porcrc` somewhere in your current directory or any parent directory.

The file contains all possible targets and may look like this:

```json
{
    "$schema": "https://raw.githubusercontent.com/codecentric/porc/master/porc-schema.json",
    "tasks": {
        "shared": {
            "exec": "echo Shared"
        },
        "first": {
            "dependsOn": ["shared"],
            "exec": "echo Test >&2; sleep 2; echo Done",
            "waitFor": {
                "stderr": "Test",
                "timeout": 500
            }
        },
        "second": {
            "dependsOn": ["shared"],
            "exec": "echo Some second output"
        },
        "next": {
            "dependsOn": ["first", "second"]
        }
    }
}
```

The documentation is still in progress. Please check the [schema](https://github.com/codecentric/porc/blob/master/porc-schema.json) for now.

## Usage

Calling `porc` without arguments or with `-h` or `--help` returns a help text: 

```
$ porc --help

Usage: porc [options] [command]

CLI to execute multiple processes in parallel

Options:
  -d, --dry-run     don't actually execute the statements
  -c, --colors      render colored output to terminal
  -nc, --no-colors  disable rendering of colors
  -f, --focus       only show standard output of directly requested tasks
  -nf, --no-focus   show standard output by default
  -v, --verbose     verbose output
  -h, --help        display help for command

Commands:
  run <tasks...>    execute given tasks
  config            show the configuration
  help [command]    display help for command
```

Running a task:

```shell
porc run next

# or shorter:
porc next
```

Printing out the computed configuration:

```shell
porc config
```

