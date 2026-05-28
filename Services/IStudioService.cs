using Microsoft.JSInterop;
using Microsoft.AspNetCore.Components;
using BlazorPwaTemplate.Models;

namespace BlazorPwaTemplate.Services;

public interface IStudioService
{
    Task InitStudioAsync(DotNetObjectReference<object> helper, string callbackName, string gridCallbackName);
    Task InitRibbonAsync(ElementReference ribbon, DotNetObjectReference<object> helper, string callbackName);
    Task StartPlayAsync(StudioAudioState state);
    Task StopPlayAsync();
    Task UpdateStateAsync(StudioAudioState state);
    Task TriggerLiveTapAsync(int trackIndex);
    Task PlayFrequencyAsync(int trackIndex, double frequency);
}
