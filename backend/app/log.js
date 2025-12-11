/*

Copyright (C) 2025 The University of Texas MD Anderson Cancer Center

This file is part of xPEDITE.

xPEDITE is free software: you can redistribute it and/or modify it under the terms of the
GNU General Public License Version 2 as published by the Free Software Foundation.

xPEDITE is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with xPEDITE.
If not, see <https://www.gnu.org/licenses/>.

*/

"use strict";
const winston = require('winston');
require('winston-daily-rotate-file');

/*
  Create logger
*/
if (!process.env.LOG_LEVEL || !['info', 'debug', 'error', 'warn', 'verbose', 'silly'].includes(process.env.LOG_LEVEL.toLowerCase())) {
  process.env.LOG_LEVEL = 'info'
}

const LOG_FILE_PATH = process.env.LOG_FILE_PATH || '/home/nodeuser/xpedite_backend.log';

let winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL.toLowerCase(),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({format: 'DD-MMM-YYYY HH:mm:ss'}),
        winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`),
      )
    }),
    new winston.transports.DailyRotateFile({
      filename: LOG_FILE_PATH,
      datePattern: 'YYYY-MM', // rotate monthly
      maxSize: '2m', // rotate if file size exceeds 2MB
      maxFiles: '6m', // keep 6 months of logs
      format: winston.format.combine(
        winston.format.timestamp({format: 'DD-MMM-YYYY HH:mm:ss'}),
        winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`),
      ),
    }),
  ],
})

/*
  Allow for filename to be printed with log message
*/
module.exports = function(fileName) {
  let myLogger  = {
        warn: function(message) {
            winstonLogger.warn("[" + fileName + ']: ' + message)
        },
        error: function(message) {
            winstonLogger.error("[" + fileName + ']: ' + message)
        },
        debug: function(message) {
            winstonLogger.debug("[" + fileName + ']: ' + message)
        },
        info: function(message) {
            winstonLogger.info("[" + fileName + ']: ' + message)
        }
    }
    return myLogger
}

