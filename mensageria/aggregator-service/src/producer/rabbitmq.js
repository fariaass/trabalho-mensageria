const amqp = require('amqplib');
const logger = require('../utils/logger');

/**
 * Produtor RabbitMQ para fila soil-moisture-sensors
 * Implementa publicação de dados simplificados
 * 
 * Características:
 * - Publicação com acknowledgment automático
 * - Retry automático em caso de falha
 * - Mensagens persistentes para garantir entrega
 * - Logs informativos para cada publicação
 */
class RabbitMQProducer {
    constructor(config) {
        this.config = config;
        this.connection = null;
        this.channel = null;
        this.isConnected = false;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 segundo
    }

    /**
     * Conecta ao RabbitMQ com retry automático
     */
    async connect() {
        try {
            const connectionString = `amqp://${this.config.username}:${this.config.password}@${this.config.host}:${this.config.port}`;
            
            logger.info('Connecting to RabbitMQ producer', {
                host: this.config.host,
                port: this.config.port,
                username: this.config.username,
                queue: this.config.outputQueue
            });

            this.connection = await amqp.connect(connectionString);
            this.channel = await this.connection.createChannel();
            
            // Garantir que a fila existe e é durável
            await this.channel.assertQueue(this.config.outputQueue, { 
                durable: true
            });
            
            this.isConnected = true;
            this.retryCount = 0;
            
            logger.info('Successfully connected to RabbitMQ producer', {
                queue: this.config.outputQueue
            });

            // Configurar handlers de reconexão
            this.connection.on('error', (error) => {
                logger.error('RabbitMQ producer connection error', { error: error.message });
                this.isConnected = false;
            });

            this.connection.on('close', () => {
                logger.warn('RabbitMQ producer connection closed');
                this.isConnected = false;
            });

        } catch (error) {
            logger.error('Failed to connect RabbitMQ producer', { 
                error: error.message,
                retryCount: this.retryCount
            });
            throw error;
        }
    }

    /**
     * Publica dados agregados na fila
     * @param {AggregatedData} aggregatedData - dados agregados para publicar
     */
    async publish(aggregatedData) {
        if (!this.isConnected || !this.channel) {
            await this.connect();
        }

        try {
            // Validar dados antes da publicação
            aggregatedData.validate();

            const message = JSON.stringify(aggregatedData.toJSON());
            
            // Publicar com propriedades persistentes
            const success = this.channel.sendToQueue(
                this.config.outputQueue,
                Buffer.from(message),
                {
                    persistent: true,
                    messageId: `agg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    timestamp: Date.now(),
                    headers: {
                        'content-type': 'application/json',
                        'aggregation-service': '1.0.0'
                    }
                }
            );

            if (!success) {
                throw new Error('Failed to send message to queue - queue may be full');
            }

            // Log da publicação
            logger.info('Published simplified sensor data', {
                location: aggregatedData.location,
                sensorCount: aggregatedData.sensorCount
            });

            // Reset retry count em caso de sucesso
            this.retryCount = 0;

        } catch (error) {
            logger.error('Failed to publish aggregated data', {
                error: error.message,
                location: aggregatedData.location,
                periodStart: aggregatedData.periodStart.toISOString(),
                periodEnd: aggregatedData.periodEnd.toISOString()
            });

            // Tentar reconectar e republicar
            await this.handlePublishError(aggregatedData);
        }
    }

    /**
     * Trata erros de publicação com retry
     * @param {AggregatedData} aggregatedData - dados para republicar
     */
    async handlePublishError(aggregatedData) {
        if (this.retryCount >= this.maxRetries) {
            logger.error('Max retry attempts reached for publishing', {
                location: aggregatedData.location,
                retryCount: this.retryCount
            });
            return;
        }

        this.retryCount++;
        const delay = this.retryDelay * Math.pow(2, this.retryCount - 1); // Backoff exponencial

        logger.info('Scheduling retry for publishing', {
            retryCount: this.retryCount,
            maxRetries: this.maxRetries,
            delayMs: delay,
            location: aggregatedData.location
        });

        setTimeout(async () => {
            try {
                // Reconectar se necessário
                if (!this.isConnected) {
                    await this.connect();
                }
                
                // Tentar republicar
                await this.publish(aggregatedData);
            } catch (error) {
                logger.error('Retry publish attempt failed', { 
                    error: error.message,
                    retryCount: this.retryCount
                });
            }
        }, delay);
    }

    /**
     * Fecha conexões
     */
    async close() {
        logger.info('Closing RabbitMQ producer connections');
        
        try {
            if (this.channel) {
                await this.channel.close();
                this.channel = null;
            }
            
            if (this.connection) {
                await this.connection.close();
                this.connection = null;
            }
            
            this.isConnected = false;
            logger.info('RabbitMQ producer connections closed');
            
        } catch (error) {
            logger.error('Error closing RabbitMQ producer connections', { error: error.message });
        }
    }

    /**
     * Verifica se está conectado
     * @returns {boolean} status da conexão
     */
    isHealthy() {
        return this.isConnected && this.channel !== null;
    }
}

module.exports = RabbitMQProducer;
