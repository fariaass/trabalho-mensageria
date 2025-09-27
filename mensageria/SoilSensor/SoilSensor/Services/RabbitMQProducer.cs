using RabbitMQ.Client;
using System.Text;
using System.Text.Json;
using SoilSensor.Models;

namespace SoilSensor.Services;

public class RabbitMQProducer : IDisposable
{
    private readonly IConnection _connection;
    private readonly IChannel _channel;
    private readonly string _queueName;

    public static async Task<RabbitMQProducer> CreateAsync(string hostName, string queueName, string userName, string password)
    {
        var factory = new ConnectionFactory
        {
            HostName = hostName,
            UserName = userName,
            Password = password,
            VirtualHost = "/",
            Port = 5672 // Usando porta padrão do AMQP
        };

        var connection = await factory.CreateConnectionAsync();
        var channel = await connection.CreateChannelAsync();
        
        // Declarar a fila
        await channel.QueueDeclareAsync(
            queue: queueName,
            durable: true,
            exclusive: false,
            autoDelete: false,
            arguments: null
        );

        return new RabbitMQProducer(connection, channel, queueName);
    }

    private RabbitMQProducer(IConnection connection, IChannel channel, string queueName)
    {
        _connection = connection;
        _channel = channel;
        _queueName = queueName;
    }
    
    public async Task PublishMessageAsync(SoilMoisture message)
    {
        try
        {
            var json = JsonSerializer.Serialize(message);
            var body = Encoding.UTF8.GetBytes(json);

            await _channel.BasicPublishAsync(
                exchange: "",
                routingKey: _queueName,
                body: body
            );

            Console.WriteLine($"Mensagem enviada para a fila {_queueName}: {message.SensorId} - {message.MoistureLevel:F2}%");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Erro ao enviar mensagem: {ex.Message}");
        }
    }
    
    public void Dispose()
    {
        try
        {
            _channel?.Dispose();
            _connection?.Dispose();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Erro ao fechar conexão RabbitMQ: {ex.Message}");
        }
    }
}