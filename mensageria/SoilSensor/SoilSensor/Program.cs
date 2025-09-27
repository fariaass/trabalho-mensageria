using SoilSensor.Services;
using Microsoft.Extensions.Configuration;

Console.WriteLine("=== Monitor de Umidade do Solo ===");
Console.WriteLine("Iniciando sensor...");

// Carregar configurações
var configuration = new ConfigurationBuilder()
    .SetBasePath(Directory.GetCurrentDirectory())
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .Build();

// Obter configurações do RabbitMQ
var rabbitHost = configuration["RabbitMQ:HostName"] ?? "localhost";
var queueName = configuration["RabbitMQ:QueueName"] ?? "soil-moisture-data";
var userName = configuration["RabbitMQ:UserName"] ?? "guest";
var password = configuration["RabbitMQ:Password"] ?? "guest";

// Obter configurações do sensor
var minInterval = int.Parse(configuration["Sensor:MinIntervalSeconds"] ?? "10");
var maxInterval = int.Parse(configuration["Sensor:MaxIntervalSeconds"] ?? "20");

Console.WriteLine($"Conectando ao RabbitMQ: {rabbitHost}");
Console.WriteLine($"Fila: {queueName}");
Console.WriteLine($"Intervalo de leitura: {minInterval}-{maxInterval} segundos");

// Obter configurações do sensor
var sensorId = configuration["Sensor:SensorId"] ?? "soil-monitor-001";
var location = configuration["Sensor:Location"] ?? "sector-A";

// Inicializar serviços
var soilSensorService = new SoilSensorService(sensorId, location);
var rabbitProducer = await RabbitMQProducer.CreateAsync(rabbitHost, queueName, userName, password);

var random = new Random();

try
{
    while (true)
    {
        var soilData = soilSensorService.GetSoilMoistureData();
        
        await rabbitProducer.PublishMessageAsync(soilData);
        
        var delay = random.Next(minInterval * 1000, maxInterval * 1000);
        Console.WriteLine($"Próxima leitura em {delay / 1000} segundos...");
        Thread.Sleep(delay);
    }
}
catch (Exception ex)
{
    Console.WriteLine($"Erro na aplicação: {ex.Message}");
}
finally
{
    rabbitProducer.Dispose();
    Console.WriteLine("Sensor finalizado.");
}