document.addEventListener('DOMContentLoaded', function() {
    const usernameDisplay = document.getElementById('usernameDisplay');
    const logoutButton = document.getElementById('logoutButton');

    // A simple way to get the username from the URL query string for this example
    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('username');

    if (username) {
        usernameDisplay.textContent = username;
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', function() {
            // In a real app, you'd also clear server-side sessions.
            alert('Logging out...');
            window.location.href = 'index.html';
        });
    }
});