const EventEmitter = require('events');
const AggregatedData = require('../models/aggregated');
const logger = require('../utils/logger');

/**
 * Agregador de Dados de Sensores
 * 
 * Características:
 * - Coleta dados de sensores em array global
 * - Processa agregação por timer fixo (10 segundos)
 * - Agrupa por localização e calcula médias por sensor
 * - Emite eventos com dados agregados
 */
class TemporalAggregator extends EventEmitter {
    constructor(config) {
        super();
        this.aggregationIntervalSeconds = config.aggregationIntervalSeconds || 10;
        this.data = [];
        this.timer = null;
        this.stats = {
            totalDataPoints: 0,
            totalPeriods: 0,
            startTime: new Date()
        };
        
        this.startAggregationTimer();
    }

    /**
     * Processa dados de sensor recebidos
     * @param {SensorData} sensorData - dados do sensor
     */
    processData(sensorData) {
        try {
            this.data.push(sensorData);
            this.stats.totalDataPoints++;

            logger.debug('Data added to aggregation', {
                location: sensorData.location,
                sensorId: sensorData.sensorId,
                totalDataPoints: this.data.length
            });

        } catch (error) {
            logger.error('Error processing sensor data', {
                error: error.message,
                sensorId: sensorData.sensorId,
                location: sensorData.location
            });
        }
    }

    /**
     * Inicia timer de agregação
     */
    startAggregationTimer() {
        this.timer = setInterval(() => {
            this.processAggregation();
        }, this.aggregationIntervalSeconds * 1000);
        
        logger.info('Aggregation timer started', {
            intervalSeconds: this.aggregationIntervalSeconds
        });
    }

    /**
     * Processa agregação de todos os dados
     */
    processAggregation() {
        if (this.data.length === 0) {
            return;
        }

        try {
            const groupedData = {};
            this.data.forEach(sensorData => {
                if (!groupedData[sensorData.location]) {
                    groupedData[sensorData.location] = [];
                }
                groupedData[sensorData.location].push(sensorData);
            });

            Object.keys(groupedData).forEach(location => {
                const sensorData = groupedData[location];
                const periodStart = new Date();
                const periodEnd = new Date(periodStart.getTime() + this.aggregationIntervalSeconds * 1000);

                const aggregated = new AggregatedData(periodStart, periodEnd, location, sensorData);
                aggregated.validate();

                this.stats.totalPeriods++;
                this.emit('dataAggregated', aggregated);

                logger.info('Period processed successfully', {
                    location,
                    dataPoints: sensorData.length,
                    sensorCount: aggregated.sensorCount
                });
            });

            this.data = [];

        } catch (error) {
            logger.error('Error processing aggregation', {
                error: error.message,
                dataPoints: this.data.length
            });
        }
    }


    /**
     * Obtém estatísticas do agregador
     * @returns {Object} estatísticas atuais
     */
    getStats() {
        const uptime = Date.now() - this.stats.startTime.getTime();

        return {
            ...this.stats,
            uptimeMs: uptime,
            uptimeMinutes: Math.round(uptime / 60000),
            activeDataPoints: this.data.length,
            aggregationIntervalSeconds: this.aggregationIntervalSeconds
        };
    }

    /**
     * Força processamento de todos os dados pendentes
     */
    forceProcessAll() {
        logger.info('Forcing processing of all pending data', {
            activeDataPoints: this.data.length
        });

        if (this.data.length > 0) {
            this.processAggregation();
        }
    }

    /**
     * Fecha o agregador e limpa recursos
     */
    close() {
        logger.info('Closing temporal aggregator', {
            activeDataPoints: this.data.length
        });

        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        this.forceProcessAll();
        this.data = [];

        logger.info('Temporal aggregator closed');
    }
}

module.exports = TemporalAggregator;
