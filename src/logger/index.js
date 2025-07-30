import pino from "pino";

const isProd = process.env.NODE_ENV === "production";

const logger = pino(
  isProd
    ? {}
    : {
        transport: {
          target: process.env.NODE_ENV === "production" ? "" : "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
        level: process.env.NODE_ENV === "production" ? "info" : "debug",
      }
);

export default logger;
