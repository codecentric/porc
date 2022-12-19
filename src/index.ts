import yargs from 'yargs'
import { RunCommand } from './RunCommand'
import { createConfiguration } from './Config'

yargs(process.argv.slice(2))
    .scriptName('porc')
    .usage('$0 run [task]')
    .command({
        command: 'run <task>',
        describe: 'Runs the command',
        builder: (deliveredYargs) =>
            deliveredYargs
                .positional('task', {
                    describe: 'The task',
                    type: 'string',
                    demandOption: true
                })
                .options({
                    'dry-run': {
                        describe: 'Only shows the tasks to be run',
                        type: 'boolean',
                    },
                    'colors': {
                        describe: 'Render colored terminal output',
                        type: 'boolean',
                    }
                }),
        handler: async ({ task, dryRun, colors }) => {
            const config = await createConfiguration({ dryRun, colors })
            return new RunCommand(config).execute(task).catch(console.error)
        }
    })
    .demandCommand().argv


