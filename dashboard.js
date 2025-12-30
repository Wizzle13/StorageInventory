document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
    }

    const nameDisplay = document.getElementById('nameDisplay');
    const emailDisplay = document.getElementById('emailDisplay');
    const logoutButton = document.getElementById('logoutButton');
    const menuToggle = document.querySelector('.menu-toggle');
    const menuItems = document.querySelector('.menu-items');

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

    const username = localStorage.getItem('username');

    if (username) {
        fetch(`http://localhost:3000/get-user-by-username`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    nameDisplay.textContent = data.name;
                    emailDisplay.textContent = data.email;
                } else {
                    console.error('Error fetching user data:', data.message);
                }
            })
            .catch(error => {
                console.error('Error:', error);
            });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', function() {
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            alert('Logging out...');
            window.location.href = 'index.html';
        });
    }
});