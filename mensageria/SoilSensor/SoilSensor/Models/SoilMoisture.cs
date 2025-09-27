using System.Text.Json.Serialization;

namespace SoilSensor.Models;

public record SoilMoisture
{
    [JsonPropertyName("timestamp")]
    public string Timestamp { get; init; } = string.Empty;
    
    [JsonPropertyName("sensorId")]
    public string SensorId { get; init; } = string.Empty;
    
    [JsonPropertyName("moistureLevel")]
    public double MoistureLevel { get; set; }
    
    [JsonPropertyName("unit")]
    public string Unit { get; set; } = "percentage";
    
    [JsonPropertyName("temperature")]
    public double Temperature { get; set; }
    
    [JsonPropertyName("location")]
    public string Location { get; set; } = string.Empty;
}
