//  Base API URL
const API_BASE = "http://localhost:5000";

let currentUser = null;


//  Load user on page load
window.addEventListener("DOMContentLoaded", async () => {
  const savedUser = localStorage.getItem("surplusServeUser");
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    const tokenValid = await verifyToken(currentUser.token);
    if (tokenValid) {
      const path = window.location.pathname;
      if (path.endsWith("index.html") || path === "/" || path === "") {
        redirectDashboard();
      }
    } else {
      localStorage.removeItem("surplusServeUser");
      currentUser = null;
    }
  }
});

// ---------------------------
//  Registration
// ---------------------------
const registerForm = document.getElementById("registerFormElement");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name: regName.value.trim(),
      email: regEmail.value.trim(),
      password: regPassword.value,
      confirmPassword: regConfirmPassword.value,
      phone: regPhone.value.trim(),
      city: regCity.value.trim(),
      pincode: regPincode.value.trim(),
      type: regUserType.value,
    };

    if (Object.values(payload).some((v) => !v)) return alert("All fields required.");
    if (!/^\d{10}$/.test(payload.phone)) return alert("Phone must be 10 digits.");
    if (payload.password !== payload.confirmPassword) return alert("Passwords do not match.");

    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      alert("✅ Registration successful! Please log in.");
      registerForm.reset();
      location.reload();
    } catch (err) {
      alert(err.message);
    }
  });
}

// ---------------------------
//  Login
// ---------------------------
const loginForm = document.getElementById("loginFormElement");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      email: email.value.trim(),
      password: password.value,
      type: userType.value,
    };

    if (!payload.email || !payload.password) return alert("All fields required.");

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      currentUser = { ...data.user, token: data.token, userType: payload.type };
      localStorage.setItem("surplusServeUser", JSON.stringify(currentUser));
      redirectDashboard();
    } catch (err) {
      alert(err.message);
    }
  });
}

// ---------------------------
//  Dashboard redirect
// ---------------------------
function redirectDashboard() {
  if (!currentUser) return;
  if (currentUser.userType === "donor") window.location.href = "donor.html";
  else if (currentUser.userType === "ngo") window.location.href = "ngo.html";
}

// ---------------------------
//  Logout
// ---------------------------
document.addEventListener("click", (e) => {
  if (e.target.id === "logoutBtn") {
    localStorage.removeItem("surplusServeUser");
    currentUser = null;
    window.location.href = "index.html";
  }
});

