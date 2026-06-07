const activeElements = new Map();

export function attachSwipe(elementId, dotNetHelper, callbackMethodName) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    detach(elementId); // Clean up first if any
    
    let touchstartX = 0;
    let touchstartY = 0;
    
    const handleTouchStart = (e) => {
        touchstartX = e.changedTouches[0].screenX;
        touchstartY = e.changedTouches[0].screenY;
    };
    
    const handleTouchEnd = (e) => {
        const touchendX = e.changedTouches[0].screenX;
        const touchendY = e.changedTouches[0].screenY;
        
        const diffX = touchendX - touchstartX;
        const diffY = touchendY - touchstartY;
        
        if (Math.abs(diffX) > Math.abs(diffY)) {
            // Horizontal swipe
            if (Math.abs(diffX) > 50) {
                const direction = diffX > 0 ? "right" : "left";
                dotNetHelper.invokeMethodAsync(callbackMethodName, direction);
            }
        } else {
            // Vertical swipe
            if (Math.abs(diffY) > 50) {
                const direction = diffY > 0 ? "down" : "up";
                dotNetHelper.invokeMethodAsync(callbackMethodName, direction);
            }
        }
    };
    
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    activeElements.set(elementId, {
        type: 'swipe',
        listeners: [
            { name: 'touchstart', handler: handleTouchStart },
            { name: 'touchend', handler: handleTouchEnd }
        ]
    });
}

export function attachPullToRefresh(elementId, dotNetHelper, callbackMethodName) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    detach(elementId);
    
    let startY = 0;
    let isPulling = false;
    
    const handleTouchStart = (e) => {
        if (element.scrollTop === 0) {
            startY = e.touches[0].pageY;
            isPulling = true;
        }
    };
    
    const handleTouchMove = (e) => {
        if (!isPulling) return;
        const currentY = e.touches[0].pageY;
        const diff = currentY - startY;
        
        if (diff > 100) {
            isPulling = false;
            dotNetHelper.invokeMethodAsync(callbackMethodName);
        }
    };
    
    const handleTouchEnd = () => {
        isPulling = false;
    };
    
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    activeElements.set(elementId, {
        type: 'pull',
        listeners: [
            { name: 'touchstart', handler: handleTouchStart },
            { name: 'touchmove', handler: handleTouchMove },
            { name: 'touchend', handler: handleTouchEnd }
        ]
    });
}

export function detach(elementId) {
    const record = activeElements.get(elementId);
    if (!record) return;
    
    const element = document.getElementById(elementId);
    if (element) {
        record.listeners.forEach(item => {
            element.removeEventListener(item.name, item.handler);
        });
    }
    activeElements.delete(elementId);
}
