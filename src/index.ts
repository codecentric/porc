import yargs from 'yargs'
import { RunCommand } from './RunCommand'
import { CliOptions, createConfiguration } from './Config'

yargs(process.argv.slice(2))
    .scriptName('porc')
    .usage('$0 run [task]')
    .options({
        'dry-run': {
            describe: 'Only shows the tasks to be run',
            type: 'boolean',
        },
        'colors': {
            describe: 'Render colored terminal output',
            type: 'boolean',
        }
    })
    .command({
        command: 'run <task>',
        describe: 'Runs the given task',
        builder: (deliveredYargs) =>
            deliveredYargs
                .positional('task', {
                    describe: 'The task',
                    type: 'string',
                    demandOption: true
                }),
        handler: async ({ task, dryRun, colors }) => {
            const config = await createConfiguration({ dryRun, colors })
            return new RunCommand(config).execute(task).catch(console.error)
        }
    })
    .command({
        command: 'config',
        describe: 'Shows the current configuration',
        handler: async (options) => {
            const config = await createConfiguration(options as CliOptions)
            console.log(JSON.stringify(config, undefined, 2))
        }
    })
    .demandCommand().argv
