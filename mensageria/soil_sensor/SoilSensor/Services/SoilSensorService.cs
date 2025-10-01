using SoilSensor.Models;

namespace SoilSensor.Services;

public interface ISoilSensorService
{
    SoilMoisture GetSoilMoistureData();
}

public class SoilSensorService : ISoilSensorService
{
    private readonly Random _random = new();
    private readonly string _sensorId;
    private readonly string _location;

    public SoilSensorService(string sensorId, string location = "sector-A")
    {
        _sensorId = sensorId;
        _location = location;
    }

    public SoilMoisture GetSoilMoistureData()
    {
        return new SoilMoisture
        {
            Timestamp = DateTime.UtcNow.ToString("o"),
            SensorId = _sensorId,
            MoistureLevel = _random.NextDouble() * 100,
            Unit = "percentage",
            Temperature = 10 + _random.NextDouble() * 30,
            Location = _location
        };
    }
}