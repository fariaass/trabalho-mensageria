const config = require('./config/config');
const RabbitMQConsumer = require('./consumer/rabbitmq');
const RabbitMQProducer = require('./producer/rabbitmq');
const TemporalAggregator = require('./aggregator/temporal');
const logger = require('./utils/logger');

/**
 * Serviço de Agregação de Dados de Sensores Simplificado
 * 
 * Implementa agregação temporal e publicação de dados simplificados:
 * - Consumo de dados de sensores
 * - Agregação temporal por localização
 * - Publicação de dados simplificados
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
     * Configura handlers de eventos entre componentes
     */
    setupEventHandlers() {
        // Consumer -> Aggregator
        this.consumer.on('dataReceived', (sensorData) => {
            this.stats.messagesReceived++;
            this.stats.lastActivity = new Date();
            this.aggregator.processData(sensorData);
        });

        // Aggregator -> Producer
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

        // Consumer error handling
        this.consumer.on('maxRetriesReached', () => {
            logger.error('Consumer max retries reached. Service may be unstable.');
            this.stats.errors++;
        });

        // Graceful shutdown handlers
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
     * Configura health checks e monitoramento
     */
    setupHealthChecks() {
        // Health check a cada 30 segundos
        setInterval(() => {
            this.logHealthStatus();
        }, 30000);

        // Monitoramento de performance a cada 5 minutos
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
                    periodMinutes: config.aggregation.periodMinutes,
                    toleranceSeconds: config.aggregation.toleranceSeconds,
                    inputQueue: config.rabbitmq.inputQueue,
                    outputQueue: config.rabbitmq.outputQueue
                }
            });

            // Iniciar consumer
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
     * Para o serviço de forma graceful
     * @param {string} signal - sinal que causou o shutdown
     */
    async shutdown(signal) {
        logger.info('Shutting down Aggregator Service', {
            signal,
            uptime: Date.now() - this.startTime.getTime()
        });

        this.isRunning = false;

        try {
            // Processar dados pendentes no agregador
            this.aggregator.forceProcessAll();
            
            // Aguardar um pouco para processar dados pendentes
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Fechar agregador
            this.aggregator.close();
            
            // Fechar producer
            await this.producer.close();
            
            // Fechar consumer
            await this.consumer.close();
            
            // Log final de contadores
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
     * Log do status de saúde do serviço
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
     * Log de monitoramento de performance
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
     * Log de contadores finais
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

// Inicializar e iniciar o serviço
const service = new AggregatorService();
service.start();
