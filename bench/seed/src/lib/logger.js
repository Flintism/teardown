// The repo logger. The rules file forbids console.log and CI greps for it.
const levels = ['debug', 'info', 'warn', 'error'];

const logger = Object.fromEntries(
  levels.map((l) => [
    l,
    (ctx, msg) =>
      process.stdout.write(
        JSON.stringify({ level: l, msg: msg || ctx, ...(msg ? ctx : {}) }) + '\n'
      ),
  ])
);

module.exports = { logger };
