import pino from 'pino';

export const logger = pino({
  level: process.env.VIBERUN_LOG_LEVEL ?? 'info',
  transport:
    process.stdout.isTTY && process.env.VIBERUN_LOG_FORMAT !== 'json'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
      : undefined,
});

export type Logger = typeof logger;
