document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');

    if (loginForm) {
        loginForm.addEventListener('submit', function(event) {
            event.preventDefault(); // Prevent default form submission

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            const loginData = {
                username: username,
                password: password
            };

            fetch('http://localhost:3000/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(loginData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Login successful! Redirecting to dashboard.');
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('username', username);
                    window.location.href = 'dashboard.html';
                } else {
                    alert(`Error: ${data.message}`);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('An error occurred during login.');
            });
        });
    }
});