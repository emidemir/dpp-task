namespace Dpp.Api.Dtos;

public class CsvRowError
{
    public int RowNumber { get; set; }

    public List<string> Messages { get; set; } = [];
}
