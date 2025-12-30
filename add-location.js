document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
    }

    const addLocationForm = document.getElementById('addLocationForm');
    const locationsTableBody = document.getElementById('locationsTableBody');

    // Function to load locations from the server
    async function loadLocations() {
        try {
            const response = await fetch('http://localhost:3000/get-locations', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();

            if (data.success) {
                locationsTableBody.innerHTML = ''; // Clear existing rows
                data.locations.forEach(location => {
                    const row = locationsTableBody.insertRow();
                    row.insertCell(0).textContent = location.name;
                    row.insertCell(1).textContent = location.description;

                    const imgCell = row.insertCell(2);
                    if (location.picture_path) {
                        const img = document.createElement('img');
                        img.src = `http://localhost:3000/${location.picture_path}`;
                        img.alt = location.name;
                        img.style.width = '100px';
                        imgCell.appendChild(img);
                    } else {
                        imgCell.textContent = 'No picture';
                    }
                    row.insertCell(3).textContent = ''; // Actions
                });
            } else {
                console.error('Error fetching locations:', data.message);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    // Load locations when the page loads
    loadLocations();

    addLocationForm.addEventListener('submit', function(event) {
        event.preventDefault();

        const formData = new FormData();
        formData.append('name', document.getElementById('locationName').value);
        formData.append('description', document.getElementById('locationDescription').value);
        const picture = document.getElementById('locationPicture').files[0];
        if (picture) {
            formData.append('picture', picture);
        }

        fetch('http://localhost:3000/add-location', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Location added successfully!');
                location.reload();
            } else {
                alert('Error adding location: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while adding the location.');
        });
    });
});
