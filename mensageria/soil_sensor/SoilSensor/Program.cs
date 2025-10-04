using SoilSensor.Services;
using Microsoft.Extensions.Configuration;

// Função para logging com timestamp
void LogInfo(string message) => Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [INFO] {message}");
void LogError(string message) => Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [ERROR] {message}");
void LogWarning(string message) => Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [WARN] {message}");
void LogDebug(string message) => Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [DEBUG] {message}");

LogInfo("=== Monitor de Umidade do Solo ===");
LogInfo("Iniciando sensor...");

// Carregar configurações
LogDebug("Carregando configurações...");
var configuration = new ConfigurationBuilder()
    .SetBasePath(Directory.GetCurrentDirectory())
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddEnvironmentVariables()
    .Build();

// Obter configurações do RabbitMQ (priorizar variáveis de ambiente)
var rabbitHost = Environment.GetEnvironmentVariable("RABBITMQ_HOST") ?? configuration["RabbitMQ:HostName"] ?? "localhost";
var queueName = Environment.GetEnvironmentVariable("RABBITMQ_QUEUE") ?? configuration["RabbitMQ:QueueName"] ?? "soil-moisture-data";
var userName = Environment.GetEnvironmentVariable("RABBITMQ_USERNAME") ?? configuration["RabbitMQ:UserName"] ?? "guest";
var password = Environment.GetEnvironmentVariable("RABBITMQ_PASSWORD") ?? configuration["RabbitMQ:Password"] ?? "guest";
var rabbitPort = 5672;
if (int.TryParse(Environment.GetEnvironmentVariable("RABBITMQ_PORT") ?? configuration["RabbitMQ:Port"], out var port))
    rabbitPort = port;

// Obter configurações do sensor (priorizar variáveis de ambiente)
var minInterval = int.Parse(Environment.GetEnvironmentVariable("SENSOR_MIN_INTERVAL_SECONDS") ?? configuration["Sensor:MinIntervalSeconds"] ?? "10");
var maxInterval = int.Parse(Environment.GetEnvironmentVariable("SENSOR_MAX_INTERVAL_SECONDS") ?? configuration["Sensor:MaxIntervalSeconds"] ?? "20");

LogInfo($"Configurações carregadas:");
LogInfo($"  RabbitMQ Host: {rabbitHost}:{rabbitPort}");
LogInfo($"  Fila: {queueName}");
LogInfo($"  Usuário: {userName}");
LogInfo($"  Intervalo de leitura: {minInterval}-{maxInterval} segundos");

// Obter configurações do sensor
var sensorId = Environment.GetEnvironmentVariable("SENSOR_ID") ?? configuration["Sensor:SensorId"] ?? "soil-monitor-001";
var location = Environment.GetEnvironmentVariable("SENSOR_LOCATION") ?? configuration["Sensor:Location"] ?? "sector-A";

LogInfo($"Sensor ID: {sensorId}");
LogInfo($"Localização: {location}");

// Inicializar serviços
LogInfo("Inicializando serviços...");
var soilSensorService = new SoilSensorService(sensorId, location);
LogInfo("SoilSensorService inicializado");

LogInfo("Conectando ao RabbitMQ...");
RabbitMqProducer rabbitProducer = null;
int maxRetries = 10;
int retryDelay = 5000; // 5 segundos

for (int attempt = 1; attempt <= maxRetries; attempt++)
{
    try
    {
        LogInfo($"Tentativa {attempt}/{maxRetries} de conexão com RabbitMQ...");
        rabbitProducer = await RabbitMqProducer.CreateAsync(rabbitHost, rabbitPort, queueName, userName, password);
        LogInfo("Conexão com RabbitMQ estabelecida com sucesso!");
        break;
    }
    catch (Exception ex)
    {
        LogError($"Tentativa {attempt} falhou: {ex.Message}");
        if (attempt == maxRetries)
        {
            LogError("Todas as tentativas de conexão falharam. Encerrando aplicação.");
            return;
        }
        LogInfo($"Aguardando {retryDelay/1000} segundos antes da próxima tentativa...");
        Thread.Sleep(retryDelay);
    }
}

// Verificar se a fila está pronta
LogInfo("Verificando se a fila está pronta...");
var isQueueReady = await rabbitProducer.IsQueueReadyAsync();
if (!isQueueReady)
{
    LogError("Fila não está pronta! Encerrando aplicação.");
    return;
}
LogInfo("Fila verificada e pronta para receber mensagens!");

var random = new Random();
var messageCount = 0;

LogInfo("=== Iniciando loop principal de monitoramento ===");

try
{
    while (true)
    {
        messageCount++;
        LogDebug($"--- Ciclo #{messageCount} ---");
        
        LogDebug("Coletando dados do sensor...");
        var soilData = soilSensorService.GetSoilMoistureData();
        LogInfo($"Dados coletados: SensorId={soilData.SensorId}, Location={soilData.Location}, Moisture={soilData.MoistureLevel:F2}%, Timestamp={soilData.Timestamp:yyyy-MM-dd HH:mm:ss}");
        
        LogDebug("Enviando mensagem para RabbitMQ...");
        await rabbitProducer.PublishMessageAsync(soilData);
        LogInfo($"Mensagem #{messageCount} enviada com sucesso para a fila '{queueName}'");
        
        var delay = random.Next(minInterval * 1000, maxInterval * 1000);
        LogInfo($"Aguardando {delay / 1000} segundos para próxima leitura...");
        Thread.Sleep(delay);
    }
}
catch (Exception ex)
{
    LogError($"Erro na aplicação: {ex.Message}");
    LogError($"Stack trace: {ex.StackTrace}");
}
finally
{
    LogInfo("Finalizando aplicação...");
    rabbitProducer.Dispose();
    LogInfo($"Sensor finalizado. Total de mensagens enviadas: {messageCount}");
}