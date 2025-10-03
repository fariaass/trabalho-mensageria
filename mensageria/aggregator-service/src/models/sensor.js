/**
 * Modelo de Dados do Sensor - RD001
 * Implementa validação conforme RB001
 * 
 * Estrutura de entrada da fila soil-moisture-data
 */
class SensorData {
    constructor(data) {
        this.timestamp = new Date(data.timestamp);
        this.sensorId = data.sensorId;
        this.moistureLevel = data.moistureLevel;
        this.unit = data.unit || 'percentage';
        this.location = data.location;
    }

    /**
     * Valida dados do sensor conforme RB001
     * @returns {boolean} true se válido
     * @throws {Error} se dados inválidos
     */
    validate() {
        // Validar timestamp
        if (isNaN(this.timestamp.getTime())) {
            throw new Error(`Invalid timestamp: ${this.timestamp}`);
        }

        // Validar sensorId
        if (!this.sensorId || typeof this.sensorId !== 'string' || this.sensorId.length === 0) {
            throw new Error('Sensor ID cannot be empty');
        }

        if (this.sensorId.length > 50) {
            throw new Error('Sensor ID cannot exceed 50 characters');
        }

        // Validar moistureLevel - RB001
        if (typeof this.moistureLevel !== 'number' || this.moistureLevel < 0 || this.moistureLevel > 100) {
            throw new Error(`Invalid moisture level: ${this.moistureLevel}. Must be between 0 and 100`);
        }

        // Validar unit
        if (this.unit !== 'percentage') {
            throw new Error(`Invalid unit: ${this.unit}. Must be 'percentage'`);
        }


        // Validar location - RB001
        if (!['q1', 'q2', 'q3', 'q4'].includes(this.location)) {
            throw new Error(`Invalid location: ${this.location}. Must be q1, q2, q3, or q4`);
        }

        return true;
    }

    /**
     * Converte para objeto JSON
     * @returns {Object} dados do sensor
     */
    toJSON() {
        return {
            timestamp: this.timestamp.toISOString(),
            sensorId: this.sensorId,
            moistureLevel: this.moistureLevel,
            unit: this.unit,
            location: this.location
        };
    }
}

module.exports = SensorData;
