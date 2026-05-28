using Microsoft.JSInterop;
using Microsoft.AspNetCore.Components;
using BlazorPwaTemplate.Models;

namespace BlazorPwaTemplate.Services;

public class StudioService : IStudioService, IAsyncDisposable
{
    private readonly Lazy<Task<IJSObjectReference>> _moduleTask;

    public StudioService(IJSRuntime jsRuntime)
    {
        _moduleTask = new(() => jsRuntime.InvokeAsync<IJSObjectReference>(
            "import", "./js/studio.module.js").AsTask());
    }

    public async Task InitStudioAsync(DotNetObjectReference<object> helper, string callbackName, string gridCallbackName)
    {
        var m = await _moduleTask.Value;
        await m.InvokeVoidAsync("initStudio", helper, callbackName, gridCallbackName);
    }

    public async Task InitRibbonAsync(ElementReference ribbon, DotNetObjectReference<object> helper, string callbackName)
    {
        var m = await _moduleTask.Value;
        await m.InvokeVoidAsync("initRibbon", ribbon, helper, callbackName);
    }

    public async Task StartPlayAsync(StudioAudioState state)
    {
        var m = await _moduleTask.Value;
        await m.InvokeVoidAsync("startPlay", state);
    }

    public async Task StopPlayAsync()
    {
        var m = await _moduleTask.Value;
        await m.InvokeVoidAsync("stopPlay");
    }

    public async Task UpdateStateAsync(StudioAudioState state)
    {
        var m = await _moduleTask.Value;
        await m.InvokeVoidAsync("updateState", state);
    }

    public async Task TriggerLiveTapAsync(int trackIndex)
    {
        var m = await _moduleTask.Value;
        await m.InvokeVoidAsync("triggerLivePad", trackIndex);
    }

    public async Task PlayFrequencyAsync(int trackIndex, double frequency)
    {
        var m = await _moduleTask.Value;
        await m.InvokeVoidAsync("playFrequency", trackIndex, frequency);
    }

    public async ValueTask DisposeAsync()
    {
        if (_moduleTask.IsValueCreated)
        {
            var m = await _moduleTask.Value;
            await m.DisposeAsync();
        }
    }
}
