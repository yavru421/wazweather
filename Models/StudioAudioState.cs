namespace BlazorPwaTemplate.Models;

public class StudioAudioState
{
    public int Bpm { get; set; } = 96;
    public string Key { get; set; } = "C";
    public string Scale { get; set; } = "Minor";
    public bool[][] Grid { get; set; } = new bool[5][];
    public double[] Melody { get; set; } = new double[16];
    public double[] BassNotes { get; set; } = new double[16];
    public string[] Chords { get; set; } = new string[8];
    public int ActiveChordIndex { get; set; } = 0;
    
    // Channel Fader & Control Strips (Length 5: 0=Drums, 1=Hats, 2=Chords, 3=Bass, 4=Lead)
    public double[] Volume { get; set; } = new double[5] { 0.85, 0.75, 0.8, 0.8, 0.75 };
    public double[] Pitch { get; set; } = new double[5] { 0.5, 0.5, 0.5, 0.5, 0.5 };
    public double[] Decay { get; set; } = new double[5] { 0.5, 0.5, 0.5, 0.5, 0.5 };
    public double[] TonePreset { get; set; } = new double[5] { 0.0, 0.0, 0.0, 0.0, 0.0 };
}
