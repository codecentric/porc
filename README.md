= porc

`porc` is a small cli tool to start multiple dependent processes in parallel.

== Installation

```shell
npm install --save-dev porc
```

When using Yarn:

```shell
yarn add -D porc
```

== Configuration

`porc` expects a `.porcrc` somewhere in your current directory or any parent directory.

The file contains all possible targets and may look like this:

```json
{
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

== Usage

```sh
porc next
```
