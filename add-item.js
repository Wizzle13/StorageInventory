document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
    }

    const containerSelect = document.getElementById('container');
    const addItemForm = document.getElementById('add-item-form');

    try {
        const response = await fetch('/get-containers', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (data.success) {
            if (data.containers.length === 0) {
                alert('You have no containers. Please add a container first.');
                window.location.href = 'add-container.html';
            } else {
                data.containers.forEach(container => {
                    const option = document.createElement('option');
                    option.value = container.id;
                    option.textContent = container.name;
                    containerSelect.appendChild(option);
                });
            }
        } else {
            console.error('Error fetching containers:', data.message);
        }
    } catch (err) {
        console.error('Error fetching containers:', err);
    }

    addItemForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData();
        formData.append('container_id', containerSelect.value);
        formData.append('name', document.getElementById('name').value);
        formData.append('description', document.getElementById('description').value);
        formData.append('picture', document.getElementById('picture').files[0]);

        try {
            const response = await fetch('/add-item', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                alert('Item added successfully');
                window.location.href = 'dashboard.html';
            } else {
                console.error('Error adding item:', data.message);
                alert('Error adding item: ' + data.message);
            }
        } catch (err) {
            console.error('Error adding item:', err);
            alert('Error adding item: ' + err.message);
        }
    });
});
