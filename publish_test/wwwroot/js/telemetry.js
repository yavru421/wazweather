(function() {
    // Check or generate persistent User UUID
    let userUuid = localStorage.getItem('waz_user_uuid');
    if (!userUuid) {
        userUuid = crypto.randomUUID();
        localStorage.setItem('waz_user_uuid', userUuid);
    }

    let telemetryData = {
        user_uuid: userUuid,
        event_type: 'page_load',
        connection_type: 'unknown',
        pwa_installed: false,
        web_vitals_ttfb: null,
        web_vitals_fcp: null,
        web_vitals_cls: null,
        latency_ms: null
    };

    // 1. Detect Connection Type
    if (navigator.connection && navigator.connection.effectiveType) {
        telemetryData.connection_type = navigator.connection.effectiveType;
    }

    // 2. Detect PWA Install Status
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
        telemetryData.pwa_installed = true;
    }

    // 3. Web Vitals
    function collectWebVitals() {
        if (performance.getEntriesByType) {
            const paintEntries = performance.getEntriesByType('paint');
            const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
            if (fcpEntry) {
                telemetryData.web_vitals_fcp = fcpEntry.startTime;
            }

            const navEntries = performance.getEntriesByType('navigation');
            if (navEntries.length > 0) {
                telemetryData.web_vitals_ttfb = navEntries[0].responseStart - navEntries[0].requestStart;
                telemetryData.latency_ms = navEntries[0].duration; // Total page load
            }
        }
    }

    // Capture Web Vitals after load
    window.addEventListener('load', () => {
        setTimeout(() => {
            collectWebVitals();
            
            // 4. Send Telemetry to Edge Worker
            if (navigator.sendBeacon) {
                navigator.sendBeacon('/api/analytics', JSON.stringify(telemetryData));
            } else {
                fetch('/api/analytics', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(telemetryData),
                    keepalive: true
                }).catch(console.error);
            }
        }, 1000);
    });

})();
