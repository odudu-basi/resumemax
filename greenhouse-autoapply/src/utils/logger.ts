/**
 * Simple logging utility
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

class Logger {
  private level: LogLevel = 'info';

  setLevel(level: LogLevel) {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  debug(message: string, ...args: any[]) {
    if (this.shouldLog('debug')) {
      console.log(`${COLORS.gray}[DEBUG]${COLORS.reset} ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.shouldLog('info')) {
      console.log(`${COLORS.blue}[INFO]${COLORS.reset} ${message}`, ...args);
    }
  }

  success(message: string, ...args: any[]) {
    if (this.shouldLog('info')) {
      console.log(`${COLORS.green}[SUCCESS]${COLORS.reset} ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.shouldLog('warn')) {
      console.warn(`${COLORS.yellow}[WARN]${COLORS.reset} ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]) {
    if (this.shouldLog('error')) {
      console.error(`${COLORS.red}[ERROR]${COLORS.reset} ${message}`, ...args);
    }
  }
}

export const logger = new Logger();
