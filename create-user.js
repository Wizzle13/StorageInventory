document.addEventListener('DOMContentLoaded', function() {
    const createUserForm = document.getElementById('createUserForm');

    if (createUserForm) {
        createUserForm.addEventListener('submit', function(event) {
            event.preventDefault();

            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const newUsername = document.getElementById('newUsername').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (newPassword !== confirmPassword) {
                alert('Passwords do not match!');
                return;
            }

            const userData = {
                name: name,
                email: email,
                username: newUsername,
                password: newPassword
            };

            fetch('http://localhost:3000/create-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('User created successfully! Please log in.');
                    window.location.href = 'index.html';
                } else {
                    alert(`Error: ${data.message}`);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('An error occurred while creating the user.');
            });
        });
    }
});