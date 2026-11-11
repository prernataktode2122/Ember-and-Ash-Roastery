/**
 * Ember & Ash Roastery — Frontend Interface for Python Backend
 * Supports rich selections: Name, City, Preferred Dates, Grind, Bag Size, and more.
 */

// 1. Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  setDefaultDeliveryDate();
  loadBeans();
  loadCuppingInfo();
  loadOrders();
});

// Helper to set tomorrow's date as default in the order datepicker
function setDefaultDeliveryDate() {
  const dateInput = document.getElementById("orderDeliveryDate");
  if (dateInput) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateInput.value = tomorrow.toISOString().split("T")[0];
    dateInput.min = new Date().toISOString().split("T")[0];
  }
}

// 2. Fetch and render beans from backend API
async function loadBeans() {
  try {
    const res = await fetch("/api/beans");
    const data = await res.json();
    if (data.success && data.beans) {
      renderBeans(data.beans);
    }
  } catch (err) {
    console.error("Could not fetch beans from API:", err);
  }
}

function renderBeans(beans) {
  const container = document.querySelector(".bean-grid");
  if (!container) return;

  container.innerHTML = beans.map((b) => `
    <article class="bean-card">
      <div class="swatch" style="background: ${b.roast_color || '#8C4A2F'};"></div>
      <div class="bean-top-row">
        <p class="stage">${b.stage}</p>
        <span class="price-tag">₹${b.price} / 250g</span>
      </div>
      <h3>${b.name}</h3>
      <p>${b.notes}</p>
      <p class="meta">${b.elevation} · ${b.varietal} · ${b.brew_method}</p>
      <button class="order-btn" onclick="openOrderModal('${b.id}', '${b.name}', ${b.price})">
        Order Fresh Bag
      </button>
    </article>
  `).join("");
}

// 3. Order Modal Handlers
let selectedBean = null;

function openOrderModal(id, name, price) {
  selectedBean = { id, name, price };
  const modal = document.getElementById("orderModal");
  document.getElementById("modalBeanTitle").textContent = name;
  document.getElementById("modalPriceInfo").textContent = `Base: ₹${price} per 250g bag`;
  setDefaultDeliveryDate();
  updateOrderTotal();
  modal.style.display = "flex";
}

function closeOrderModal() {
  document.getElementById("orderModal").style.display = "none";
  document.getElementById("orderForm").reset();
}

function updateOrderTotal() {
  if (!selectedBean) return;
  const qty = parseInt(document.getElementById("orderQuantity").value, 10) || 1;
  const bagSize = document.getElementById("orderBagSize").value;
  
  let multiplier = 1.0;
  if (bagSize === "500g") multiplier = 1.9;
  if (bagSize === "1kg") multiplier = 3.6;

  const total = Math.round(selectedBean.price * qty * multiplier);
  document.getElementById("modalTotalAmount").textContent = `Total: ₹${total}`;
}

async function handleOrderSubmit(event) {
  event.preventDefault();
  if (!selectedBean) return;

  const customerName = document.getElementById("orderCustomerName").value.trim();
  const phone = document.getElementById("orderPhone").value.trim();
  const email = document.getElementById("orderEmail").value.trim();
  const city = document.getElementById("orderCity").value;
  const deliveryDate = document.getElementById("orderDeliveryDate").value;
  const bagSize = document.getElementById("orderBagSize").value;
  const grind = document.getElementById("orderGrind").value;
  const quantity = parseInt(document.getElementById("orderQuantity").value, 10) || 1;
  const address = document.getElementById("orderAddress").value.trim();

  const btn = document.getElementById("submitOrderBtn");
  btn.textContent = "Placing Order...";
  btn.disabled = true;

  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bean_id: selectedBean.id,
        customer_name: customerName,
        phone: phone,
        email: email,
        city: city,
        delivery_date: deliveryDate,
        bag_size: bagSize,
        grind: grind,
        quantity: quantity,
        address: address
      })
    });

    const result = await res.json();
    if (result.success) {
      alert(`🎉 Order Placed Successfully!\n\nOrder ID: ${result.order.order_id}\nCustomer: ${result.order.customer_name} (${result.order.city})\nCoffee: ${result.order.bean_name}\nBag Size: ${result.order.bag_size} x ${result.order.quantity}\nGrind: ${result.order.grind}\nPreferred Date: ${result.order.delivery_date}\nTotal Amount: ₹${result.order.total_amount}`);
      closeOrderModal();
      loadOrders(); // Refresh orders list in UI
    } else {
      alert(`Error: ${result.error || 'Failed to place order'}`);
    }
  } catch (err) {
    alert("Could not connect to the backend server. Make sure python3 server.py is running!");
  } finally {
    btn.textContent = "Confirm Order";
    btn.disabled = false;
  }
}

