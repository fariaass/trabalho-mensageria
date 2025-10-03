const winston = require('winston');

/**
 * Sistema de Logging Estruturado
 * Implementa RB005: Logs estruturados e informativos
 * 
 * Configuração baseada em variáveis de ambiente
 */
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss.SSS'
        }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: {
        service: 'aggregator-service',
        version: '1.0.0'
    },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// Adicionar transport de arquivo se especificado
if (process.env.LOG_FILE) {
    logger.add(new winston.transports.File({
        filename: process.env.LOG_FILE,
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
        )
    }));
}

/**
 * Log estruturado para dados de sensor recebidos
 * @param {SensorData} sensorData - dados do sensor
 */
logger.logSensorData = (sensorData) => {
    logger.info('Sensor data received', {
        sensorId: sensorData.sensorId,
        location: sensorData.location,
        moistureLevel: sensorData.moistureLevel,
        timestamp: sensorData.timestamp.toISOString()
    });
};

/**
 * Log estruturado para erros de validação
 * @param {Error} error - erro de validação
 * @param {Object} data - dados que causaram o erro
 */
logger.logValidationError = (error, data) => {
    logger.warn('Data validation failed', {
        error: error.message,
        data: data,
        timestamp: new Date().toISOString()
    });
};

module.exports = logger;
