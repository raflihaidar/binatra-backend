/**
 * Logger utility for consistent application logging
 * Provides different log levels with appropriate formatting
 */
class Logger {
    /**
     * Log an informational message
     * @param {string} message - The message to log
     * @param {...any} args - Additional arguments to log
     */
    info(message, ...args) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [INFO] ${message}`, ...args);
    }
  
    /**
     * Log a warning message
     * @param {string} message - The message to log
     * @param {...any} args - Additional arguments to log
     */
    warn(message, ...args) {
      const timestamp = new Date().toISOString();
      console.warn(`[${timestamp}] [WARN] ${message}`, ...args);
    }
  
    /**
     * Log an error message
     * @param {string} message - The message to log
     * @param {...any} args - Additional arguments to log
     */
    error(message, ...args) {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] [ERROR] ${message}`, ...args);
    }
  
    /**
     * Log a debug message (only in development)
     * @param {string} message - The message to log
     * @param {...any} args - Additional arguments to log
     */
    debug(message, ...args) {
      if (process.env.NODE_ENV !== 'production') {
        const timestamp = new Date().toISOString();
        console.debug(`[${timestamp}] [DEBUG] ${message}`, ...args);
      }
    }
  
    /**
     * Log a message with a custom level
     * @param {string} level - The log level
     * @param {string} message - The message to log
     * @param {...any} args - Additional arguments to log
     */
    log(level, message, ...args) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, ...args);
    }
  }
  
  // Export a singleton instance of the logger
  const logger = new Logger();
  export default logger;