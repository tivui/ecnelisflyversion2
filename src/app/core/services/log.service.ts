
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LogService {

  debug(message: unknown): void {
    this.handleLog('debug', this.buildMessage(message));
  }

  info(message: unknown): void {
    this.handleLog('info', this.buildMessage(message));
  }

  warn(message: unknown, cause: Error | null = null): void {
    this.handleLog('warn', this.buildMessage(message), cause);
  }

  error(message: unknown, cause: Error | null = null): void {
    this.handleLog('error', this.buildMessage(message), cause);
  }

  private buildMessage(message: unknown): string {
    if (message instanceof Error) return message.stack ?? message.message;
    if (typeof message === 'string') return message;
    return message?.toString() ?? '';
  }

  private handleLog(type: 'debug' | 'info' | 'warn' | 'error', logMessage: string, cause: Error | null = null): void {
    const timestamp = new Date().toISOString();
    console[type](`[${timestamp}] ${logMessage}`, cause);
  }
}
