# LivLogger

liv-logger is a versatile logging middleware for Express.js that supports logging to text files, SQL databases, and NoSQL databases. It is designed to provide detailed insights into your application's performance, including response times, memory usage, and CPU usage. With built-in support for encryption, liv-logger ensures that your log data remains secure.

## Installation

Use the package manager [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) to install livlogger.

```bash
npm install livlogger
```

## Usage

```JavaScript
// app.js
const express = require('express');
const { logger, readTextLogs } = require('livlogger');

const app = express();
const PORT = 3000;

// Use the logger middleware
app.use(logger);

// Define a simple route
app.get('/', (req, res) => {
  res.send("Hello World");
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

```

## Features

- **Text File Logging:** Log data to a text file with optional encryption for added security.
- **SQL Database Logging:** Log data to a SQL database (e.g., PostgreSQL) for structured storage and easy querying.
- **NoSQL Database Logging:** Log data to a NoSQL database (e.g., MongoDB) for flexible and scalable storage.
- **Performance Monitoring:** Capture detailed metrics such as response time, memory usage, and CPU usage.
- **Easy Configuration:** Use a simple JSON configuration file to set up your logging preferences.
- **Secure Logging:** Encrypt your log data to ensure sensitive information remains protected. Currently we only have encryption functionality for the json file based/text based log store.
## Usage

1. **Install the package:**
    ```bash
    npm install livlogger
    ```

2. **Create a configuration file:**
    Create a `logger.conf.json` file in the root of your project directory with the following structure(Remember you need to use only one out of those 3 storage configurations based on the 'database_type') :
    ```json
    {
        "database_type": "text", // or "sql" or "nosql"
        "text": {
            "file_path": "./logs/log.txt",
            "enable_log_security": true,
            "log_security_encryption_key": "your-encryption-key(must be 32characters long)"
        },
        "sql": {
            "connectionString": "your-sql-connection-string",
            "collectionName": "loggerData"
        },
        "nosql": {
            "connectionString": "your-nosql-connection-string",
            "collectionName": "loggerData"
        }
    }
    ```

3. **Use the logger in your application:**
    ```javascript
    const express = require('express');
    const { logger, readTextLogs } = require('liv-logger');
    const app = express();

    // Use the logger middleware
    app.use(logger);

    // Define your routes
    app.get('/', (req, res) => {
        res.send('Hello, world!');
    });
 
    // Endpoint to read logs
    //readTextLogs is an inbuilt function that helps to read the 'text' based stored data.
    // Remember if you have configured the security/encryption for your text based storage,
    //then the readTextLogs function is the only way to read the logs

    app.get('/logs', (req, res) => {
        try {
            const logs = readTextLogs(); 
            res.json(logs);
        } catch (error) {
            res.status(500).send('Error reading logs: ' + error.message);
        }
    });

    // Start the server
    app.listen(3000, () => {
        console.log('Server is running on port 3000');
    });
    ```
## Configuration Options

The configuration file (`logger.conf.json`) supports the following options:

### database_type
Specifies the type of logging. Possible values: `"text"`, `"sql"`, `"nosql"`.

### text
Configuration for text file logging.
- **file_path**: Path to the log file.
- **enable_log_security**: Boolean to enable or disable log encryption.
- **log_security_encryption_key**: (Optional) 32 Characters long Encryption key for securing the logs. Required only if `enable_log_security` is `true`.

### sql
Configuration for SQL database logging.
- **connectionString**: Connection string for the SQL database.
- **collectionName**: (Optional) Name of the table for storing logs. Defaults to `loggerData`.

### nosql
Configuration for NoSQL database logging.
- **connectionString**: Connection string for the NoSQL database.
- **collectionName**: (Optional) Name of the collection for storing logs. Defaults to `loggerData`.


## Contributing
**Soon we are going to make this project open-source 

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

## Author

[Subham Mahanty](https://www.linkedin.com/in/subham-mahanty/)
