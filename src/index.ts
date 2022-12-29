#!/usr/bin/env node
import { RunCommand } from './RunCommand'
import { CliOptions, createConfiguration } from './Config'
import { program } from 'commander'
import { UI } from './ui'

program
    .name('porc')
    .description('CLI to execute multiple processes in parallel')
    .option('-d, --dry-run', 'don\'t actually execute the statements')
    .option('-c, --colors', 'render colored output to terminal')
    .option('-nc, --no-colors', 'disable rendering of colors')
    .option('-f, --focus', 'only show standard output of directly requested tasks')
    .option('-nf, --no-focus', 'show standard output by default')
    .option('-v, --verbose', 'verbose output')

program
    .command('run')
    .argument('<tasks...>')
    .description('execute given tasks')
    .option('--ui', 'start user interface')
    .option('--no-ui', 'just render to console')
    .action(async (tasks, opts) => {
        const globals = program.optsWithGlobals()
        const config = await createConfiguration({ ...globals, ...opts }, tasks)
        const theTasks = (tasks || []) as string[]
        const command = new RunCommand(config)
        if (opts.ui) {
            return await new UI(command, config).perform(theTasks)
        }
        await command.perform(theTasks).catch(console.error)
    })

program
    .command('config')
    .description('show the configuration')
    .action(async (options) => {
        const config = await createConfiguration(options as CliOptions)
        console.log(JSON.stringify(config, undefined, 2))
    })

// eslint-disable-next-line @typescript-eslint/no-misused-promises
program.on('command:*', async () => {
    const tasks = program.args
    if (tasks.length > 0) {
        // fallback: try to run args as tasks
        const options = program.optsWithGlobals()
        const config = await createConfiguration(options, tasks)
        await new RunCommand(config).perform(tasks).catch(console.error)
    }
})

void (async () => {
    await program.parseAsync(process.argv)
})()
