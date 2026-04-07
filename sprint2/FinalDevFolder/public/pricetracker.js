// pricetracker.js
const API_URL = "https://microtrack-production.up.railway.app";

// --- Update time ---
function updateTime() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    document.getElementById('currentTime').textContent = `${hours}:${minutes}`;
}
updateTime();
setInterval(updateTime, 60000);

// --- Logout ---
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        ['isLoggedIn','userEmail','userName','userId'].forEach(k => localStorage.removeItem(k));
        window.location.href = 'index.html';
    }
}

// --- Check login ---
const userId = localStorage.getItem('userId');
if (!localStorage.getItem('isLoggedIn') || !userId) window.location.href = 'index.html';

// --- Custom store input ---
document.getElementById('store').addEventListener('change', function() {
    const customGroup = document.getElementById('customStoreGroup');
    if (this.value === 'Other') {
        customGroup.style.display = 'block';
        document.getElementById('customStore').required = true;
    } else {
        customGroup.style.display = 'none';
        document.getElementById('customStore').required = false;
    }
});

// --- Modal ---
function openModal() { document.getElementById('itemModal').style.display = 'block'; }
function closeModal() { 
    document.getElementById('itemModal').style.display = 'none'; 
    document.getElementById('itemForm').reset();
    document.getElementById('customStoreGroup').style.display = 'none';
}

// --- Hide alert by default ---
document.getElementById('priceAlert').style.display = 'none';

// --- Load tracked items ---
async function loadTrackedItems() {
    const trackedItemsList = document.getElementById('trackedItemsList');
    const alertBox = document.getElementById('priceAlert');
    const alertTextEl = document.getElementById('alertText');

    alertBox.style.display = 'none';
    alertTextEl.textContent = '';
    trackedItemsList.innerHTML = '';

    try {
        const response = await fetch(`${API_URL}/sprint2/api/products?user_id=${userId}`);
        const data = await response.json();
        const products = data.products || [];

        if (!products.length) {
            trackedItemsList.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #999;">
                    <p style="font-size: 48px;">🏷️</p>
                    <p>No items tracked yet!</p>
                    <p style="font-size: 13px;">Click "Add Item to Track" to start monitoring prices</p>
                </div>
            `;
            return;
        }

        products.forEach(product => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'budget-card';
            itemDiv.id = `product-${product.product_id}`;
            itemDiv.dataset.name = product.product_name;
            itemDiv.dataset.targetPrice = product.target_price ?? '';
            itemDiv.innerHTML = `
                <div><strong>${product.product_name}</strong></div>
                <div>${product.store_location}</div>
                <div><a href="${product.product_url}" target="_blank">${product.product_url}</a></div>
                <div>Current Price: $${product.current_price != null ? Number(product.current_price).toFixed(2) : '—'}</div>
                <div>Target Price: $${product.target_price != null ? Number(product.target_price).toFixed(2) : '—'}</div>
            `;
            trackedItemsList.appendChild(itemDiv);
        });

        // Show alert if any product below target
        products.forEach(product => {
            const target = parseFloat(product.target_price);
            const current = parseFloat(product.current_price);
            if (!isNaN(target) && !isNaN(current) && current <= target) {
                alertTextEl.textContent = `🎉 Price dropped for ${product.product_name}: $${current.toFixed(2)}`;
                alertBox.style.display = 'block';
            }
        });

    } catch (err) {
        trackedItemsList.innerHTML = `<p style="color: red;">Error loading tracked items: ${err.message}</p>`;
        console.error(err);
    }
}

// --- Form submit ---
document.getElementById('itemForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const itemName = document.getElementById('itemName').value.trim();
    let store = document.getElementById('store').value;
    const customStore = document.getElementById('customStore').value.trim();
    const productUrl = document.getElementById('productUrl').value.trim();
    const targetPrice = parseFloat(document.getElementById('targetPrice').value) || null;

    if (store === 'Other' && customStore) store = customStore;

    try {
        const response = await fetch(`${API_URL}/sprint2/api/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_name: itemName, store_location: store, product_url: productUrl, target_price: targetPrice, user_id: userId })
        });

        const data = await response.json();

        if (response.ok) {
            const priceText = data.current_price !== null ? `$${data.current_price.toFixed(2)}` : '—';
            if (targetPrice !== null && data.current_price !== null && data.current_price <= targetPrice) {
                document.getElementById('alertText').textContent = `🎉 Price dropped for ${itemName}: ${priceText}`;
                document.getElementById('priceAlert').style.display = 'block';
            }

            alert(`✅ "${itemName}" is now being tracked!`);
            closeModal();
            loadTrackedItems();
        } else {
            alert(`❌ Error: ${data.error}`);
        }
    } catch (err) {
        alert('❌ Server error: ' + err.message);
    }
});

// --- Update prices ---
async function updateAllPrices() {
    try {
        const response = await fetch(`${API_URL}/sprint2/api/update-prices?user_id=${userId}`);
        const data = await response.json();

        if (response.ok) {
            data.updates.forEach(update => {
                const productCard = document.querySelector(`#product-${update.product_id}`);
                if (productCard) {
                    const targetPrice = parseFloat(productCard.dataset.targetPrice);
                    if (!isNaN(targetPrice) && update.price <= targetPrice) {
                        document.getElementById('alertText').textContent = `🎉 Price dropped for ${productCard.dataset.name}: $${update.price.toFixed(2)}`;
                        document.getElementById('priceAlert').style.display = 'block';
                    }
                }
            });
            loadTrackedItems();
        } else console.error('Error updating prices:', data.error);
    } catch (err) { console.error('Server error:', err); }
}

// Auto-update every 24h
setInterval(() => { if (document.getElementById('autoUpdateToggle').checked) updateAllPrices(); }, 24*60*60*1000);

// --- Initial load ---
loadTrackedItems();