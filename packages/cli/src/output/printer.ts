import chalk from "chalk";

/**
 * Abstraction for CLI terminal output, replacing direct console.log/error usage.
 * Inject a custom CliOutput for testing or format switching.
 */
export interface CliOutput {
  log(message: string): void;
  error(message: string): void;
}

const consoleOutput: CliOutput = {
  log: (msg: string) => {
    console.log(msg);
  },
  error: (msg: string) => {
    console.error(msg);
  },
};

export class CliPrinter {
  private readonly out: CliOutput;

  constructor(output?: CliOutput) {
    this.out = output ?? consoleOutput;
  }

  log(text: string): void {
    this.out.log(text);
  }

  error(text: string): void {
    this.out.error(text);
  }

  success(text: string): void {
    this.out.log(chalk.green(text));
  }

  warn(text: string): void {
    this.out.log(chalk.yellow(text));
  }

  dim(text: string): void {
    this.out.log(chalk.dim(text));
  }

  errorStyled(text: string): void {
    this.out.error(chalk.red(text));
  }

  errorDim(text: string): void {
    this.out.error(chalk.dim(text));
  }
}

export const defaultPrinter = new CliPrinter();
