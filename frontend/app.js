const API_BASE = 'http://localhost:8000';

let currentJobId = null;
let map = null;

// Elements
const uploadInput = document.getElementById('video-upload');
const processBtn = document.getElementById('process-btn');
const demoBtn = document.getElementById('demo-btn');
const statusDiv = document.getElementById('status');
const resultsSection = document.getElementById('results-section');

// Enable process button when file selected
uploadInput.addEventListener('change', (e) => {
    processBtn.disabled = !e.target.files.length;
});

// Process video
processBtn.addEventListener('click', async () => {
    const file = uploadInput.files[0];
    if (!file) return;

    setStatus('Uploading video...', 'processing');
    processBtn.disabled = true;

    try {
        // Upload
        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            body: formData
        });
        const uploadData = await uploadRes.json();
        currentJobId = uploadData.job_id;

        setStatus('Processing with AI...', 'processing');

        // Process
        const processRes = await fetch(`${API_BASE}/process/${currentJobId}`, {
            method: 'POST'
        });
        
        if (!processRes.ok) throw new Error('Processing failed');

        setStatus('Loading results...', 'processing');

        // Get results
        const resultsRes = await fetch(`${API_BASE}/results/${currentJobId}`);
        const results = await resultsRes.json();

        displayResults(results);
        setStatus('✓ Analysis complete!', 'success');

    } catch (error) {
        setStatus(`Error: ${error.message}`, 'error');
        console.error(error);
    } finally {
        processBtn.disabled = false;
    }
});

// Load demo results
demoBtn.addEventListener('click', async () => {
    setStatus('Loading demo...', 'processing');

    try {
        const res = await fetch(`${API_BASE}/demo`);
        const data = await res.json();
        displayDemoResults(data);
        setStatus('✓ Demo loaded!', 'success');
    } catch (error) {
        setStatus(`Error: ${error.message}`, 'error');
    }
});

// Display results
function displayResults(data) {
    resultsSection.style.display = 'block';

    // Video
    document.getElementById('result-video').src = `${API_BASE}${data.files.video}`;

    // Heatmap
    document.getElementById('heatmap-img').src = `${API_BASE}${data.files.heatmap}`;

    // Metrics
    const m = data.metrics;
    document.getElementById('metric-hectares').textContent = m.hectares_scanned;
    document.getElementById('metric-density').textContent = `${m.weed_density_percent}%`;
    document.getElementById('metric-savings').textContent = `${m.chemical_saved_liters}L`;
    document.getElementById('metric-cost').textContent = `₹${m.cost_saved_rupees.toLocaleString()}`;
    document.getElementById('savings-percent').textContent = `${m.savings_percent}% less herbicide vs blanket spray`;
    
    const savingsFill = document.getElementById('savings-fill');
    setTimeout(() => {
        savingsFill.style.width = `${m.savings_percent}%`;
    }, 100);

    // Load map
    loadMap(data.files.geojson);
}

function displayDemoResults(data) {
    resultsSection.style.display = 'block';

    // Use static demo files
    document.getElementById('result-video').src = 'sample_results/demo_annotated.mp4';
    document.getElementById('heatmap-img').src = 'sample_results/demo_heatmap.png';

    const m = data.metrics;
    document.getElementById('metric-hectares').textContent = m.hectares_scanned;
    document.getElementById('metric-density').textContent = `${m.weed_density_percent}%`;
    document.getElementById('metric-savings').textContent = `${m.chemical_saved_liters}L`;
    document.getElementById('metric-cost').textContent = `₹${m.cost_saved_rupees.toLocaleString()}`;
    document.getElementById('savings-percent').textContent = `${m.savings_percent}% less herbicide vs blanket spray`;
    
    const savingsFill = document.getElementById('savings-fill');
    setTimeout(() => {
        savingsFill.style.width = `${m.savings_percent}%`;
    }, 100);

    // Load demo GeoJSON
    fetch('sample_results/demo_zones.geojson')
        .then(res => res.json())
        .then(geojson => {
            if (!map) initMap();
            displayGeoJSON(geojson);
        });
}

function loadMap(geojsonUrl) {
    fetch(`${API_BASE}${geojsonUrl}`)
        .then(res => res.json())
        .then(data => {
            if (!map) initMap();
            displayGeoJSON(data);
        });
}

function initMap() {
    map = L.map('map').setView([19.0760, 72.8777], 18);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

function displayGeoJSON(geojson) {
    L.geoJSON(geojson, {
        style: (feature) => ({
            color: '#FF4444',
            weight: 2,
            fillColor: '#FF4444',
            fillOpacity: 0.3
        }),
        onEachFeature: (feature, layer) => {
            layer.bindPopup(`
                <strong>${feature.properties.weed_type}</strong><br>
                Confidence: ${feature.properties.confidence}<br>
                Spray: ${feature.properties.spray_needed ? 'YES' : 'NO'}
            `);
        }
    }).addTo(map);
}

function setStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status-${type}`;
}

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        // Update active tab
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Show corresponding content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`tab-${tabName}`).classList.add('active');

        // Initialize map if switching to map tab
        if (tabName === 'map' && !map) {
            initMap();
        }
    });
});