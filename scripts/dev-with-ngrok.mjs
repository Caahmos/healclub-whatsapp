import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const port = getNextPort(args);
const nextArgs = hasPortArg(args) ? ["dev", ...args] : ["dev", "--port", port, ...args];

const children = new Set();
let isShuttingDown = false;

start("next", nextArgs, "next");
start("ngrok", ["http", `http://localhost:${port}`], "ngrok");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(signal));
}

function start(command, args, label) {
  const child = spawn(command, args, {
    env: process.env,
    shell: true,
    stdio: "inherit",
  });

  children.add(child);

  child.on("exit", (code, signal) => {
    children.delete(child);

    if (isShuttingDown) {
      return;
    }

    if (code !== 0 || signal) {
      console.error(
        `[dev] ${label} exited${signal ? ` with signal ${signal}` : ` with code ${code}`}.`,
      );
    }

    shutdown(signal);
  });

  child.on("error", (error) => {
    console.error(`[dev] Failed to start ${label}: ${error.message}`);
    shutdown();
  });

  return child;
}

function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill(signal ?? "SIGTERM");
    }
  }
}

function getNextPort(args) {
  const defaultPort = process.env.PORT ?? "3000";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if ((arg === "-p" || arg === "--port") && args[index + 1]) {
      return args[index + 1];
    }

    if (arg.startsWith("--port=")) {
      return arg.slice("--port=".length);
    }
  }

  return defaultPort;
}

function hasPortArg(args) {
  return args.some((arg) => arg === "-p" || arg === "--port" || arg.startsWith("--port="));
}