// ---------------------------
//  Token verification
// ---------------------------
async function verifyToken(token) {
  if (!token) return false;
  try {
    const res = await fetch(`${API_BASE}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------
//  Donor Dashboard Functions
// ---------------------------
document.addEventListener("click", async (e) => {
  const main = document.getElementById("mainContent");

  // ➕ Add Donation
if (e.target.id === "addDonationBtn") {
    main.style.display = "block";
  main.innerHTML = `
    <h4>Add Donation</h4>
    <form id="addDonationForm" enctype="multipart/form-data">
      <div class="mb-3"><label>Item Name</label><input id="itemName" class="form-control" required></div>
      <div class="mb-3"><label>Quantity</label><input id="quantity" type="number" class="form-control" required></div>
      <div class="mb-3"><label>Description</label><textarea id="description" class="form-control"></textarea></div>
      <div class="mb-3"><label>Pickup Address</label><input id="address" class="form-control" required></div>
      <div class="mb-3"><label>Photo (optional)</label><input id="photo" type="file" accept="image/*" class="form-control"></div>
      <button type="submit" class="btn btn-success">Submit</button>
    </form>
  `;

  const form = document.getElementById("addDonationForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("donor_id", currentUser.id);
    formData.append("item_name", itemName.value);
    formData.append("quantity", quantity.value);
    formData.append("description", description.value);
    formData.append("address", address.value);
    formData.append("city", currentUser.city);
    formData.append("pincode", currentUser.pincode);
    if (photo.files[0]) formData.append("photo", photo.files[0]);

    try {
      const res = await fetch(`${API_BASE}/api/donations/add`, {
        method: "POST",
        body: formData, // ✅ No Content-Type needed for FormData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add donation");
      alert("✅ Donation added successfully!");
      main.innerHTML = "";
    } catch (err) {
      alert(err.message);
    }
  });
}


//  My Donations
if (e.target.id === "myDonationsBtn") {
    main.style.display = "block";
  try {
    const res = await fetch(`${API_BASE}/api/donations/donor/${currentUser.id}`);
    const data = await res.json();
    if (!res.ok) throw new Error("Failed to fetch donations");
    main.innerHTML = "<h4>My Donations</h4>";

    if (!data.length) return (main.innerHTML += "<p>No donations yet.</p>");

    data.forEach((d) => {
      let html = `
        <div class="card mb-3">
          <div class="card-body">
            <p><strong>Item:</strong> ${d.item_name}</p>
            <p><strong>Description:</strong> ${d.description || ""}</p>
            <p><strong>Quantity:</strong> ${d.quantity}</p>
            <p><strong>Status:</strong> ${d.status}</p>
      `;

      // ✅ Add NGO info if accepted
      if (d.status === "Accepted" && d.ngo_name) {
        html += `
          <p><strong>Accepted By:</strong> ${d.ngo_name}</p>
          <p><strong>Email:</strong> ${d.ngo_email}</p>
          <p><strong>Phone:</strong> ${d.ngo_phone}</p>
        `;
      }

      // ✅ Show image last (after all info)
      if (d.photo) {
        html += `
          <img src="http://localhost:5000${d.photo}" 
               alt="donation image" 
               class="img-fluid rounded mb-2 mt-2" 
               style="max-height:200px;">
        `;
      }

      html += `
          </div>
        </div>
      `;

      main.innerHTML += html;
    });
  } catch (err) {
    alert(err.message);
  }
  }
});

// ---------------------------
//  NGO Dashboard Functions
// ---------------------------
document.addEventListener("click", async (e) => {
  const main = document.getElementById("mainContent");
  main.style.display = "block";
  // 📍 Nearby Donations
  if (e.target.id === "nearbyDonationsBtn") {
    try {
      const res = await fetch(`${API_BASE}/api/donations/nearby/${currentUser.pincode}`);
      const data = await res.json();
      if (!res.ok) throw new Error("Failed to fetch nearby donations");
      main.innerHTML = "<h4>Nearby Donations</h4>";

      if (!data.length) return (main.innerHTML += "<p>No nearby donations found.</p>");

      data.forEach((d) => {
        main.innerHTML += `
          <div class="card mb-3">
            <div class="card-body">
              <p><strong>Item:</strong> ${d.item_name}</p>
              <p><strong>Description: </strong>${d.description || ""}</p>
              <p><strong>Quantity:</strong> ${d.quantity}</p>
              <p><strong>Address:</strong> ${d.address}</p>
               ${d.photo ? `<img src="http://localhost:5000${d.photo}" alt="donation image" class="img-fluid rounded mb-2" style="max-height:200px;">` : ""}<br>
              <button class="btn btn-success acceptDonationBtn" data-id="${d.id}">Accept</button>
            </div>
          </div>
        `;
      });

      // Handle accept click
      document.querySelectorAll(".acceptDonationBtn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const donationId = btn.dataset.id;
          try {
            const res = await fetch(`${API_BASE}/api/donations/accept`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ donation_id: donationId, ngo_id: currentUser.id }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to accept donation");
            alert("✅ Donation accepted!");
            btn.disabled = true;
          } catch (err) {
            alert(err.message);
          }
        });
      });
    } catch (err) {
      alert(err.message);
    }
  }

  // ✅ Accepted Donations
  if (e.target.id === "acceptedDonationsBtn") {
    main.style.display = "block";
    try {
      const res = await fetch(`${API_BASE}/api/donations/ngo/${currentUser.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error("Failed to fetch accepted donations");

      main.innerHTML = "<h4>Accepted Donations</h4>";
      if (!data.length) return (main.innerHTML += "<p>No accepted donations yet.</p>");

      data.forEach((d) => {
        main.innerHTML += `
          <div class="card mb-3">
            <div class="card-body">
              <p><strong>Item:</strong> ${d.item_name}</p>
              <p><strong>Description: </strong>${d.description || ""}</p>
              <p><strong>Quantity:</strong> ${d.quantity}</p>
              <p><strong>Status:</strong> ${d.status}</p>
              <p><strong>Donor:</strong> ${d.donor_name}</p>
              <p><strong>PickUP Address: </strong>${d.address} </p>
              <p><strong>Email: </strong> ${d.donor_email}</p>
              <p><strong>Phone: </strong> ${d.donor_phone}</p>
              ${d.photo ? `<img src="http://localhost:5000${d.photo}" alt="donation image" class="img-fluid rounded mb-2" style="max-height:200px;">` : ""}
            </div>
          </div>
        `;
      });
    } catch (err) {
      alert(err.message);
    }
  }
});
