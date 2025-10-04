# Sistema de Mensageria - Docker Compose

Sistema de mensageria distribuído para monitoramento de umidade do solo com múltiplos sensores e irrigação automática.

## 🚀 Início Rápido

### Pré-requisitos
- Docker instalado
- Docker Compose instalado

### Executar o Sistema

```bash
# Iniciar todos os serviços
docker-compose up -d

# Ver logs em tempo real
docker-compose logs -f

# Parar o sistema
docker-compose down
```

## 🌐 Acessos

- **RabbitMQ Management**: http://localhost:15672 (user/password)
- **Prometheus Pushgateway**: http://localhost:9091

## 📋 Serviços Incluídos

1. **RabbitMQ** - Message broker principal
2. **Prometheus Pushgateway** - Coleta de métricas
3. **4 Sensores de Solo** - Geram dados de umidade de diferentes quadrantes
4. **Aggregator Service** - Processa dados de todos os sensores
5. **Controlador de Umidade** - Toma decisões de irrigação
6. **4 Irrigadores** - Executam comandos de irrigação específicos
7. **Monitoramento de Máquinas** - Gera métricas de sistema
8. **Coletor de Métricas** - Envia métricas para Prometheus

## 🔄 Fluxo do Sistema

```
Sensores → soil-moisture-data → Aggregator → soil-moisture-sensors → Controlador → Irrigadores
```

1. **4 Sensores** geram dados de umidade em intervalos diferentes (8-25s)
2. **Aggregator** processa dados de todos os sensores
3. **Controlador** analisa dados e decide sobre irrigação (threshold: 30%)
4. **4 Irrigadores** executam comandos específicos por quadrante

## ⚙️ Configuração

### Variáveis de Ambiente

As configurações estão no arquivo `docker-compose.yml`:

```yaml
environment:
  SENSOR_MIN_INTERVAL_SECONDS: 8    # Intervalo mínimo dos sensores
  SENSOR_MAX_INTERVAL_SECONDS: 15   # Intervalo máximo dos sensores
  MOISTURE_THRESHOLD: 30.0          # Threshold de umidade para irrigação
```

### Personalizar Configurações

Para alterar configurações, edite o arquivo `docker-compose.yml` e reinicie:

```bash
docker-compose up --build -d
```

## 📊 Monitoramento

### Ver Logs

```bash
# Todos os serviços
docker-compose logs -f

# Sensores específicos
docker-compose logs -f soil-sensor-q1 soil-sensor-q2

# Irrigadores
docker-compose logs -f irrigador-q1 irrigador-q2

# Controlador de umidade
docker-compose logs -f controlador-umidade
```

### Verificar Status

```bash
# Status de todos os serviços
docker-compose ps

# Verificar saúde dos serviços
docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
```

### Comandos Úteis

```bash
# Reiniciar um serviço específico
docker-compose restart soil-sensor-q1

# Executar comando em um container
docker-compose exec soil-sensor-q1 env

# Ver logs de múltiplos serviços
docker-compose logs -f soil-sensor-q1 soil-sensor-q2 soil-sensor-q3 soil-sensor-q4
```

## 🛠️ Desenvolvimento

### Rebuild de Serviços

```bash
# Rebuild todos os serviços
docker-compose up --build -d

# Rebuild um serviço específico
docker-compose up --build -d soil-sensor-q1

# Build sem cache
docker-compose build --no-cache
```

### Limpeza

```bash
# Parar e remover containers
docker-compose down

# Remover volumes e imagens
docker-compose down -v --rmi all

# Limpeza completa do Docker
docker system prune -a
```

## 🔧 Troubleshooting

### Problemas Comuns

1. **Serviços não iniciam:**
   ```bash
   docker-compose logs <service-name>
   ```

2. **Erro de conexão com RabbitMQ:**
   ```bash
   docker-compose restart rabbitmq
   ```

3. **Portas em uso:**
   ```bash
   lsof -i :5672
   lsof -i :15672
   ```

### Verificação de Saúde

```bash
# Verificar se RabbitMQ está respondendo
curl -u user:password http://localhost:15672/api/overview

# Verificar se Prometheus Pushgateway está respondendo
curl http://localhost:9091/metrics
```

## 🎯 Características

- **4 Sensores** com intervalos diferentes (8-25s)
- **Processamento em tempo real** de dados
- **Irrigação seletiva** por quadrante
- **Monitoramento completo** com métricas
- **Health checks** automáticos
- **Restart automático** em caso de falha
- **Rede interna** para comunicação entre serviços