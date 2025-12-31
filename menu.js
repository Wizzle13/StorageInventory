document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.querySelector('.menu-toggle');
    const menuItems = document.querySelector('.menu-items');
    const logoutButton = document.getElementById('logoutButton');

    // Toggle menu on button click
    if (menuToggle && menuItems) {
        menuToggle.addEventListener('click', function(event) {
            event.stopPropagation(); // Prevent click from bubbling to the document
            menuItems.classList.toggle('active');
        });
    }

    // Close menu when clicking outside
    document.addEventListener('click', function(event) {
        if (menuItems && menuItems.classList.contains('active')) {
            if (!menuItems.contains(event.target) && !menuToggle.contains(event.target)) {
                menuItems.classList.remove('active');
            }
        }
    });

    if (logoutButton) {
        logoutButton.addEventListener('click', function() {
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            alert('Logging out...');
            window.location.href = 'index.html';
        });
    }
});
