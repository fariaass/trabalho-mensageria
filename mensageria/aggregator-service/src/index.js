const config = require('./config/config');
const RabbitMQConsumer = require('./consumer/rabbitmq');
const RabbitMQProducer = require('./producer/rabbitmq');
const TemporalAggregator = require('./aggregator/temporal');
const logger = require('./utils/logger');

/**
 * Serviço de Agregação de Dados de Sensores
 */
class AggregatorService {
    constructor() {
        this.consumer = new RabbitMQConsumer(config.rabbitmq);
        this.producer = new RabbitMQProducer(config.rabbitmq);
        this.aggregator = new TemporalAggregator(config.aggregation);
        
        this.isRunning = false;
        this.startTime = new Date();
        this.stats = {
            messagesReceived: 0,
            messagesPublished: 0,
            errors: 0,
            lastActivity: null
        };

        this.setupEventHandlers();
        this.setupHealthChecks();
    }

    /**
     * Configura handlers de eventos
     */
    setupEventHandlers() {
        this.consumer.on('dataReceived', (sensorData) => {
            this.stats.messagesReceived++;
            this.stats.lastActivity = new Date();
            this.aggregator.processData(sensorData);
        });

        this.aggregator.on('dataAggregated', async (aggregatedData) => {
            try {
                await this.producer.publish(aggregatedData);
                this.stats.messagesPublished++;
                this.stats.lastActivity = new Date();
            } catch (error) {
                this.stats.errors++;
                logger.error('Failed to publish aggregated data', {
                    error: error.message,
                    location: aggregatedData.location,
                    periodStart: aggregatedData.periodStart.toISOString()
                });
            }
        });

        this.consumer.on('maxRetriesReached', () => {
            logger.error('Consumer max retries reached. Service may be unstable.');
            this.stats.errors++;
        });
        process.on('SIGINT', () => this.shutdown('SIGINT'));
        process.on('SIGTERM', () => this.shutdown('SIGTERM'));
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception', { error: error.message, stack: error.stack });
            this.stats.errors++;
            this.shutdown('uncaughtException');
        });
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled rejection', { reason: reason?.message || reason, promise });
            this.stats.errors++;
        });
    }

    /**
     * Configura health checks
     */
    setupHealthChecks() {
        setInterval(() => {
            this.logHealthStatus();
        }, 30000);

        setInterval(() => {
            this.logPerformanceMetrics();
        }, 300000);
    }

    /**
     * Inicia o serviço
     */
    async start() {
        try {
            logger.info('Starting Aggregator Service', {
                version: '1.0.0',
                config: {
                    inputQueue: config.rabbitmq.inputQueue,
                    outputQueue: config.rabbitmq.outputQueue
                }
            });

            await this.consumer.start();
            
            this.isRunning = true;
            this.startTime = new Date();
            
            logger.info('Aggregator Service started successfully', {
                startTime: this.startTime.toISOString(),
                uptime: 0
            });

        } catch (error) {
            logger.error('Failed to start Aggregator Service', {
                error: error.message,
                stack: error.stack
            });
            this.stats.errors++;
            process.exit(1);
        }
    }

    /**
     * Para o serviço
     * @param {string} signal - sinal que causou o shutdown
     */
    async shutdown(signal) {
        logger.info('Shutting down Aggregator Service', {
            signal,
            uptime: Date.now() - this.startTime.getTime()
        });

        this.isRunning = false;

        try {
            this.aggregator.forceProcessAll();
            await new Promise(resolve => setTimeout(resolve, 2000));
            this.aggregator.close();
            await this.producer.close();
            await this.consumer.close();
            this.logFinalStats();
            
            logger.info('Aggregator Service stopped gracefully');
            process.exit(0);
            
        } catch (error) {
            logger.error('Error during shutdown', {
                error: error.message,
                stack: error.stack
            });
            process.exit(1);
        }
    }

    /**
     * Log do status de saúde
     */
    logHealthStatus() {
        const uptime = Date.now() - this.startTime.getTime();
        const aggregatorStats = this.aggregator.getStats();
        
        const health = {
            isRunning: this.isRunning,
            uptimeMs: uptime,
            uptimeMinutes: Math.round(uptime / 60000),
            consumerHealthy: this.consumer.isHealthy(),
            producerHealthy: this.producer.isHealthy(),
            messagesReceived: this.stats.messagesReceived,
            messagesPublished: this.stats.messagesPublished,
            errors: this.stats.errors,
            lastActivity: this.stats.lastActivity?.toISOString(),
            aggregatorStats
        };

        logger.info('Health check', health);
    }

    /**
     * Log de performance
     */
    logPerformanceMetrics() {
        const uptime = Date.now() - this.startTime.getTime();
        const uptimeMinutes = uptime / 60000;
        
        const metrics = {
            uptimeMinutes: Math.round(uptimeMinutes),
            messagesPerMinute: Math.round(this.stats.messagesReceived / uptimeMinutes),
            publishedPerMinute: Math.round(this.stats.messagesPublished / uptimeMinutes),
            errorRate: this.stats.errors / this.stats.messagesReceived || 0
        };

        logger.info('Performance monitoring', metrics);
    }

    /**
     * Log de estatísticas finais
     */
    logFinalStats() {
        const uptime = Date.now() - this.startTime.getTime();
        const uptimeMinutes = uptime / 60000;
        
        const finalStats = {
            totalUptimeMs: uptime,
            totalUptimeMinutes: Math.round(uptimeMinutes),
            totalMessagesReceived: this.stats.messagesReceived,
            totalMessagesPublished: this.stats.messagesPublished,
            totalErrors: this.stats.errors,
            averageMessagesPerMinute: Math.round(this.stats.messagesReceived / uptimeMinutes),
            errorRate: this.stats.errors / this.stats.messagesReceived || 0,
            finalAggregatorStats: this.aggregator.getStats()
        };

        logger.info('Final service statistics', finalStats);
    }
}

const service = new AggregatorService();
service.start();
