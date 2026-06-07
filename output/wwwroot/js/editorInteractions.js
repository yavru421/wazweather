window.editorInteractions = {
    init: function () {
        // Apply haptic feedback to draggable elements or interactive buttons
        document.querySelectorAll('.stack-card, .strip-thumb, .fab-new-doc').forEach(el => {
            el.addEventListener('click', () => {
                if (navigator.vibrate) {
                    navigator.vibrate(10);
                }
            });
        });
    }
};
