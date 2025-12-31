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
    const viewSelector = document.getElementById('view');
    const gridContainer = document.getElementById('grid-container');

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

    // Function to fetch and display data
    async function fetchData(type) {
        try {
            const response = await fetch(`http://localhost:3000/get-${type}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();

            if (data.success) {
                renderGrid(data[type], type);
            } else {
                console.error(`Error fetching ${type}:`, data.message);
            }
        } catch (error) {
            console.error(`Error fetching ${type}:`, error);
        }
    }

    // Function to render data in a grid
    function renderGrid(items, type, filteredByLocationId = null) {
        gridContainer.innerHTML = ''; // Clear previous content
        
        // Add clear filter button if a filter is active
        if (filteredByLocationId) {
            const clearFilterButton = document.createElement('button');
            clearFilterButton.textContent = 'Clear Location Filter';
            clearFilterButton.classList.add('clear-filter-button');
            clearFilterButton.addEventListener('click', () => {
                viewSelector.value = 'locations'; // Reset selector
                viewSelector.disabled = false;    // Enable selector
                fetchData('locations');           // Fetch all locations
            });
            gridContainer.appendChild(clearFilterButton);
        }

        if (items.length === 0) {
            gridContainer.innerHTML += `<p>No ${type} found.</p>`;
            return;
        }

        items.forEach(item => {
            const gridItem = document.createElement('div');
            gridItem.classList.add('grid-item');

            if (item.picture_path) {
                const img = document.createElement('img');
                img.src = `http://localhost:3000/${item.picture_path}`;
                img.alt = item.name;
                gridItem.appendChild(img);
            }

            const name = document.createElement('h3');
            name.textContent = item.name;
            gridItem.appendChild(name);

            if (item.description) {
                const description = document.createElement('p');
                description.textContent = item.description;
                gridItem.appendChild(description);
            }

            // Add click listener for locations to view containers
            if (type === 'locations') {
                gridItem.style.cursor = 'pointer';
                gridItem.addEventListener('click', () => {
                    viewSelector.value = 'containers';
                    viewSelector.disabled = true; // Disable selector when filtered
                    fetchData('containers', item.id); // Pass locationId
                });
            }

            gridContainer.appendChild(gridItem);
        });
    }

    // Function to fetch and display data
    async function fetchData(type, locationId = null) {
        try {
            let url = `http://localhost:3000/get-${type}`;
            if (type === 'containers' && locationId) {
                url = `http://localhost:3000/get-containers-by-location?location_id=${locationId}`;
            }

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();

            if (data.success) {
                // Pass filteredByLocationId to renderGrid
                renderGrid(data[type] || data.containers, type, locationId); 
            } else {
                console.error(`Error fetching ${type}:`, data.message);
            }
        } catch (error) {
            console.error(`Error fetching ${type}:`, error);
        }
    }

    // Event listener for view selector
    viewSelector.addEventListener('change', (event) => {
        viewSelector.disabled = false; // Enable selector on manual change
        fetchData(event.target.value);
    });

    // Initial load: display locations by default
    fetchData('locations');

    if (logoutButton) {
        logoutButton.addEventListener('click', function() {
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            alert('Logging out...');
            window.location.href = 'index.html';
        });
    }
});