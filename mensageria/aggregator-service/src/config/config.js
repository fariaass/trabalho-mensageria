require('dotenv').config();

/**
 * Configuração do Serviço de Agregação
 * Implementa RB008: Configuração do Sistema
 * 
 * Configurações obrigatórias e opcionais conforme regras de negócio
 */
module.exports = {
    rabbitmq: {
        host: process.env.RABBITMQ_HOST || 'localhost',
        port: parseInt(process.env.RABBITMQ_PORT) || 5672,
        username: process.env.RABBITMQ_USERNAME || 'guest',
        password: process.env.RABBITMQ_PASSWORD || 'guest',
        inputQueue: process.env.INPUT_QUEUE || 'soil-moisture-data',
        outputQueue: process.env.OUTPUT_QUEUE || 'soil-moisture-sensors'
    },
    aggregation: {
        periodMinutes: parseInt(process.env.AGGREGATION_PERIOD_MINUTES) || 5,
        toleranceSeconds: parseInt(process.env.AGGREGATION_TOLERANCE_SECONDS) || 30
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'json'
    },
};
