const SimplifiedData = require('./simplified');

/**
 * Modelo de Dados Agregados Simplificado
 * Implementa a nova estrutura de saída simplificada
 * 
 * Estrutura de saída para fila soil-moisture-sensors
 */
class AggregatedData {
    constructor(periodStart, periodEnd, location, sensorData) {
        this.periodStart = periodStart;
        this.periodEnd = periodEnd;
        this.location = location;
        this.sensorCount = sensorData.length;
        this.simplifiedData = new SimplifiedData(location, sensorData);
    }


    /**
     * Valida dados agregados
     * @returns {boolean} true se válido
     * @throws {Error} se dados inválidos
     */
    validate() {
        if (!(this.periodStart instanceof Date) || !(this.periodEnd instanceof Date)) {
            throw new Error('Period start and end must be Date objects');
        }

        if (this.periodStart >= this.periodEnd) {
            throw new Error('Period start must be before period end');
        }

        if (!['q1', 'q2', 'q3', 'q4'].includes(this.location)) {
            throw new Error(`Invalid location: ${this.location}`);
        }

        if (this.sensorCount < 1) {
            throw new Error('Sensor count must be at least 1');
        }

        // Validar dados simplificados
        this.simplifiedData.validate();

        return true;
    }

    /**
     * Converte para objeto JSON simplificado
     * @returns {Object} dados agregados simplificados
     */
    toJSON() {
        return this.simplifiedData.toJSON();
    }
}

module.exports = AggregatedData;
