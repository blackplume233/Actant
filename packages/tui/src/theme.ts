import chalk from "chalk";
import type { MarkdownTheme, EditorTheme, SelectListTheme } from "@mariozechner/pi-tui";

export const actantSelectListTheme: SelectListTheme = {
  selectedPrefix: (t) => chalk.cyan(t),
  selectedText: (t) => chalk.bold.white(t),
  description: (t) => chalk.dim(t),
  scrollInfo: (t) => chalk.dim(t),
  noMatch: (t) => chalk.dim.italic(t),
};

export const actantEditorTheme: EditorTheme = {
  borderColor: (s) => chalk.cyan(s),
  selectList: actantSelectListTheme,
};

export const actantMarkdownTheme: MarkdownTheme = {
  heading: (t) => chalk.bold.cyan(t),
  link: (t) => chalk.underline.blue(t),
  linkUrl: (t) => chalk.dim.blue(t),
  code: (t) => chalk.yellow(t),
  codeBlock: (t) => chalk.white(t),
  codeBlockBorder: (t) => chalk.dim(t),
  quote: (t) => chalk.italic(t),
  quoteBorder: (t) => chalk.dim.cyan(t),
  hr: (t) => chalk.dim(t),
  listBullet: (t) => chalk.cyan(t),
  bold: (t) => chalk.bold(t),
  italic: (t) => chalk.italic(t),
  strikethrough: (t) => chalk.strikethrough(t),
  underline: (t) => chalk.underline(t),
};

export const actantTheme = {
  editor: actantEditorTheme,
  markdown: actantMarkdownTheme,
  selectList: actantSelectListTheme,
} as const;
