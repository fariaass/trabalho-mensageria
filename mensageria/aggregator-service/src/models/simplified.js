/**
 * Modelo de Dados Simplificados
 * Implementa a nova estrutura de saída simplificada
 * 
 * Estrutura de saída:
 * {
 *   "sensors": [
 *     {
 *       "name": "soil-monitor-q1-001",
 *       "location": "q1",
 *       "id": "001",
 *       "averageMoisture": 65.5
 *     }
 *   ]
 * }
 */
class SimplifiedData {
    constructor(location, sensorData) {
        this.location = location;
        this.sensors = this.processSensors(sensorData);
    }

    /**
     * Processa dados dos sensores para formato simplificado
     * @param {Array<SensorData>} sensorData - dados dos sensores
     * @returns {Array} array de sensores simplificados
     */
    processSensors(sensorData) {
        if (!sensorData || sensorData.length === 0) {
            return [];
        }

        // Agrupar por sensorId e calcular média de umidade
        const sensorGroups = {};
        
        sensorData.forEach(data => {
            if (!sensorGroups[data.sensorId]) {
                sensorGroups[data.sensorId] = [];
            }
            sensorGroups[data.sensorId].push(data.moistureLevel);
        });

        // Converter para formato simplificado
        return Object.keys(sensorGroups).map(sensorId => {
            const moistureLevels = sensorGroups[sensorId];
            const averageMoisture = this.calculateAverage(moistureLevels);
            
            // Extrair ID numérico do sensorId (ex: "soil-monitor-q1-001" -> "001")
            const id = this.extractSensorId(sensorId);
            
            return {
                name: sensorId,
                location: this.location,
                id: id,
                averageMoisture: Math.round(averageMoisture * 10) / 10 // Arredondar para 1 casa decimal
            };
        });
    }

    /**
     * Calcula média aritmética
     * @param {Array<number>} numbers - números para calcular média
     * @returns {number} média aritmética
     */
    calculateAverage(numbers) {
        if (numbers.length === 0) return 0;
        return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    }

    /**
     * Extrai ID numérico do sensorId
     * @param {string} sensorId - ID completo do sensor
     * @returns {string} ID numérico extraído
     */
    extractSensorId(sensorId) {
        // Extrair os últimos 3 dígitos do sensorId
        const match = sensorId.match(/(\d{3})$/);
        return match ? match[1] : sensorId.split('-').pop() || '000';
    }

    /**
     * Valida dados simplificados
     * @returns {boolean} true se válido
     * @throws {Error} se dados inválidos
     */
    validate() {
        if (!['q1', 'q2', 'q3', 'q4'].includes(this.location)) {
            throw new Error(`Invalid location: ${this.location}`);
        }

        if (!Array.isArray(this.sensors)) {
            throw new Error('Sensors must be an array');
        }

        if (this.sensors.length === 0) {
            throw new Error('Sensors array cannot be empty');
        }

        // Validar cada sensor
        this.sensors.forEach((sensor, index) => {
            if (!sensor.name || typeof sensor.name !== 'string') {
                throw new Error(`Sensor ${index}: name must be a non-empty string`);
            }
            
            if (!sensor.location || !['q1', 'q2', 'q3', 'q4'].includes(sensor.location)) {
                throw new Error(`Sensor ${index}: invalid location`);
            }
            
            if (!sensor.id || typeof sensor.id !== 'string') {
                throw new Error(`Sensor ${index}: id must be a non-empty string`);
            }
            
            if (typeof sensor.averageMoisture !== 'number' || 
                sensor.averageMoisture < 0 || 
                sensor.averageMoisture > 100) {
                throw new Error(`Sensor ${index}: averageMoisture must be a number between 0 and 100`);
            }
        });

        return true;
    }

    /**
     * Converte para objeto JSON
     * @returns {Object} dados simplificados
     */
    toJSON() {
        return {
            sensors: this.sensors
        };
    }
}

module.exports = SimplifiedData;
