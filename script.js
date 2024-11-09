let map, directionsService, directionsRenderer;
let markers = [];
let geocoder;

function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: -34.397, lng: 150.644 },
        zoom: 8,
    });
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        panel: document.getElementById("directionsPanel"),
    });

    geocoder = new google.maps.Geocoder();

    document.getElementById("addLocation").addEventListener("click", addLocation);
    document.getElementById("clearInput").addEventListener("click", clearInput);
    document.getElementById("submitLocations").addEventListener("click", submitLocations);

    let storedLocations = JSON.parse(localStorage.getItem("locations"));
    if (storedLocations && storedLocations.length) {
        calculateAndDisplayRoute(storedLocations);
    }
}

function addLocation() {
    let location = document.getElementById("locationInput").value.trim();
    if (location === "") {
        alert("Please enter a valid location.");
        return;
    }
    geocodeLocation(location);
    document.getElementById("locationInput").value = "";
}

function clearInput() {
    clearMarkers();
    localStorage.removeItem("locations");
    document.getElementById("locationInput").value = "";
    clearDirections();
}

function submitLocations() {
    let storedLocations = markers.map(marker => marker.getPosition().toJSON());
    localStorage.setItem("locations", JSON.stringify(storedLocations));
    calculateAndDisplayRoute(storedLocations);
}

function geocodeLocation(location) {
    geocoder.geocode({ address: location }, function(results, status) {
        if (status === "OK") {
            let result = results[0];
            let position = result.geometry.location;
            map.setCenter(position);
            let marker = new google.maps.Marker({
                map: map,
                position: position,
                title: result.formatted_address,
            });
            markers.push(marker);
        } else {
            alert("Geocode was not successful for the following reason: " + status);
        }
    });
}

async function calculateAndDisplayRoute(locations) {
    clearMarkers();
    clearDirections();

    let initialLocation = locations[0];
    let otherLocations = locations.slice(1);
    let sortedLocations = await nearestNeighbor(initialLocation, otherLocations);

    sortedLocations.forEach((location, index) => {
        let marker = new google.maps.Marker({
            position: location,
            map: map,
            label: index === 0 ? 'Start' : index === sortedLocations.length - 1 ? 'End' : String(index),
        });
        markers.push(marker);
    });

    let waypoints = sortedLocations.slice(1, sortedLocations.length - 1).map(location => ({
        location: location,
        stopover: true,
    }));

    let request = {
        origin: sortedLocations[0],
        destination: sortedLocations[sortedLocations.length - 1],
        waypoints: waypoints,
        travelMode: google.maps.TravelMode.DRIVING
    };

    directionsService.route(request, (result, status) => {
        if (status === 'OK') {
            directionsRenderer.setDirections(result);
            displayDirectionsTable(result);
        } else {
            console.error('Error fetching directions', result);
        }
    });
}

async function nearestNeighbor(start, locations) {
    if (locations.length === 0) return [];

    let sortedLocations = [start];
    let remainingLocations = locations.slice();

    while (remainingLocations.length > 0) {
        let nearest = await findNearest(sortedLocations[sortedLocations.length - 1], remainingLocations);
        sortedLocations.push(nearest.location);
        remainingLocations.splice(nearest.index, 1);
    }
    return sortedLocations;
}

async function findNearest(start, locations) {
    let distances = await calculateDistances(start, locations);
    let nearestIndex = 0;
    for (let i = 1; i < distances.length; i++) {
        if (distances[i] < distances[nearestIndex]) {
            nearestIndex = i;
        }
    }
    return { location: locations[nearestIndex], index: nearestIndex };
}

function calculateDistances(start, locations) {
    return new Promise((resolve, reject) => {
        const service = new google.maps.DistanceMatrixService();
        service.getDistanceMatrix({
            origins: [start],
            destinations: locations,
            travelMode: 'DRIVING',
        }, (response, status) => {
            if (status === 'OK') {
                const distances = response.rows[0].elements.map(element => element.distance.value);
                resolve(distances);
            } else {
                reject('Error calculating distances');
            }
        });
    });
}

function clearMarkers() {
    markers.forEach(marker => {
        marker.setMap(null);
    });
    markers = [];
}

function clearDirections() {
    directionsRenderer.setDirections({ routes: [] });
    clearDirectionsTable();
}

function displayDirectionsTable(result) {
    let directionsPanel = document.getElementById("directionsPanel");
    let html = '<h3>Directions:</h3>';
    html += '<table id="directionsTable">';
    html += '<tr><th>Step</th><th>From</th><th>To</th><th>Distance</th><th>Duration</th></tr>';
    result.routes[0].legs.forEach((leg, index) => {
        html += '<tr>';
        html += `<td>${index + 1}</td>`;
        html += `<td>${leg.start_address}</td>`;
        html += `<td>${leg.end_address}</td>`;
        html += `<td>${leg.distance.text}</td>`;
        html += `<td>${leg.duration.text}</td>`;
        html += '</tr>';
    });
    html += '</table>';
    directionsPanel.innerHTML = html;
}

function clearDirectionsTable() {
    document.getElementById("directionsPanel").innerHTML = "";
}
