let leafletPromise = null;
const maps = new Map();

export function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported by this browser."));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            (error) => {
                reject(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
}

export function watchPosition(dotNetHelper, callbackMethodName) {
    if (!navigator.geolocation) {
        throw new Error("Geolocation is not supported by this browser.");
    }
    const watchId = navigator.geolocation.watchPosition(
        (position) => {
            try {
                dotNetHelper.invokeMethodAsync(callbackMethodName, {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            } catch (err) {
                console.error("Failed to send location change callback to Blazor", err);
            }
        },
        (error) => {
            console.error("watchPosition error: ", error);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
    return watchId;
}

export function clearWatch(watchId) {
    if (navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
    }
}

export function loadLeaflet() {
    if (window.L) {
        return Promise.resolve();
    }
    if (leafletPromise) {
        return leafletPromise;
    }

    leafletPromise = new Promise((resolve, reject) => {
        // Load CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.crossOrigin = '';
        document.head.appendChild(link);

        // Load JS
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.crossOrigin = '';
        script.onload = () => {
            resolve();
        };
        script.onerror = (err) => {
            leafletPromise = null; // Reset so that it can be retried on failure
            reject(err);
        };
        document.head.appendChild(script);
    });

    return leafletPromise;
}

export function initMap(elementId, lat, lng) {
    if (!window.L) {
        throw new Error("Leaflet is not loaded. Call loadLeaflet() first.");
    }
    
    const container = document.getElementById(elementId);
    if (!container) {
        throw new Error(`Element with id ${elementId} not found.`);
    }

    // If there was an existing map on this element, destroy it first to avoid errors.
    if (maps.has(elementId)) {
        try {
            maps.get(elementId).remove();
        } catch (e) {
            console.error("Failed to remove old map", e);
        }
        maps.delete(elementId);
    }

    const map = window.L.map(elementId).setView([lat, lng], 13);
    
    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    window.L.marker([lat, lng]).addTo(map);
    
    maps.set(elementId, map);
    return true;
}
