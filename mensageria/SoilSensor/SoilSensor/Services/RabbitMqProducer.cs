using RabbitMQ.Client;
using System.Text;
using System.Text.Json;
using SoilSensor.Models;

namespace SoilSensor.Services;

public class RabbitMqProducer : IDisposable
{
    private readonly IConnection _connection;
    private readonly IChannel _channel;
    private readonly string _queueName;

    public static async Task<RabbitMqProducer> CreateAsync(string hostName, int port, string queueName, string userName, string password)
    {
        Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [DEBUG] Criando conexão RabbitMQ...");
        Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [DEBUG] Host: {hostName}:{port}, Queue: {queueName}, User: {userName}");
        
        var factory = new ConnectionFactory
        {
            HostName = hostName,
            UserName = userName,
            Password = password,
            VirtualHost = "/",
            Port = port
        };

        Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [DEBUG] Estabelecendo conexão...");
        var connection = await factory.CreateConnectionAsync();
        Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [DEBUG] Conexão estabelecida, criando canal...");
        
        var channel = await connection.CreateChannelAsync();
        Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [DEBUG] Canal criado, declarando fila '{queueName}'...");
        
        // Declarar a fila com configurações robustas
        var queueDeclareResult = await channel.QueueDeclareAsync(
            queue: queueName,
            durable: true,        // Fila persiste após reinicialização do servidor
            exclusive: false,     // Fila pode ser usada por outras conexões
            autoDelete: false,    // Fila não é deletada quando não há consumidores
            arguments: null
        );
        
        Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [INFO] Fila '{queueName}' criada/verificada com sucesso");
        Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [DEBUG] Detalhes da fila: ConsumerCount={queueDeclareResult.ConsumerCount}, MessageCount={queueDeclareResult.MessageCount}");
        
        // Verificar se a fila foi criada corretamente
        if (string.IsNullOrEmpty(queueDeclareResult.QueueName))
        {
            throw new InvalidOperationException($"Falha ao criar a fila '{queueName}'. Nome da fila retornado está vazio.");
        }
        
        Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [INFO] Fila '{queueDeclareResult.QueueName}' está pronta para receber mensagens");

        return new RabbitMqProducer(connection, channel, queueName);
    }

    private RabbitMqProducer(IConnection connection, IChannel channel, string queueName)
    {
        _connection = connection;
        _channel = channel;
        _queueName = queueName;
    }
    
    public async Task<bool> IsQueueReadyAsync()
    {
        try
        {
            // Verificar se a fila existe e está acessível
            var queueDeclareResult = await _channel.QueueDeclarePassiveAsync(_queueName);
            Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [DEBUG] Fila '{_queueName}' verificada: ConsumerCount={queueDeclareResult.ConsumerCount}, MessageCount={queueDeclareResult.MessageCount}");
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [ERROR] Erro ao verificar fila '{_queueName}': {ex.Message}");
            return false;
        }
    }
    
    public async Task PublishMessageAsync(SoilMoisture message)
    {
        try
        {
            Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [DEBUG] Serializando mensagem...");
            var json = JsonSerializer.Serialize(message);
            var body = Encoding.UTF8.GetBytes(json);
            Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [DEBUG] Mensagem serializada: {json.Length} bytes");

            Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [DEBUG] Publicando mensagem na fila '{_queueName}'...");
            
            // Publicar mensagem simples mas robusta
            await _channel.BasicPublishAsync(
                exchange: "",
                routingKey: _queueName,
                body: body
            );
            
            Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [INFO] Mensagem publicada na fila '{_queueName}': SensorId={message.SensorId}, Moisture={message.MoistureLevel:F2}%, Location={message.Location}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [ERROR] Erro ao enviar mensagem: {ex.Message}");
            Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [ERROR] Stack trace: {ex.StackTrace}");
            throw; // Re-throw para que o chamador saiba que houve erro
        }
    }
    
    public void Dispose()
    {
        try
        {
            Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [DEBUG] Fechando canal RabbitMQ...");
            _channel?.Dispose();
            Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [DEBUG] Fechando conexão RabbitMQ...");
            _connection?.Dispose();
            Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [INFO] Conexão RabbitMQ fechada com sucesso");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [ERROR] Erro ao fechar conexão RabbitMQ: {ex.Message}");
        }
    }
}