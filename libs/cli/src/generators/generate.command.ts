import { Command, CommandRunner } from 'nest-commander';
import { GenDockerComposeCommand } from './sub/gen-docker-compose.command';


@Command({
  name: 'generate',
  aliases: ['g'],
  description: 'Generates application resources',
  subCommands: [
    GenDockerComposeCommand,
    // other subcommands
  ],
})
export class GenerateCommand extends CommandRunner {
  async run(): Promise<void> {
    console.log('Please specify a resource to generate. Example: zerly g docker');
    // Тут можна викликати this.command.help(), якщо хочете автоматично показати довідку
  }
}
