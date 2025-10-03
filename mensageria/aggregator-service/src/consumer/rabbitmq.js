const amqp = require('amqplib');
const EventEmitter = require('events');
const SensorData = require('../models/sensor');
const logger = require('../utils/logger');

/**
 * Consumidor RabbitMQ para fila soil-moisture-data
 * Implementa RB001: Consumo de Dados de Sensores
 * 
 * Características:
 * - Consumo em tempo real (latência < 1 segundo)
 * - Acknowledgment manual para garantir entrega
 * - Retry automático em caso de falha
 * - Validação de dados antes do processamento
 */
class RabbitMQConsumer extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.connection = null;
        this.channel = null;
        this.isConnected = false;
        this.retryCount = 0;
        this.maxRetries = 5;
        this.retryDelay = 1000; // 1 segundo
    }

    /**
     * Conecta ao RabbitMQ com retry automático
     */
    async connect() {
        try {
            const connectionString = `amqp://${this.config.username}:${this.config.password}@${this.config.host}:${this.config.port}`;
            
            logger.info('Connecting to RabbitMQ', {
                host: this.config.host,
                port: this.config.port,
                username: this.config.username,
                queue: this.config.inputQueue
            });

            this.connection = await amqp.connect(connectionString);
            this.channel = await this.connection.createChannel();
            
            // Configurar QoS para controle de fluxo
            await this.channel.prefetch(1);
            
            // Garantir que a fila existe e é durável
            await this.channel.assertQueue(this.config.inputQueue, { 
                durable: true
            });
            
            this.isConnected = true;
            this.retryCount = 0;
            
            logger.info('Successfully connected to RabbitMQ', {
                queue: this.config.inputQueue,
                prefetch: 1
            });

            // Configurar handlers de reconexão
            this.connection.on('error', (error) => {
                logger.error('RabbitMQ connection error', { error: error.message });
                this.isConnected = false;
                this.handleReconnection();
            });

            this.connection.on('close', () => {
                logger.warn('RabbitMQ connection closed');
                this.isConnected = false;
                this.handleReconnection();
            });

        } catch (error) {
            logger.error('Failed to connect to RabbitMQ', { 
                error: error.message,
                retryCount: this.retryCount
            });
            await this.handleReconnection();
        }
    }

    /**
     * Inicia o consumo de mensagens
     */
    async start() {
        if (!this.isConnected) {
            await this.connect();
        }

        if (!this.channel) {
            throw new Error('Channel not available');
        }

        logger.info('Starting message consumption', {
            queue: this.config.inputQueue
        });

        this.channel.consume(this.config.inputQueue, async (msg) => {
            if (msg) {
                await this.processMessage(msg);
            }
        }, {
            noAck: false // Acknowledgment manual
        });
    }

    /**
     * Processa uma mensagem recebida
     * @param {Object} msg - mensagem do RabbitMQ
     */
    async processMessage(msg) {
        try {
            const data = JSON.parse(msg.content.toString());
            
            // Criar e validar dados do sensor
            const sensorData = new SensorData(data);
            sensorData.validate();

            // Log estruturado dos dados recebidos
            logger.logSensorData(sensorData);

            // Emitir evento para processamento
            this.emit('dataReceived', sensorData);

            // Acknowledgment manual - confirma processamento
            this.channel.ack(msg);

        } catch (error) {
            logger.logValidationError(error, {
                messageId: msg.properties.messageId,
                routingKey: msg.fields.routingKey,
                content: msg.content.toString()
            });

            // Rejeitar mensagem sem reprocessamento
            this.channel.nack(msg, false, false);
        }
    }

    /**
     * Trata reconexão automática
     */
    async handleReconnection() {
        if (this.retryCount >= this.maxRetries) {
            logger.error('Max retry attempts reached. Stopping reconnection attempts.');
            this.emit('maxRetriesReached');
            return;
        }

        this.retryCount++;
        const delay = this.retryDelay * Math.pow(2, this.retryCount - 1); // Backoff exponencial

        logger.info('Scheduling reconnection attempt', {
            retryCount: this.retryCount,
            maxRetries: this.maxRetries,
            delayMs: delay
        });

        setTimeout(async () => {
            try {
                await this.connect();
                if (this.isConnected) {
                    await this.start();
                }
            } catch (error) {
                logger.error('Reconnection attempt failed', { error: error.message });
            }
        }, delay);
    }

    /**
     * Fecha conexões
     */
    async close() {
        logger.info('Closing RabbitMQ consumer connections');
        
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
            logger.info('RabbitMQ consumer connections closed');
            
        } catch (error) {
            logger.error('Error closing RabbitMQ connections', { error: error.message });
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

module.exports = RabbitMQConsumer;
