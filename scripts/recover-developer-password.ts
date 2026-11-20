import 'dotenv/config';
import readline from 'node:readline';
import { DevAuthService } from '../server/devAuth';

function readHiddenLine(promptText: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    if (!stdin.isTTY) {
      const rl = readline.createInterface({ input: stdin, output: stdout });
      rl.question(promptText, (answer) => {
        rl.close();
        resolve(answer);
      });
      return;
    }

    stdout.write(promptText);
    stdin.resume();
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');

    let value = '';
    const onData = (ch: string) => {
      if (ch === '\r' || ch === '\n' || ch === '\u0004') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        stdout.write('\n');
        resolve(value);
        return;
      }
      if (ch === '\u0003') {
        stdin.setRawMode(false);
        stdout.write('\nCancelled.\n');
        process.exit(1);
      }
      if (ch === '\u007f' || ch === '\b') {
        if (value.length > 0) {
          value = value.slice(0, -1);
        }
        return;
      }
      value += ch;
    };

    stdin.on('data', onData);
  });
}

async function run() {
  const envPassword = (process.env.DEVELOPER_RECOVERY_PASSWORD || '').trim();
  const dataDir = process.env.DEVELOPER_AUTH_DATA_DIR || undefined;
  const service = new DevAuthService({ dataDir });

  let recoveryPassword = envPassword;
  if (!recoveryPassword) {
    console.log('Hari Kripa Fruit ERP — Private Server-Side Developer Password Recovery');
    console.log('This utility runs locally on the server host only.');
    const first = (await readHiddenLine('Enter new Developer password (min 8 chars): ')).trim();
    const confirm = (await readHiddenLine('Confirm new Developer password: ')).trim();
    if (first !== confirm) {
      console.error('Error: Passwords do not match.');
      process.exit(1);
    }
    recoveryPassword = first;
  }

  const result = await service.recoverPasswordFromServerCli(recoveryPassword);
  if (!result.ok) {
    console.error(`Error: ${result.error || 'Failed to recover developer password.'}`);
    process.exit(1);
  }

  console.log(
    `Success: Developer password updated for '${result.username}' using bcrypt (cost 12). All active developer sessions have been invalidated.`
  );
}

run().catch((err) => {
  console.error('Unexpected recovery error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
