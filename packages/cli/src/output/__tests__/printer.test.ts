import { describe, it, expect, vi, beforeEach } from "vitest";
import chalk from "chalk";
import { CliPrinter, defaultPrinter, type CliOutput } from "../printer";

describe("CliPrinter", () => {
  const mockOutput: CliOutput = {
    log: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(mockOutput.log).mockClear();
    vi.mocked(mockOutput.error).mockClear();
  });

  it("log() delegates to output.log", () => {
    const printer = new CliPrinter(mockOutput);
    printer.log("hello");
    expect(mockOutput.log).toHaveBeenCalledTimes(1);
    expect(mockOutput.log).toHaveBeenCalledWith("hello");
  });

  it("error() delegates to output.error", () => {
    const printer = new CliPrinter(mockOutput);
    printer.error("oops");
    expect(mockOutput.error).toHaveBeenCalledTimes(1);
    expect(mockOutput.error).toHaveBeenCalledWith("oops");
  });

  it("success() calls output.log with chalk.green text", () => {
    const printer = new CliPrinter(mockOutput);
    printer.success("done");
    expect(mockOutput.log).toHaveBeenCalledTimes(1);
    expect(mockOutput.log).toHaveBeenCalledWith(chalk.green("done"));
  });

  it("warn() calls output.log with chalk.yellow text", () => {
    const printer = new CliPrinter(mockOutput);
    printer.warn("careful");
    expect(mockOutput.log).toHaveBeenCalledTimes(1);
    expect(mockOutput.log).toHaveBeenCalledWith(chalk.yellow("careful"));
  });

  it("dim() calls output.log with chalk.dim text", () => {
    const printer = new CliPrinter(mockOutput);
    printer.dim("subtle");
    expect(mockOutput.log).toHaveBeenCalledTimes(1);
    expect(mockOutput.log).toHaveBeenCalledWith(chalk.dim("subtle"));
  });

  it("errorStyled() calls output.error with chalk.red text", () => {
    const printer = new CliPrinter(mockOutput);
    printer.errorStyled("fail");
    expect(mockOutput.error).toHaveBeenCalledTimes(1);
    expect(mockOutput.error).toHaveBeenCalledWith(chalk.red("fail"));
  });

  it("errorDim() calls output.error with chalk.dim text", () => {
    const printer = new CliPrinter(mockOutput);
    printer.errorDim("hint");
    expect(mockOutput.error).toHaveBeenCalledTimes(1);
    expect(mockOutput.error).toHaveBeenCalledWith(chalk.dim("hint"));
  });

  it("defaultPrinter exists and uses console", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    defaultPrinter.log("test");
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("test");
    logSpy.mockRestore();
  });

  it("custom output injection works", () => {
    const printer = new CliPrinter(mockOutput);
    printer.log("a");
    printer.error("b");
    expect(mockOutput.log).toHaveBeenCalledWith("a");
    expect(mockOutput.error).toHaveBeenCalledWith("b");
  });
});
