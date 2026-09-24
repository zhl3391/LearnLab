import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const web = resolve(root, 'web');

if (typeof process.loadEnvFile === 'function' && existsSync(resolve(root, '.env'))) {
  process.loadEnvFile(resolve(root, '.env'));
}

const apiPort = process.env.PORT ?? '3000';
const webPort = process.env.WEB_PORT ?? '3000';
const tasks = [
  {
    name: 'api',
    bin: resolve(root, 'node_modules/@nestjs/cli/bin/nest.js'),
    args: ['start', '--watch'],
    cwd: root,
    url: `http://localhost:${apiPort}`,
  },
  {
    name: 'web',
    bin: resolve(web, 'node_modules/next/dist/bin/next'),
    args: ['dev', '--port', webPort],
    cwd: web,
    url: `http://localhost:${webPort}`,
  },
];

const children = [];
let stopping = false;
let exitCode = 0;
let forceStopTimer;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  exitCode = code;
  console.log('\nStopping LearnLab services...');

  for (const child of children) terminate(child, 'SIGTERM');

  if (children.length === 0) {
    process.exitCode = exitCode;
    return;
  }

  forceStopTimer = setTimeout(() => {
    for (const child of children) terminate(child, 'SIGKILL');
  }, 5000);
  forceStopTimer.unref();
}

function terminate(child, signal) {
  if (child.exitCode !== null || child.killed) return;
  try {
    if (process.platform === 'win32') child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

for (const task of tasks) {
  if (!existsSync(task.bin)) {
    console.error(`Dependencies missing for ${task.name}. Run npm install in ${task.cwd}.`);
    stop(1);
    break;
  }

  const child = spawn(process.execPath, [task.bin, ...task.args], {
    cwd: task.cwd,
    env: process.env,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
  });
  child.name = task.name;
  children.push(child);

  child.once('error', (error) => {
    console.error(`${task.name} failed to start: ${error.message}`);
    stop(1);
  });
  child.once('exit', (code, signal) => {
    child.exited = true;
    if (!stopping) {
      console.error(`${task.name} stopped${signal ? ` (${signal})` : ` with exit code ${code}`}.`);
      stop(code ?? 1);
    }
    if (stopping && children.every((entry) => entry.exited)) {
      clearTimeout(forceStopTimer);
      process.exitCode = exitCode;
    }
  });

  console.log(`${task.name.toUpperCase()} starting: ${task.url}`);
}
