/**
 * ErrorLogger - Captures browser console errors and warnings
 * for easier debugging and reporting.
 */

interface LogEntry {
  timestamp: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  stack?: string;
  source?: string;
  lineNumber?: number;
  columnNumber?: number;
}

class ErrorLogger {
  private logs: LogEntry[] = [];
  private maxLogs: number = 100;
  private isInitialized: boolean = false;
  private originalConsoleError: typeof console.error;
  private originalConsoleWarn: typeof console.warn;
  private originalConsoleLog: typeof console.log;

  constructor() {
    // Store original console methods
    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;
    this.originalConsoleLog = console.log;
  }

  /**
   * Initialize the error logger and start capturing errors
   */
  public init(): void {
    if (this.isInitialized) return;
    
    // Capture unhandled errors
    window.addEventListener('error', (event: ErrorEvent) => {
      this.logError({
        message: event.message,
        source: event.filename,
        lineNumber: event.lineno,
        columnNumber: event.colno,
        stack: event.error?.stack
      });
      return false; // Don't prevent default handling
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const message = reason instanceof Error 
        ? reason.message 
        : String(reason);
      
      this.logError({
        message: `Unhandled Promise Rejection: ${message}`,
        stack: reason instanceof Error ? reason.stack : undefined
      });
    });

    // Override console.error
    console.error = (...args: any[]) => {
      this.logError({ message: this.formatConsoleArgs(args) });
      this.originalConsoleError.apply(console, args); // Call original method
    };

    // Override console.warn
    console.warn = (...args: any[]) => {
      this.logWarning({ message: this.formatConsoleArgs(args) });
      this.originalConsoleWarn.apply(console, args); // Call original method
    };

    // Override console.log for important info
    console.log = (...args: any[]) => {
      // Only capture logs that might be important
      const message = this.formatConsoleArgs(args);
      if (message.includes('error') || message.includes('failed') || message.includes('warning')) {
        this.logInfo({ message });
      }
      this.originalConsoleLog.apply(console, args); // Call original method
    };

    this.isInitialized = true;
    console.log('Error logger initialized');
  }

  /**
   * Reset the console to its original state
   */
  public destroy(): void {
    if (!this.isInitialized) return;
    
    console.error = this.originalConsoleError;
    console.warn = this.originalConsoleWarn;
    console.log = this.originalConsoleLog;
    
    this.isInitialized = false;
  }

  /**
   * Log an error message
   */
  public logError({ message, stack, source, lineNumber, columnNumber }: { 
    message: string; 
    stack?: string;
    source?: string;
    lineNumber?: number;
    columnNumber?: number;
  }): void {
    this.addLog({
      type: 'error',
      message,
      stack,
      source,
      lineNumber,
      columnNumber
    });
  }

  /**
   * Log a warning message
   */
  public logWarning({ message }: { message: string }): void {
    this.addLog({
      type: 'warning',
      message
    });
  }

  /**
   * Log an info message
   */
  public logInfo({ message }: { message: string }): void {
    this.addLog({
      type: 'info',
      message
    });
  }

  /**
   * Get all captured logs
   */
  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Clear all captured logs
   */
  public clearLogs(): void {
    this.logs = [];
  }

  /**
   * Format logs for easy reading and copying
   */
  public getFormattedLogs(): string {
    if (this.logs.length === 0) {
      return 'No logs captured yet.';
    }

    return this.logs.map(log => {
      let message = `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}`;
      
      if (log.source) {
        message += `\n  at ${log.source}`;
        if (log.lineNumber) {
          message += `:${log.lineNumber}`;
          if (log.columnNumber) {
            message += `:${log.columnNumber}`;
          }
        }
      }
      
      if (log.stack) {
        message += `\n${log.stack}`;
      }
      
      return message;
    }).join('\n\n');
  }

  /**
   * Export logs as JSON for sharing
   */
  public exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Copy formatted logs to clipboard
   */
  public async copyLogsToClipboard(): Promise<boolean> {
    try {
      const formattedLogs = this.getFormattedLogs();
      await navigator.clipboard.writeText(formattedLogs);
      console.log('Logs copied to clipboard');
      return true;
    } catch (error) {
      console.error('Failed to copy logs to clipboard:', error);
      return false;
    }
  }

  /**
   * Download logs as a file
   */
  public downloadLogs(filename = 'error-logs.json'): void {
    const logsJson = this.exportLogs();
    const blob = new Blob([logsJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }

  /**
   * Add a log entry and maintain max logs limit
   */
  private addLog(log: Omit<LogEntry, 'timestamp'>): void {
    const entry: LogEntry = {
      ...log,
      timestamp: new Date().toISOString()
    };
    
    this.logs.push(entry);
    
    // Trim logs if we exceed the max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  /**
   * Format console arguments into a string
   */
  private formatConsoleArgs(args: any[]): string {
    return args.map(arg => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return arg.message;
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
      try {
        return JSON.stringify(arg);
      } catch (e) {
        return String(arg);
      }
    }).join(' ');
  }
}

// Create a singleton instance
export const errorLogger = new ErrorLogger();

// Initialize immediately in development
if (import.meta.env.DEV) {
  errorLogger.init();
}

export default errorLogger; 