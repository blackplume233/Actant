import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { isWindows } from "@actant/shared";
import type { CliPrinter } from "../../../output/index";

export async function configureAutostart(printer: CliPrinter): Promise<void> {
  printer.log(`\n${chalk.cyan("[ Step 5/7 ]")} ${chalk.bold("配置自动启动")}\n`);

  const platform = process.platform;
  const platformName = platform === "win32" ? "Windows" : platform === "darwin" ? "macOS" : "Linux";
  printer.log(`  检测到平台: ${chalk.bold(platformName)}`);

  const enable = await confirm({
    message: "配置 Actant Daemon 开机自启?",
    default: true,
  });

  if (!enable) {
    printer.dim("  跳过自动启动配置");
    return;
  }

  try {
    if (isWindows()) {
      configureWindows(printer);
    } else if (platform === "darwin") {
      configureMacOS(printer);
    } else {
      configureLinux(printer);
    }
    printer.success("✓ 自动启动已配置");
  } catch (err) {
    printer.warn(`  ⚠ 自动启动配置失败: ${err instanceof Error ? err.message : String(err)}`);
    printer.dim("  你可以稍后手动配置自动启动");
  }
}

function configureWindows(printer: CliPrinter): void {
  printer.log(chalk.dim("  正在注册 Windows Task Scheduler 任务..."));

  const actantPath = findActantExecutable();
  const taskXml = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
  </Settings>
  <Actions>
    <Exec>
      <Command>${actantPath}</Command>
      <Arguments>daemon start</Arguments>
    </Exec>
  </Actions>
</Task>`;

  const tempXmlPath = join(process.env["TEMP"] || homedir(), "actant-task.xml");
  writeFileSync(tempXmlPath, taskXml, "utf-16le");

  execSync(`schtasks /Create /TN "ActantDaemon" /XML "${tempXmlPath}" /F`, { stdio: "pipe" });
  printer.dim("  已注册任务: ActantDaemon (登录时自动启动)");
}

function configureMacOS(printer: CliPrinter): void {
  printer.log(chalk.dim("  正在生成 launchd plist..."));

  const actantPath = findActantExecutable();
  const plistDir = join(homedir(), "Library", "LaunchAgents");
  mkdirSync(plistDir, { recursive: true });

  const plistPath = join(plistDir, "com.actant.daemon.plist");
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.actant.daemon</string>
  <key>ProgramArguments</key>
  <array>
    <string>${actantPath}</string>
    <string>daemon</string>
    <string>start</string>
    <string>--foreground</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${join(homedir(), ".actant", "logs", "daemon-stdout.log")}</string>
  <key>StandardErrorPath</key>
  <string>${join(homedir(), ".actant", "logs", "daemon-stderr.log")}</string>
</dict>
</plist>`;

  writeFileSync(plistPath, plist);
  execSync(`launchctl load "${plistPath}"`, { stdio: "pipe" });
  printer.dim(`  已加载: ${plistPath}`);
}

function configureLinux(printer: CliPrinter): void {
  printer.log(chalk.dim("  正在生成 systemd user service..."));

  const actantPath = findActantExecutable();
  const serviceDir = join(homedir(), ".config", "systemd", "user");
  mkdirSync(serviceDir, { recursive: true });

  const servicePath = join(serviceDir, "actant-daemon.service");
  const unit = `[Unit]
Description=Actant Daemon — AI Agent Platform
After=network.target

[Service]
Type=simple
ExecStart=${actantPath} daemon start --foreground
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
`;

  writeFileSync(servicePath, unit);
  execSync("systemctl --user daemon-reload", { stdio: "pipe" });
  execSync("systemctl --user enable actant-daemon.service", { stdio: "pipe" });
  printer.dim(`  已启用: actant-daemon.service`);
}

function findActantExecutable(): string {
  try {
    const result = execSync(isWindows() ? "where.exe actant" : "which actant", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const first = result.trim().split("\n")[0];
    return first ? first.trim() : "actant";
  } catch {
    return "actant";
  }
}
