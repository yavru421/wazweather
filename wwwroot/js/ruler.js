export function initCanvas() {
    const canvas = document.getElementById('measureCanvas');
    if (!canvas) {
        console.error("Canvas element 'measureCanvas' not found.");
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Crucial step: Set internal dimensions to match the screen
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let isDrawing = false;
    let startX = 0, startY = 0;
    let currentX = 0, currentY = 0;

    // Touch Event Listeners
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            currentX = startX;
            currentY = startY;
            isDrawing = true;
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (isDrawing && e.touches.length > 0) {
            // Architectural Note: Prevent iOS Safari scrolling / pull-to-refresh
            e.preventDefault();
            
            const touch = e.touches[0];
            currentX = touch.clientX;
            currentY = touch.clientY;
        }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        if (isDrawing) {
            isDrawing = false;
            
            // C# Interop placeholder for Phase 3
            globalThis.App = globalThis.App || {};
            if (typeof globalThis.App.CalculateDistance === 'function') {
                globalThis.App.CalculateDistance(startX, startY, currentX, currentY);
            } else {
                console.log(`[Placeholder] Calculated distance from (${startX}, ${startY}) to (${currentX}, ${currentY})`);
            }
        }
    }, { passive: false });
    
    // Also handle touchcancel identically to touchend
    canvas.addEventListener('touchcancel', () => {
        isDrawing = false;
    }, { passive: false });

    // The requestAnimationFrame Loop
    function renderLoop() {
        // Clear the entire canvas frame
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw the measuring line if active
        if (isDrawing) {
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(currentX, currentY);
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round'; // makes the line ends smoother
            ctx.stroke();
        }

        // Recursively request the next frame
        requestAnimationFrame(renderLoop);
    }

    // Start the render loop
    requestAnimationFrame(renderLoop);
}
