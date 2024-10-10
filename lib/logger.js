const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { Client } = require('pg');
const { MongoClient } = require('mongodb');

// Load configuration
const configFilePath = path.resolve(process.cwd(), 'logger.conf.json');
let config;
try {
    config = require(configFilePath);
} catch (error) {
    throw new Error(`Failed to load configuration file at ${configFilePath}: ${error.message}`);
}

const dbType = config.database_type;
if (!dbType) {
    throw new Error('Database type is not specified in the configuration file');
}

let sqlClient;
let mongoClient;
let logFilePath;

// Database initialization based on configuration
if (dbType === 'text') {
    if (!config.text || !config.text.file_path) {
        throw new Error('Text file path is not specified in the configuration file');
    }
    logFilePath = path.resolve(process.cwd(), config.text.file_path);
} else if (dbType === 'sql') {
    if (!config.sql || !config.sql.connectionString) {
        throw new Error('SQL connection string is not specified in the configuration file');
    }
    sqlClient = new Client({
        connectionString: config.sql.connectionString,
        ssl: { rejectUnauthorized: false }
    });
    sqlClient.connect().then(() => {
        sqlClient.query(`
          CREATE TABLE IF NOT EXISTS ${config.sql.collectionName || "loggerData"} (
            id SERIAL PRIMARY KEY,
            method VARCHAR(255),
            url TEXT,
            status_code INTEGER,
            response_time NUMERIC,
            timestamp TIMESTAMP,
            memory_usage JSONB,
            cpu_usage JSONB
          );
        `).then(() => {
            console.log('Logs table created successfully');
        }).catch(error => {
            console.error('Error creating logs table:', error);
        });
    }).catch(error => {
        console.error('Failed to connect to the database:', error);
    });
} else if (dbType === 'nosql') {
    if (!config.nosql || !config.nosql.connectionString) {
        throw new Error('NoSQL connection string is not specified in the configuration file');
    }
    mongoClient = new MongoClient(config.nosql.connectionString, { useNewUrlParser: true, useUnifiedTopology: true });
    mongoClient.connect();
} else {
    throw new Error(`Unsupported database type: ${dbType}`);
}

// Encryption key setup
let enableTextEncryption = false;
if(dbType === "text"){
    enableTextEncryption = config?.text?.enable_log_security;
}
let encryptionKey;
if (enableTextEncryption) {
    encryptionKey = config?.text?.log_security_encryption_key;
    if (!encryptionKey) {
        throw new Error('Encryption key is not set in the configuration file');
    }
}

/**
 * Encrypt log data
 * @param {Object} log - Log data to be encrypted
 * @returns {String} Encrypted log data
 */
const encryptLogData = (log) => {
    if (!enableTextEncryption) {
        return log;
    }
    const iv = Buffer.from(encryptionKey.slice(0, 16), 'utf8');
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'utf8'), iv);
    let encrypted = cipher.update(JSON.stringify(log), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

/**
 * Decrypt log data
 * @param {String} data - Encrypted log data
 * @returns {Object} Decrypted log data
 */
const decryptLogData = (data) => {
    const iv = Buffer.from(encryptionKey.slice(0, 16), 'utf8');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'utf8'), iv);
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
}

/**
 * Get CPU usage
 * @returns {Object} CPU usage details
 */
const getCpuUsage = () => {
    const cpus = os.cpus();
    let user = 0, nice = 0, sys = 0, idle = 0, irq = 0, total = 0;

    cpus.forEach(cpu => {
        user += cpu.times.user;
        nice += cpu.times.nice;
        sys += cpu.times.sys;
        idle += cpu.times.idle;
        irq += cpu.times.irq;
    });

    total = user + nice + sys + idle + irq;

    return {
        user: ((user / total) * 100).toFixed(2),
        system: ((sys / total) * 100).toFixed(2),
        idle: ((idle / total) * 100).toFixed(2),
        total: total
    };
};

/**
 * Middleware function to log requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const logger = async (req, res, next) => {
    const start = process.hrtime();
    res.on('finish', async () => {
        const elapsed = process.hrtime(start);
        const elapsedTimeInMs = (elapsed[0] * 1000) + (elapsed[1] / 1e6);
        const memoryUsage = process.memoryUsage();
        const cpuUsage = getCpuUsage();
        const log = {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            responseTime: elapsedTimeInMs.toFixed(3),
            timestamp: new Date().toISOString(),
            memoryUsage: {
                rss: memoryUsage.rss,
                heapTotal: memoryUsage.heapTotal,
                heapUsed: memoryUsage.heapUsed,
                external: memoryUsage.external
            },
            cpuUsage: cpuUsage
        };

        try {
            if (dbType === 'text') {
                let logs = [];
                const encryptedLog = encryptLogData(log);
                if (fs.existsSync(logFilePath)) {
                    const fileData = fs.readFileSync(logFilePath, 'utf8');
                    if (fileData) {
                        logs = JSON.parse(fileData);
                    }
                }
                logs.push(encryptedLog);
                fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2), 'utf8');
            } else if (dbType === 'sql') {
                await sqlClient.query(`INSERT INTO ${config.sql.collectionName || "loggerData"} (method, url, status_code, response_time, timestamp, memory_usage, cpu_usage) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [log.method, log.url, log.statusCode, log.responseTime, log.timestamp, JSON.stringify(log.memoryUsage), JSON.stringify(log.cpuUsage)]);
            } else if (dbType === 'nosql') {
                const db = mongoClient.db();
                const collection = db.collection(config.nosql.collectionName || "loggerData");
                await collection.insertOne(log);
            }
        } catch (error) {
            console.error('Error logging data:', error);
        }
    });
    next();
};

/**
 * Function to read and return logs from the text log file
 * @returns {Array} Array of log objects
 */
const readTextLogs = () => {
    if (dbType !== 'text') {
        throw new Error('Text file path is not specified in the configuration file');
    } else {
        const fileData = fs.readFileSync(logFilePath, 'utf8');
        if (!fileData) {
            throw new Error('Log file is empty');
        }
        const logs = JSON.parse(fileData);
        if (config.text.enable_log_security) {
            return logs.map(log => decryptLogData(log));
        } else {
            return logs;
        }
    }
}

module.exports = { logger, readTextLogs };
