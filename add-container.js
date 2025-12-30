document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
    }

    const locationSelect = document.getElementById('location');
    const addContainerForm = document.getElementById('add-container-form');

    try {
        const response = await fetch('/get-locations', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (data.success) {
            if (data.locations.length === 0) {
                alert('You have no locations. Please add a location first.');
                window.location.href = 'add-location.html';
            } else {
                data.locations.forEach(location => {
                    const option = document.createElement('option');
                    option.value = location.id;
                    option.textContent = location.name;
                    locationSelect.appendChild(option);
                });
            }
        } else {
            console.error('Error fetching locations:', data.message);
        }
    } catch (err) {
        console.error('Error fetching locations:', err);
    }

    addContainerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData();
        formData.append('location_id', locationSelect.value);
        formData.append('name', document.getElementById('name').value);
        formData.append('description', document.getElementById('description').value);
        formData.append('picture', document.getElementById('picture').files[0]);

        try {
            const response = await fetch('/add-container', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                alert('Container added successfully');
                window.location.href = 'dashboard.html';
            } else {
                console.error('Error adding container:', data.message);
                alert('Error adding container: ' + data.message);
            }
        } catch (err) {
            console.error('Error adding container:', err);
            alert('Error adding container: ' + err.message);
        }
    });
});
