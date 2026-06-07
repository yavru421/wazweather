namespace ShotStack.Models
{
    public class StagedFrameItem
    {
        public string Id { get; set; } = System.Guid.NewGuid().ToString();
        public byte[] RawBytes { get; set; } = System.Array.Empty<byte>();
        public string Base64Preview { get; set; } = string.Empty;
        public string SourceName { get; set; } = string.Empty;
        public int OrderIndex { get; set; }
        
        // Dynamic trimming properties for eliminating system bars (in percentages)
        public int TopCropPercent { get; set; } = 0;
        public int BottomCropPercent { get; set; } = 0;

        // File size tracking
        public long SizeBytes { get; set; } = 0;
    }
}