// 4. Saturday Cupping Info & RSVP
async function loadCuppingInfo() {
  try {
    const res = await fetch("/api/cupping");
    const data = await res.json();
    if (data.success) {
      const seatsBadge = document.getElementById("remainingSeatsBadge");
      if (seatsBadge) {
        seatsBadge.textContent = `${data.remaining_seats} of ${data.event.total_seats} seats remaining`;
      }
    }
  } catch (err) {
    console.error("Could not fetch cupping info:", err);
  }
}

async function handleCuppingSubmit(event) {
  event.preventDefault();
  const name = document.getElementById("rsvpName").value.trim();
  const email = document.getElementById("rsvpEmail").value.trim();
  const phone = document.getElementById("rsvpPhone").value.trim();
  const city = document.getElementById("rsvpCity").value;
  const sessionDate = document.getElementById("rsvpSessionDate").value;
  const guests = parseInt(document.getElementById("rsvpGuests").value, 10) || 1;

  try {
    const res = await fetch("/api/cupping/rsvp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        phone,
        city,
        session_date: sessionDate,
        guests
      })
    });

    const result = await res.json();
    if (result.success) {
      alert(`☕ Spot Reserved!\n\nName: ${result.rsvp.name}\nCity: ${result.rsvp.city}\nSession: ${result.rsvp.session_date}\nGuests: ${result.rsvp.guests}\n\nWe look forward to welcoming you at our FC Road shopfront!`);
      document.getElementById("cuppingForm").reset();
      loadCuppingInfo();
    } else {
      alert(`Error: ${result.error || 'Reservation failed'}`);
    }
  } catch (err) {
    alert("Could not connect to the server.");
  }
}

// 5. Load and display Live Orders on the webpage
async function loadOrders() {
  try {
    const res = await fetch("/api/orders");
    const data = await res.json();
    if (data.success && data.orders) {
      const container = document.getElementById("liveOrdersList");
      if (!container) return;

      if (data.orders.length === 0) {
        container.innerHTML = `<p class="empty-orders">No orders placed yet. Be the first to order above!</p>`;
      } else {
        container.innerHTML = data.orders.map((o) => `
          <div class="order-item">
            <div class="order-item-header">
              <span class="order-id">#${o.order_id}</span>
              <span class="order-status">${o.status || 'Received'}</span>
            </div>
            <div class="order-item-body">
              <strong>${o.customer_name}</strong> (${o.city || 'Pune'})
              <div class="order-item-desc">
                ${o.quantity} × ${o.bag_size || '250g'} <strong>${o.bean_name}</strong>
              </div>
              <div class="order-grind">Grind: ${o.grind}</div>
              ${o.delivery_date ? `<div class="order-date">📅 Date: ${o.delivery_date}</div>` : ''}
              <div class="order-total-price">₹${o.total_amount}</div>
            </div>
          </div>
        `).join("");
      }
    }
  } catch (err) {
    console.error("Could not load orders:", err);
  }
}
