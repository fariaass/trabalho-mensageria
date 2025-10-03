# Serviço de Agregação de Dados de Sensores Simplificado

## Visão Geral

O Serviço de Agregação é um componente intermediário que processa dados brutos de sensores de solo, agrupa-os por período e localização, e publica dados simplificados para consumidores.

## Funcionalidades

- **Consumo de Dados**: Consome dados da fila `soil-moisture-data`
- **Agregação Temporal**: Agrupa dados por períodos configuráveis (padrão: 5 minutos)
- **Agregação por Localização**: Processa dados de cada quadrante (q1, q2, q3, q4) independentemente
- **Cálculo de Média**: Calcula média de umidade por sensor
- **Publicação de Dados**: Publica dados simplificados na fila `soil-moisture-sensors`
- **Tratamento de Erros**: Retry automático e tratamento robusto de falhas
- **Monitoramento**: Logs estruturados e métricas de performance

## Arquitetura

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Soil Sensors  │───▶│  Input Queue     │───▶│   Aggregator    │
│   (q1, q2, q3,  │    │ soil-moisture-   │    │   Service       │
│    q4)          │    │ data             │    │   (Node.js)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Consumers     │◀───│  Output Queue    │◀───│   Simplified    │
│   (New Format)  │    │ soil-moisture-   │    │   Data          │
│                 │    │ sensors          │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Estrutura de Dados

### Entrada (soil-moisture-data)
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "sensorId": "soil-monitor-q1-001",
  "moistureLevel": 65.5,
  "unit": "percentage",
  "location": "q1"
}
```

### Saída (soil-moisture-sensors)
```json
{
  "sensors": [
    {
      "name": "soil-monitor-q1-001",
      "location": "q1",
      "id": "001",
      "averageMoisture": 65.5
    },
    {
      "name": "soil-monitor-q1-002",
      "location": "q1",
      "id": "002",
      "averageMoisture": 62.3
    }
  ]
}
```

## Configuração

### Variáveis de Ambiente Obrigatórias
- `RABBITMQ_HOST`: Host do RabbitMQ
- `RABBITMQ_PORT`: Porta do RabbitMQ
- `RABBITMQ_USERNAME`: Usuário do RabbitMQ
- `RABBITMQ_PASSWORD`: Senha do RabbitMQ
- `INPUT_QUEUE`: Fila de entrada (soil-moisture-data)
- `OUTPUT_QUEUE`: Fila de saída (soil-moisture-sensors)

### Variáveis de Ambiente Opcionais
- `AGGREGATION_PERIOD_MINUTES`: Período de agregação em minutos (padrão: 5)
- `AGGREGATION_TOLERANCE_SECONDS`: Tolerância de agrupamento em segundos (padrão: 30)
- `LOG_LEVEL`: Nível de log (padrão: info)
- `LOG_FORMAT`: Formato de log (padrão: json)
- `MAX_MESSAGES_PER_MINUTE`: Limite de mensagens por minuto (padrão: 100)
- `MAX_MEMORY_MB`: Limite de memória em MB (padrão: 50)
- `MAX_LATENCY_SECONDS`: Limite de latência em segundos (padrão: 2)

## Instalação e Execução

### Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Executar em modo desenvolvimento
npm run dev

# Executar em produção
npm start

```

### Docker

```bash
# Build da imagem
docker build -t aggregator-service:1.0.0 .

# Executar container
docker run -e RABBITMQ_HOST=localhost aggregator-service:1.0.0
```

### Kubernetes

```bash
# Aplicar manifestos
kubectl apply -f kubernetes/aggregator-service/

# Verificar status
kubectl get pods -n aggregator-service

# Ver logs
kubectl logs -f deployment/aggregator-service -n aggregator-service
```

## Monitoramento

### Logs Estruturados
O serviço produz logs estruturados em formato JSON com informações sobre:
- Dados de sensores recebidos
- Dados simplificados publicados
- Erros de validação
- Métricas de performance
- Status de saúde

### Métricas de Performance
- Mensagens processadas por minuto
- Taxa de erro
- Uso de memória
- Períodos ativos
- Tempo de atividade

### Health Checks
- Verificação de conexão com RabbitMQ
- Status dos componentes internos
- Métricas de atividade recente

## Regras de Negócio Implementadas

- **RB001**: Consumo de dados de sensores com validação
- **RB002**: Agregação temporal configurável
- **RB003**: Agregação por localização
- **RB004**: Cálculo de média de umidade por sensor
- **RB005**: Estrutura de dados simplificada
- **RB006**: Publicação de dados simplificados
- **RB007**: Tratamento de dados insuficientes
- **RB008**: Configuração via variáveis de ambiente
- **RB009**: Tratamento robusto de erros
- **RB010**: Performance e escalabilidade

## Troubleshooting

### Problemas Comuns

1. **Falha de conexão com RabbitMQ**
   - Verificar configurações de host, porta, usuário e senha
   - Verificar se o RabbitMQ está rodando
   - Verificar conectividade de rede

2. **Dados não sendo processados**
   - Verificar se a fila de entrada existe
   - Verificar logs de validação
   - Verificar configuração de período de agregação

3. **Alto uso de memória**
   - Verificar configuração de limite de memória
   - Verificar se há períodos não processados
   - Verificar logs de performance

### Logs Importantes

```bash
# Ver logs em tempo real
kubectl logs -f deployment/aggregator-service -n aggregator-service

# Filtrar logs de erro
kubectl logs deployment/aggregator-service -n aggregator-service | grep ERROR

# Filtrar logs de performance
kubectl logs deployment/aggregator-service -n aggregator-service | grep "Performance metrics"
```

## Desenvolvimento

### Estrutura do Projeto
```
src/
├── index.js              # Ponto de entrada
├── config/
│   └── config.js         # Configurações
├── consumer/
│   └── rabbitmq.js       # Consumidor RabbitMQ
├── producer/
│   └── rabbitmq.js       # Produtor RabbitMQ
├── aggregator/
│   └── temporal.js       # Agregação temporal
├── models/
│   ├── sensor.js         # Modelo de dados do sensor
│   ├── aggregated.js     # Modelo de dados agregados
│   └── simplified.js     # Modelo de dados simplificados
└── utils/
    └── logger.js         # Sistema de logging
```

### Contribuição
1. Seguir as regras de desenvolvimento definidas
2. Atualizar documentação conforme necessário
3. Seguir padrões de código estabelecidos

## Licença

ISC License - Sistema de Mensageria FURB
