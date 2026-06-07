const activeGestures = new Map();

export function attachSwipe(elementId, dotNetHelper, callbackMethodName) {
    const el = document.getElementById(elementId);
    if (!el) return false;

    let startX = 0;
    let startY = 0;
    let startTime = 0;

    const onPointerDown = (e) => {
        startX = e.clientX;
        startY = e.clientY;
        startTime = Date.now();
        try {
            el.setPointerCapture(e.pointerId);
        } catch (err) {}
    };

    const onPointerUp = (e) => {
        try {
            el.releasePointerCapture(e.pointerId);
        } catch (err) {}

        const diffX = e.clientX - startX;
        const diffY = e.clientY - startY;
        const elapsed = Date.now() - startTime;

        const minDistance = 50; // minimum swipe distance in px
        const maxTime = 600;    // maximum swipe duration in ms

        if (elapsed < maxTime) {
            const absX = Math.abs(diffX);
            const absY = Math.abs(diffY);

            if (Math.max(absX, absY) >= minDistance) {
                let direction = "";
                if (absX > absY) {
                    direction = diffX > 0 ? "right" : "left";
                } else {
                    direction = diffY > 0 ? "down" : "up";
                }
                
                try {
                    dotNetHelper.invokeMethodAsync(callbackMethodName, direction);
                } catch (err) {
                    console.error("Failed to notify Blazor of swipe gesture", err);
                }
            }
        }
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointerup', onPointerUp);

    if (!activeGestures.has(elementId)) {
        activeGestures.set(elementId, {});
    }
    const store = activeGestures.get(elementId);
    store.swipeDown = onPointerDown;
    store.swipeUp = onPointerUp;
    
    return true;
}

export function attachPullToRefresh(elementId, dotNetHelper, callbackMethodName) {
    const container = document.getElementById(elementId);
    if (!container) return false;

    // Enable touch-friendly scroll behavior
    container.style.overscrollBehaviorY = 'contain';

    // Build visual indicator if not exists
    let indicator = container.querySelector('.pull-to-refresh-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'pull-to-refresh-indicator';
        Object.assign(indicator.style, {
            height: '0px',
            opacity: '0',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            color: '#a1a1aa',
            fontFamily: 'system-ui, sans-serif',
            backgroundColor: 'rgba(24, 24, 27, 0.4)',
            backdropFilter: 'blur(6px)',
            transition: 'height 0.15s ease, opacity 0.15s ease'
        });
        indicator.innerHTML = '<span class="ptr-text">Pull to refresh...</span>';
        container.insertBefore(indicator, container.firstChild);
    }

    let startY = 0;
    let isPulling = false;

    const onPointerDown = (e) => {
        if (container.scrollTop === 0) {
            startY = e.clientY;
            isPulling = true;
            indicator.style.transition = 'none'; // Instant response on drag
        }
    };

    const onPointerMove = (e) => {
        if (!isPulling) return;
        
        const pullDist = e.clientY - startY;
        if (pullDist > 0) {
            e.preventDefault();
            const displayHeight = Math.min(pullDist * 0.45, 75); // Apply spring resistance
            indicator.style.height = `${displayHeight}px`;
            indicator.style.opacity = `${displayHeight / 75}`;
            
            const textEl = indicator.querySelector('.ptr-text');
            if (textEl) {
                if (displayHeight >= 60) {
                    textEl.textContent = "Release to refresh...";
                } else {
                    textEl.textContent = "Pull to refresh...";
                }
            }
        } else {
            isPulling = false;
            resetIndicator();
        }
    };

    const onPointerUp = () => {
        if (!isPulling) return;
        isPulling = false;

        const currentHeight = parseFloat(indicator.style.height) || 0;
        indicator.style.transition = 'height 0.2s ease, opacity 0.2s ease';

        if (currentHeight >= 60) {
            indicator.style.height = '40px';
            indicator.style.opacity = '1';
            const textEl = indicator.querySelector('.ptr-text');
            if (textEl) textEl.textContent = "Refreshing...";
            
            try {
                dotNetHelper.invokeMethodAsync(callbackMethodName);
            } catch (err) {
                console.error("Failed to send Pull-to-Refresh invoke to Blazor", err);
                resetIndicator();
            }
            
            // Fallback timeout to prevent UI hang if Blazor fails to reset
            setTimeout(() => {
                if (indicator && indicator.style.height === '40px' && textEl && textEl.textContent === "Refreshing...") {
                    resetIndicator();
                }
            }, 5000);
        } else {
            resetIndicator();
        }
    };

    function resetIndicator() {
        if (!indicator) return;
        indicator.style.transition = 'height 0.2s ease, opacity 0.2s ease';
        indicator.style.height = '0px';
        indicator.style.opacity = '0';
        const textEl = indicator.querySelector('.ptr-text');
        if (textEl) textEl.textContent = "Pull to refresh...";
    }

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);

    if (!activeGestures.has(elementId)) {
        activeGestures.set(elementId, {});
    }
    const store = activeGestures.get(elementId);
    store.ptrDown = onPointerDown;
    store.ptrMove = onPointerMove;
    store.ptrUp = onPointerUp;
    store.ptrIndicator = indicator;
    store.ptrReset = resetIndicator;

    return true;
}

export function resetPullToRefresh(elementId) {
    const store = activeGestures.get(elementId);
    if (store && store.ptrReset) {
        store.ptrReset();
        return true;
    }
    return false;
}

export function detach(elementId) {
    const el = document.getElementById(elementId);
    const store = activeGestures.get(elementId);
    
    if (!store) return false;

    if (el) {
        // Unbind swipe listeners
        if (store.swipeDown) el.removeEventListener('pointerdown', store.swipeDown);
        if (store.swipeUp) el.removeEventListener('pointerup', store.swipeUp);

        // Unbind pull-to-refresh listeners
        if (store.ptrDown) el.removeEventListener('pointerdown', store.ptrDown);
        if (store.ptrMove) el.removeEventListener('pointermove', store.ptrMove);
        if (store.ptrUp) {
            el.removeEventListener('pointerup', store.ptrUp);
            el.removeEventListener('pointercancel', store.ptrUp);
        }

        // Remove pull indicator
        if (store.ptrIndicator && store.ptrIndicator.parentNode === el) {
            try {
                el.removeChild(store.ptrIndicator);
            } catch (e) {
                console.error("Failed to remove pointer indicator", e);
            }
        }
    }
    
    activeGestures.delete(elementId);
    return true;
}
