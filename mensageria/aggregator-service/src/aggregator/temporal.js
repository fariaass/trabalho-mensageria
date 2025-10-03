const EventEmitter = require('events');
const AggregatedData = require('../models/aggregated');
const logger = require('../utils/logger');

/**
 * Agregador Temporal de Dados de Sensores
 * Implementa RB002: Agregação Temporal e RB003: Agregação por Localização
 * 
 * Características:
 * - Agrupa dados por período configurável (padrão: 5 minutos)
 * - Tolerância de agrupamento (±30 segundos)
 * - Processamento independente por localização (q1, q2, q3, q4)
 * - Cálculo de média de umidade por sensor
 * - Emissão de eventos para dados agregados
 */
class TemporalAggregator extends EventEmitter {
    constructor(config) {
        super();
        this.periodMinutes = config.periodMinutes;
        this.toleranceSeconds = config.toleranceSeconds;
        this.data = new Map(); // Armazena dados por período e localização
        this.timers = new Map(); // Timers para processamento de períodos
        this.stats = {
            totalDataPoints: 0,
            totalPeriods: 0,
            totalLocations: 0,
            startTime: new Date()
        };
    }

    /**
     * Processa dados de sensor recebidos
     * Implementa RB002 e RB003
     * @param {SensorData} sensorData - dados do sensor
     */
    processData(sensorData) {
        try {
            const periodKey = this.getPeriodKey(sensorData.timestamp, sensorData.location);
            
            // Inicializar array de dados para o período se não existir
            if (!this.data.has(periodKey)) {
                this.data.set(periodKey, []);
                this.scheduleProcessing(periodKey);
            }
            
            // Adicionar dados ao período
            this.data.get(periodKey).push(sensorData);
            this.stats.totalDataPoints++;

            logger.debug('Data added to aggregation period', {
                periodKey,
                location: sensorData.location,
                sensorId: sensorData.sensorId,
                dataPointsInPeriod: this.data.get(periodKey).length
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
     * Gera chave única para período e localização
     * @param {Date} timestamp - timestamp dos dados
     * @param {string} location - localização (q1, q2, q3, q4)
     * @returns {string} chave do período
     */
    getPeriodKey(timestamp, location) {
        const periodStart = new Date(timestamp);
        
        // Arredondar para o início do período
        periodStart.setMinutes(Math.floor(periodStart.getMinutes() / this.periodMinutes) * this.periodMinutes);
        periodStart.setSeconds(0, 0);
        
        return `${location}-${periodStart.toISOString()}`;
    }

    /**
     * Agenda processamento do período
     * @param {string} periodKey - chave do período
     */
    scheduleProcessing(periodKey) {
        const [location, periodStartStr] = periodKey.split('-');
        const periodStart = new Date(periodStartStr);
        const periodEnd = new Date(periodStart.getTime() + this.periodMinutes * 60 * 1000);
        
        // Calcular delay: fim do período + tolerância
        const delay = periodEnd.getTime() - Date.now() + (this.toleranceSeconds * 1000);
        
        logger.debug('Scheduling period processing', {
            periodKey,
            location,
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
            delayMs: Math.max(0, delay)
        });

        const timer = setTimeout(() => {
            this.processPeriod(periodKey, periodStart, periodEnd, location);
        }, Math.max(0, delay));
        
        this.timers.set(periodKey, timer);
    }

    /**
     * Processa período completo e gera dados agregados
     * Implementa cálculo de média de umidade por sensor
     * @param {string} periodKey - chave do período
     * @param {Date} periodStart - início do período
     * @param {Date} periodEnd - fim do período
     * @param {string} location - localização
     */
    processPeriod(periodKey, periodStart, periodEnd, location) {
        try {
            const sensorData = this.data.get(periodKey) || [];
            
            // RB007: Tratamento de Dados Insuficientes
            if (sensorData.length === 0) {
                logger.warn('Period processed with no data', {
                    periodKey,
                    location,
                    periodStart: periodStart.toISOString(),
                    periodEnd: periodEnd.toISOString()
                });
            } else if (sensorData.length === 1) {
                logger.info('Period processed with single data point', {
                    periodKey,
                    location,
                    dataPoints: sensorData.length
                });
            }

            // Processar apenas se houver dados válidos
            if (sensorData.length > 0) {
                const aggregated = new AggregatedData(periodStart, periodEnd, location, sensorData);
                
                // Validar dados agregados
                aggregated.validate();
                
                // Atualizar contadores
                this.stats.totalPeriods++;
                this.stats.totalLocations = Math.max(this.stats.totalLocations, 
                    new Set([...this.data.keys()].map(key => key.split('-')[0])).size);

                // Emitir evento com dados agregados
                this.emit('dataAggregated', aggregated);
                
                logger.info('Period processed successfully', {
                    location,
                    dataPoints: sensorData.length,
                    sensorCount: aggregated.sensorCount
                });
            }
            
            // Limpar dados processados
            this.data.delete(periodKey);
            this.timers.delete(periodKey);

        } catch (error) {
            logger.error('Error processing period', {
                error: error.message,
                periodKey,
                location,
                dataPoints: this.data.get(periodKey)?.length || 0
            });
            
            // Limpar dados mesmo em caso de erro
            this.data.delete(periodKey);
            this.timers.delete(periodKey);
        }
    }

    /**
     * Obtém contadores do agregador
     * @returns {Object} contadores atuais
     */
    getStats() {
        const uptime = Date.now() - this.stats.startTime.getTime();
        const activePeriods = this.data.size;
        const activeTimers = this.timers.size;

        return {
            ...this.stats,
            uptimeMs: uptime,
            uptimeMinutes: Math.round(uptime / 60000),
            activePeriods,
            activeTimers,
            periodMinutes: this.periodMinutes,
            toleranceSeconds: this.toleranceSeconds
        };
    }

    /**
     * Força processamento de todos os períodos pendentes
     * Útil para shutdown graceful
     */
    forceProcessAll() {
        logger.info('Forcing processing of all pending periods', {
            activePeriods: this.data.size
        });

        for (const [periodKey, sensorData] of this.data.entries()) {
            if (sensorData.length > 0) {
                const [location, periodStartStr] = periodKey.split('-');
                const periodStart = new Date(periodStartStr);
                const periodEnd = new Date(periodStart.getTime() + this.periodMinutes * 60 * 1000);
                
                this.processPeriod(periodKey, periodStart, periodEnd, location);
            }
        }
    }

    /**
     * Fecha o agregador e limpa recursos
     */
    close() {
        logger.info('Closing temporal aggregator', {
            activePeriods: this.data.size,
            activeTimers: this.timers.size
        });

        // Cancelar todos os timers
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.timers.clear();

        // Processar dados pendentes
        this.forceProcessAll();

        // Limpar dados
        this.data.clear();

        logger.info('Temporal aggregator closed');
    }
}

module.exports = TemporalAggregator;
