using System;
using System.Runtime.InteropServices.JavaScript;

namespace BlazorPwaTemplate.Pages
{
    public partial class Index : IDisposable
    {
        public static string CurrentMode { get; private set; } = "Measure";
        private static double _pixelToMmRatio = 1.0; 
        public static double LatestMeasurement { get; private set; } = 0.0;

        public static event Action? OnMeasurementUpdated;

        protected override void OnInitialized()
        {
            OnMeasurementUpdated += HandleMeasurementUpdated;
        }

        private void HandleMeasurementUpdated()
        {
            InvokeAsync(StateHasChanged);
        }

        public void Dispose()
        {
            OnMeasurementUpdated -= HandleMeasurementUpdated;
        }

        private void SetCalibrateMode()
        {
            CurrentMode = "Calibrate";
            StateHasChanged();
        }

        private void SetMeasureMode()
        {
            CurrentMode = "Measure";
            StateHasChanged();
        }

        [JSExport]
        public static void CalculateDistance(double startX, double startY, double currentX, double currentY)
        {
            double pixelDistance = Math.Sqrt(Math.Pow(currentX - startX, 2) + Math.Pow(currentY - startY, 2));

            if (CurrentMode == "Calibrate")
            {
                // Assume the user is tracking a known 300mm reference object
                double referenceLengthMm = 300.0;
                
                if (pixelDistance > 0)
                {
                    _pixelToMmRatio = referenceLengthMm / pixelDistance;
                    LatestMeasurement = referenceLengthMm;
                }
            }
            else // Measure
            {
                // Convert pixel distance to physical dimension using our established ratio
                LatestMeasurement = pixelDistance * _pixelToMmRatio;
            }

            // Notify UI to refresh
            OnMeasurementUpdated?.Invoke();
        }
    }
}
