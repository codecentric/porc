#!/usr/bin/env node
import { RunCommand } from './RunCommand'
import { CliOptions, createConfiguration } from './Config'
import { program } from 'commander'

program
    .name('porc')
    .description('CLI to execute multiple processes in parallel')
    .option('--dry-run')
    .option('--colors')

program
    .command('run')
    .argument('<tasks...>')
    .action(async (tasks) => {
        const options = program.optsWithGlobals()
        const config = await createConfiguration(options)
        return new RunCommand(config).runTasks((tasks || []) as string[]).catch(console.error)
    })

program
    .command('config')
    .action(async (options) => {
        const config = await createConfiguration(options as CliOptions)
        console.log(JSON.stringify(config, undefined, 2))
    })


program.on('command:*', async () => {
    if (program.args) {
        // fallback: try to run args as tasks
        const options = program.optsWithGlobals()
        const config = await createConfiguration(options)
        return new RunCommand(config).runTasks(program.args).catch(console.error)
    }
});

;(async () => {
    await program.parseAsync(process.argv)
})()

