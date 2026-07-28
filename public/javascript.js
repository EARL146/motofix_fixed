/**
 * MotoFix - Auth & Profile Management
 * Handles authentication state, session persistence, and profile dropdown
 */

// =====================================================
// STORAGE MANAGEMENT
// =====================================================

function isStorageAvailable() {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    console.warn('⚠️ localStorage not available (private browsing or disabled)');
    return false;
  }
}

function getSession() {
  try {
    if (!isStorageAvailable()) return null;
    // Check both 'currentUser' (used by JS) and 'mf_user' (used by HTML)
    let session = localStorage.getItem('currentUser');
    if (!session) {
      session = localStorage.getItem('mf_user');
    }
    if (!session) return null;
    const userData = JSON.parse(session);
    // If it's from mf_user and doesn't have a token, we need to get it from API or use a default
    if (userData && !userData.token) {
      userData.token = localStorage.getItem('sessionToken') || '';
    }
    return userData;
  } catch (error) {
    console.warn('Error reading session:', error);
    return null;
  }
}

function saveSession(user) {
  try {
    if (!isStorageAvailable()) {
      console.warn('Cannot save session - storage unavailable');
      return;
    }
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('sessionToken', user.token || '');
    // Also save to mf_user key for consistency with HTML
    localStorage.setItem('mf_user', JSON.stringify(user));
  } catch (error) {
    console.warn('Error saving session:', error);
  }
}

function clearStorage() {
  try {
    if (!isStorageAvailable()) return;
    localStorage.removeItem('currentUser');
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('mf_user');  // Also clear the HTML's storage key
  } catch (error) {
    console.warn('Error clearing storage:', error);
  }
}

// =====================================================
// AUTHENTICATION OBJECT
// =====================================================

const Auth = {
  currentUser: getSession(),
  
  isLoggedIn() {
    return !!this.currentUser && !!this.currentUser.id;
  },

  getCurrentUser() {
    return this.currentUser;
  },

  setCurrentUser(user) {
    this.currentUser = user;
    saveSession(user);
    // this.updateProfileDropdown(); // Disabled - HTML handles profile dropdown
  },

  logout() {
    this.currentUser = null;
    clearStorage();
    // this.updateProfileDropdown(); // Disabled - HTML handles profile dropdown
    showToast('Logged out successfully ✅');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1000);
  },

  updateProfileDropdown() {
    const profileDd = document.getElementById('profileDd');
    const profileAvatar = document.getElementById('navAvatar');
    
    if (!profileDd) return;

    if (this.isLoggedIn()) {
      // Logged in - show user profile dropdown
      const user = this.currentUser;
      const nameDisplay = user.name || user.email.split('@')[0];
      const safeName = nameDisplay.replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'User';
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(safeName)}&background=e8480c&color=fff&bold=true&size=44`;
      
      profileDd.innerHTML = `
        <div class="profile-head">
          <img src="${avatarUrl}" alt="avatar" style="width:44px;height:44px;border-radius:50%;border:2px solid var(--or)"/>
          <div>
            <p class="pname">${nameDisplay}</p>
            <p class="pemail">${user.email}</p>
          </div>
        </div>
        <a href="#myaccount" style="display:flex;align-items:center;gap:10px;padding:10px 16px;font-size:0.86rem;transition:background var(--tr);cursor:pointer" onclick="handleProfileClick('account',event)">
          <i class="fas fa-user" style="color:var(--or);width:16px"></i> My Account
        </a>
        <a href="#myorders" style="display:flex;align-items:center;gap:10px;padding:10px 16px;font-size:0.86rem;transition:background var(--tr);cursor:pointer" onclick="handleProfileClick('orders',event)">
          <i class="fas fa-receipt" style="color:var(--or);width:16px"></i> My Orders
        </a>
        <a href="#favorites" style="display:flex;align-items:center;gap:10px;padding:10px 16px;font-size:0.86rem;transition:background var(--tr);cursor:pointer" onclick="handleProfileClick('favorites',event)">
          <i class="fas fa-heart" style="color:var(--or);width:16px"></i> My Favorites
        </a>
        <a href="#settings" style="display:flex;align-items:center;gap:10px;padding:10px 16px;font-size:0.86rem;transition:background var(--tr);cursor:pointer" onclick="handleProfileClick('settings',event)">
          <i class="fas fa-cog" style="color:var(--or);width:16px"></i> Settings
        </a>
        <a href="#logout" style="display:flex;align-items:center;gap:10px;padding:10px 16px;font-size:0.86rem;transition:background var(--tr);border-top:1px solid var(--bd);color:#ff4444;cursor:pointer" onclick="handleProfileClick('logout',event)">
          <i class="fas fa-sign-out-alt" style="color:#ff4444;width:16px"></i> Logout
        </a>
      `;

      // Update avatar
      if (profileAvatar) {
        profileAvatar.src = avatarUrl;
      }
    } else {
      // Not logged in - show login/register buttons
      profileDd.innerHTML = `
        <div style="padding:14px 16px;display:flex;flex-direction:column;gap:10px;">
          <a href="login.html" style="
            display:flex;align-items:center;justify-content:center;gap:8px;
            padding:10px 16px;background:var(--or);color:#fff;
            border-radius:8px;text-decoration:none;
            font-weight:900;font-size:0.88rem;
            transition:background var(--tr)
          ">
            <i class="fas fa-sign-in-alt"></i> Login
          </a>
          <a href="register.html" style="
            display:flex;align-items:center;justify-content:center;gap:8px;
            padding:10px 16px;background:rgba(238,77,45,0.12);
            color:var(--or);border:2px solid var(--or);border-radius:8px;
            text-decoration:none;font-weight:900;font-size:0.88rem;
            transition:all var(--tr)
          ">
            <i class="fas fa-user-plus"></i> Create Account
          </a>
        </div>
      `;

      // Reset avatar to guest
      if (profileAvatar) {
        profileAvatar.src = 'https://ui-avatars.com/api/?name=Guest+User&background=e8480c&color=fff&bold=true&size=32';
      }
    }
  }
};

// =====================================================
// PROFILE DROPDOWN HANDLERS
// =====================================================

function handleProfileClick(action, event) {
  event.preventDefault();
  event.stopPropagation();

  const profileDd = document.getElementById('profileDd');
  if (profileDd) {
    profileDd.classList.remove('open');
  }

  switch(action) {
    case 'account':
      showAccountModal();
      break;
    case 'orders':
      showOrdersModal();
      break;
    case 'favorites':
      showFavoritesModal();
      break;
    case 'settings':
      showSettingsModal();
      break;
    case 'logout':
      Auth.logout();
      break;
  }
}

// =====================================================
// ADDRESS MANAGEMENT FUNCTIONS
// =====================================================

// Load addresses for the current user
async function loadAddresses() {
  try {
    const token = Auth.currentUser?.token;
    if (!token) {
      showToast('Please log in to view addresses', 'error');
      return;
    }

    const response = await fetch('http://localhost:3000/api/addresses', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    
    if (data.success) {
      displayAddresses(data.addresses);
    } else {
      showToast('Failed to load addresses', 'error');
      displayAddresses([]);
    }
  } catch (error) {
    console.error('Error loading addresses:', error);
    showToast('Failed to load addresses', 'error');
    displayAddresses([]);
  }
}

// Display addresses in the settings modal
function displayAddresses(addresses) {
  const container = document.getElementById('addressesList');
  if (!container) return;

  if (addresses.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:20px;color:var(--tx2);">
        <i class="fas fa-map-marker-alt" style="font-size:2rem;margin-bottom:10px;color:var(--tx2);"></i>
        <p>No addresses saved yet</p>
        <small>Add your first address for faster checkout</small>
      </div>
    `;
    return;
  }

  container.innerHTML = addresses.map(address => `
    <div style="background:var(--bg4);border-radius:8px;padding:16px;margin-bottom:12px;border:1px solid var(--bd);">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;">
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <h4 style="font-weight:800;font-size:0.95rem;margin:0;">${address.city}, ${address.region}</h4>
            ${address.is_default ? '<span style="background:var(--or);color:#fff;font-size:0.7rem;font-weight:800;padding:2px 6px;border-radius:10px;">DEFAULT</span>' : ''}
          </div>
          <p style="color:var(--tx2);font-size:0.85rem;margin:4px 0;"><strong>Barangay:</strong> ${address.barangay}</p>
          <p style="color:var(--tx2);font-size:0.85rem;margin:4px 0;"><strong>Address:</strong> ${address.street_house}</p>
          <p style="color:var(--tx2);font-size:0.85rem;margin:4px 0;"><strong>Postal Code:</strong> ${address.postal_code}</p>
        </div>
        <div style="display:flex;gap:6px;">
          <button onclick="showAddAddressModal(${address.id})" style="background:var(--bg3);border:1px solid var(--bd);color:var(--tx);width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:0.8rem;" title="Edit">
            <i class="fas fa-edit"></i>
          </button>
          <button onclick="deleteAddress(${address.id})" style="background:#ff4444;border:none;color:#fff;width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:0.8rem;" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      ${!address.is_default ? `
        <button onclick="setDefaultAddress(${address.id})" style="background:rgba(238,77,45,0.12);color:var(--or);border:1px solid var(--or);border-radius:6px;padding:6px 12px;font-weight:700;font-size:0.8rem;cursor:pointer;">
          <i class="fas fa-star"></i> Set as Default
        </button>
      ` : ''}
    </div>
  `).join('');
}

// Save address (create or update)
async function saveAddress(addressId = null) {
  const token = Auth.currentUser?.token;
  if (!token) {
    showToast('Please log in to save addresses', 'error');
    return;
  }

  const city = document.getElementById('city').value.trim();
  const region = document.getElementById('region').value.trim();
  const postalCode = document.getElementById('postalCode').value.trim();
  const barangay = document.getElementById('barangay').value.trim();
  const streetHouse = document.getElementById('streetHouse').value.trim();
  const isDefault = document.getElementById('isDefault').checked;

  if (!city || !region || !postalCode || !barangay || !streetHouse) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  try {
    const url = addressId 
      ? `http://localhost:3000/api/addresses/${addressId}`
      : 'http://localhost:3000/api/addresses';
    
    const method = addressId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        city: city,
        region: region,
        postal_code: postalCode,
        barangay: barangay,
        street_house: streetHouse,
        is_default: isDefault
      })
    });

    const data = await response.json();

    if (data.success) {
      showToast(`Address ${addressId ? 'updated' : 'added'} successfully!`);
      document.querySelector('.modal-bg').remove();
      loadAddresses(); // Refresh the addresses list
    } else {
      showToast(data.message || 'Failed to save address', 'error');
    }
  } catch (error) {
    console.error('Error saving address:', error);
    showToast('Failed to save address', 'error');
  }
}

// Load address data for editing
async function loadAddressForEdit(addressId) {
  const token = Auth.currentUser?.token;
  if (!token) return;

  try {
    const response = await fetch(`http://localhost:3000/api/addresses/${addressId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    // Note: This endpoint doesn't exist yet, we'd need to create it
    // For now, we'll load all addresses and find the one we want
    const allResponse = await fetch('http://localhost:3000/api/addresses', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await allResponse.json();
    if (data.success) {
      const address = data.addresses.find(addr => addr.id == addressId);
      if (address) {
        document.getElementById('provinceCity').value = address.province_city;
        document.getElementById('barangay').value = address.barangay;
        document.getElementById('streetHouse').value = address.street_house;
        document.getElementById('isDefault').checked = address.is_default;
      }
    }
  } catch (error) {
    console.error('Error loading address for edit:', error);
    showToast('Failed to load address details', 'error');
  }
}

// Delete address
async function deleteAddress(addressId) {
  const token = Auth.currentUser?.token;
  if (!token) {
    showToast('Please log in to delete addresses', 'error');
    return;
  }

  if (!confirm('Are you sure you want to delete this address?')) {
    return;
  }

  try {
    const response = await fetch(`http://localhost:3000/api/addresses/${addressId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (data.success) {
      showToast('Address deleted successfully!');
      loadAddresses(); // Refresh the addresses list
    } else {
      showToast(data.message || 'Failed to delete address', 'error');
    }
  } catch (error) {
    console.error('Error deleting address:', error);
    showToast('Failed to delete address', 'error');
  }
}

// Set address as default
async function setDefaultAddress(addressId) {
  const token = Auth.currentUser?.token;
  if (!token) {
    showToast('Please log in to update addresses', 'error');
    return;
  }

  try {
    const response = await fetch(`http://localhost:3000/api/addresses/${addressId}/default`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (data.success) {
      showToast('Default address updated!');
      loadAddresses(); // Refresh the addresses list
    } else {
      showToast(data.message || 'Failed to set default address', 'error');
    }
  } catch (error) {
    console.error('Error setting default address:', error);
    showToast('Failed to set default address', 'error');
  }
}

// Load user info for settings modal
function loadUserInfo() {
  const user = Auth.currentUser;
  if (!user) return;

  const nameDisplay = user.name || user.email.split('@')[0];
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(nameDisplay)}&background=e8480c&color=fff&bold=true&size=50`;

  const settingsAvatar = document.getElementById('settingsAvatar');
  const settingsName = document.getElementById('settingsName');
  const settingsEmail = document.getElementById('settingsEmail');

  if (settingsAvatar) settingsAvatar.src = avatarUrl;
  if (settingsName) settingsName.textContent = nameDisplay;
  if (settingsEmail) settingsEmail.textContent = user.email;
}

// =====================================================
// TOAST NOTIFICATION FUNCTION
// =====================================================

function showToast(message, type = 'success') {
  // Create toast container if it doesn't exist
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 5000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    `;
    document.body.appendChild(toastContainer);
  }

  // Create toast element
  const toast = document.createElement('div');
  const backgroundColor = type === 'error' ? '#ff4444' : type === 'warning' ? '#ffaa00' : '#22c55e';
  const backgroundColor2 = type === 'error' ? '#ff2222' : type === 'warning' ? '#ff9900' : '#16a34a';
  
  toast.style.cssText = `
    background: linear-gradient(135deg, ${backgroundColor} 0%, ${backgroundColor2} 100%);
    color: white;
    padding: 14px 20px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.9rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    animation: slideInRight 0.3s ease;
    pointer-events: auto;
    cursor: pointer;
  `;
  
  toast.textContent = message;
  toastContainer.appendChild(toast);

  // Add animation styles if not already present
  if (!document.getElementById('toastStyles')) {
    const style = document.createElement('style');
    style.id = 'toastStyles';
    style.textContent = `
      @keyframes slideInRight {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOutRight {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Auto remove after 3 seconds or on click
  const removeToast = () => {
    toast.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  };

  toast.addEventListener('click', removeToast);
  setTimeout(removeToast, 3000);
}

// =====================================================
// SETTINGS MODAL
// =====================================================

function showSettingsModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-bg';
  modal.id = 'settingsModalBg';
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    z-index: 2500;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 20px;
    overflow-y: auto;
  `;

  const modalContent = document.createElement('div');
  modalContent.className = 'modal';
  modalContent.style.cssText = `
    background: var(--bg3);
    border: 1px solid var(--bd);
    border-radius: 14px;
    width: min(600px, 96vw);
    max-height: 85vh;
    overflow-y: auto;
    z-index: 2501;
    box-shadow: var(--sh);
    position: relative;
  `;

  const user = Auth.currentUser;
  const nameDisplay = user?.name || user?.email?.split('@')[0] || 'User';
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(nameDisplay)}&background=e8480c&color=fff&bold=true&size=60`;

  modalContent.innerHTML = `
    <button onclick="document.getElementById('settingsModalBg').remove()" style="
      position: absolute;
      top: 16px;
      right: 16px;
      background: var(--bg4);
      border: none;
      color: var(--tx);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      cursor: pointer;
      transition: background var(--tr);
      z-index: 10;
    " onmouseover="this.style.background='var(--bd)'" onmouseout="this.style.background='var(--bg4)'">
      ×
    </button>

    <div style="padding: 28px;">
      <!-- PROFILE HEADER -->
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--bd);">
        <img id="settingsAvatar" src="${avatarUrl}" alt="avatar" style="width: 60px; height: 60px; border-radius: 50%; border: 3px solid var(--or);">
        <div>
          <h3 id="settingsName" style="font-weight: 900; font-size: 1.1rem; margin-bottom: 4px; color: var(--tx);">${nameDisplay}</h3>
          <p id="settingsEmail" style="color: var(--tx2); font-size: 0.9rem;">${user?.email || 'user@example.com'}</p>
        </div>
      </div>

      <!-- TABS/NAV -->
      <div style="display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 2px solid var(--bd);">
        <button onclick="switchSettingsTab('addresses', this)" style="
          flex: 1;
          padding: 12px 16px;
          background: transparent;
          border: none;
          color: var(--or);
          font-weight: 900;
          font-size: 0.9rem;
          cursor: pointer;
          border-bottom: 3px solid var(--or);
          transition: all var(--tr);
        ">
          <i class="fas fa-map-marker-alt" style="margin-right: 6px;"></i> My Addresses
        </button>
        <button onclick="switchSettingsTab('profile', this)" style="
          flex: 1;
          padding: 12px 16px;
          background: transparent;
          border: none;
          color: var(--tx2);
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all var(--tr);
        " onmouseover="this.style.color='var(--tx)'" onmouseout="this.style.color='var(--tx2)'">
          <i class="fas fa-user" style="margin-right: 6px;"></i> Profile
        </button>
        <button onclick="switchSettingsTab('password', this)" style="
          flex: 1;
          padding: 12px 16px;
          background: transparent;
          border: none;
          color: var(--tx2);
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all var(--tr);
        " onmouseover="this.style.color='var(--tx)'" onmouseout="this.style.color='var(--tx2)'">
          <i class="fas fa-lock" style="margin-right: 6px;"></i> Password
        </button>
      </div>

      <!-- ADDRESSES TAB CONTENT -->
      <div id="addressesTabContent" style="display: block;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h4 style="font-weight: 900; color: var(--tx); margin: 0;">Saved Addresses</h4>
          <button onclick="showAddAddressModal()" style="
            background: var(--or);
            color: #fff;
            border: none;
            padding: 8px 14px;
            border-radius: 6px;
            font-weight: 800;
            font-size: 0.8rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: background var(--tr);
          " onmouseover="this.style.background='var(--or2)'" onmouseout="this.style.background='var(--or)'">
            <i class="fas fa-plus"></i> Add New Address
          </button>
        </div>
        <div id="addressesList" style="min-height: 100px;">
          <div style="text-align: center; padding: 40px 20px; color: var(--tx2);">
            <i class="fas fa-spinner" style="font-size: 2rem; animation: spin 1s linear infinite;"></i>
            <p style="margin-top: 12px;">Loading addresses...</p>
          </div>
        </div>
      </div>

      <!-- PROFILE TAB CONTENT -->
      <div id="profileTabContent" style="display: none;">
        <p style="color: var(--tx2); text-align: center; padding: 40px 20px;">Profile settings coming soon 👤</p>
      </div>

      <!-- PASSWORD TAB CONTENT -->
      <div id="passwordTabContent" style="display: none;">
        <p style="color: var(--tx2); text-align: center; padding: 40px 20px;">Password change coming soon 🔐</p>
      </div>
    </div>

    <style>
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    </style>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // Load addresses
  loadAddresses();
}

// =====================================================
// MY ACCOUNT MODAL
// =====================================================

function showAccountModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-bg';
  modal.id = 'accountModalBg';
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    z-index: 2500;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 20px;
    overflow-y: auto;
  `;

  const modalContent = document.createElement('div');
  modalContent.className = 'modal';
  modalContent.style.cssText = `
    background: var(--bg3);
    border: 1px solid var(--bd);
    border-radius: 14px;
    width: min(500px, 96vw);
    max-height: 85vh;
    overflow-y: auto;
    z-index: 2501;
    box-shadow: var(--sh);
    position: relative;
  `;

  const user = Auth.currentUser;
  const nameDisplay = user?.name || user?.email?.split('@')[0] || 'User';
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(nameDisplay)}&background=e8480c&color=fff&bold=true&size=80`;

  modalContent.innerHTML = `
    <button onclick="document.getElementById('accountModalBg').remove()" style="
      position: absolute;
      top: 16px;
      right: 16px;
      background: var(--bg4);
      border: none;
      color: var(--tx);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      cursor: pointer;
      transition: background var(--tr);
      z-index: 10;
    " onmouseover="this.style.background='var(--bd)'" onmouseout="this.style.background='var(--bg4)'">
      ×
    </button>

    <div style="padding: 28px;">
      <h2 style="text-align: center; font-weight: 900; color: var(--tx); margin-bottom: 24px; font-size: 1.4rem;">
        <i class="fas fa-user" style="color: var(--or); margin-right: 8px;"></i> My Profile
      </h2>

      <!-- PROFILE INFO -->
      <div style="text-align: center; margin-bottom: 32px;">
        <img src="${avatarUrl}" alt="avatar" style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid var(--or); margin-bottom: 16px;">
        <h3 style="font-weight: 900; color: var(--tx); margin-bottom: 4px;">${nameDisplay}</h3>
        <p style="color: var(--tx2); font-size: 0.9rem;">${user?.email || 'user@example.com'}</p>
        <p style="color: var(--tx2); font-size: 0.8rem; margin-top: 8px;">Member since ${new Date(user?.created_at || Date.now()).toLocaleDateString()}</p>
      </div>

      <!-- ACCOUNT STATS -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px;">
        <div style="text-align: center; padding: 16px; background: var(--bg4); border-radius: 8px;">
          <div style="font-size: 1.5rem; font-weight: 900; color: var(--or); margin-bottom: 4px;" id="ordersCount">0</div>
          <div style="font-size: 0.8rem; color: var(--tx2);">Orders</div>
        </div>
        <div style="text-align: center; padding: 16px; background: var(--bg4); border-radius: 8px;">
          <div style="font-size: 1.5rem; font-weight: 900; color: var(--or); margin-bottom: 4px;" id="favoritesCount">0</div>
          <div style="font-size: 0.8rem; color: var(--tx2);">Favorites</div>
        </div>
        <div style="text-align: center; padding: 16px; background: var(--bg4); border-radius: 8px;">
          <div style="font-size: 1.5rem; font-weight: 900; color: var(--or); margin-bottom: 4px;" id="addressesCount">0</div>
          <div style="font-size: 0.8rem; color: var(--tx2);">Addresses</div>
        </div>
      </div>

      <!-- QUICK ACTIONS -->
      <div style="border-top: 1px solid var(--bd); padding-top: 24px;">
        <h4 style="font-weight: 900; color: var(--tx); margin-bottom: 16px;">Quick Actions</h4>
        <div style="display: grid; gap: 12px;">
          <button onclick="showOrdersModal(); document.getElementById('accountModalBg').remove();" style="
            width: 100%;
            padding: 12px 16px;
            background: var(--bg4);
            border: 1px solid var(--bd);
            border-radius: 8px;
            color: var(--tx);
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: all var(--tr);
          " onmouseover="this.style.background='var(--bd)'" onmouseout="this.style.background='var(--bg4)'">
            <i class="fas fa-receipt" style="color: var(--or);"></i> View My Orders
          </button>
          <button onclick="showFavoritesModal(); document.getElementById('accountModalBg').remove();" style="
            width: 100%;
            padding: 12px 16px;
            background: var(--bg4);
            border: 1px solid var(--bd);
            border-radius: 8px;
            color: var(--tx);
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: all var(--tr);
          " onmouseover="this.style.background='var(--bd)'" onmouseout="this.style.background='var(--bg4)'">
            <i class="fas fa-heart" style="color: var(--or);"></i> View Favorites
          </button>
          <button onclick="showSettingsModal(); document.getElementById('accountModalBg').remove();" style="
            width: 100%;
            padding: 12px 16px;
            background: var(--bg4);
            border: 1px solid var(--bd);
            border-radius: 8px;
            color: var(--tx);
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: all var(--tr);
          " onmouseover="this.style.background='var(--bd)'" onmouseout="this.style.background='var(--bg4)'">
            <i class="fas fa-cog" style="color: var(--or);"></i> Account Settings
          </button>
        </div>
      </div>
    </div>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // Load stats
  loadAccountStats();
}

async function loadAccountStats() {
  try {
    const token = Auth.currentUser?.token;
    if (!token) return;

    // Load orders count
    const ordersResponse = await fetch('http://localhost:3000/api/orders', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const ordersData = await ordersResponse.json();
    document.getElementById('ordersCount').textContent = ordersData.success ? ordersData.data.length : 0;

    // Load favorites count
    const favoritesResponse = await fetch('http://localhost:3000/api/favorites', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const favoritesData = await favoritesResponse.json();
    document.getElementById('favoritesCount').textContent = favoritesData.success ? favoritesData.data.length : 0;

    // Load addresses count
    const addressesResponse = await fetch('http://localhost:3000/api/addresses', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const addressesData = await addressesResponse.json();
    document.getElementById('addressesCount').textContent = addressesData.success ? addressesData.data.length : 0;

  } catch (error) {
    console.error('Error loading account stats:', error);
  }
}

// =====================================================
// MY ORDERS MODAL
// =====================================================

function showOrdersModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-bg';
  modal.id = 'ordersModalBg';
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    z-index: 2500;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 20px;
    overflow-y: auto;
  `;

  const modalContent = document.createElement('div');
  modalContent.className = 'modal';
  modalContent.style.cssText = `
    background: var(--bg3);
    border: 1px solid var(--bd);
    border-radius: 14px;
    width: min(700px, 96vw);
    max-height: 85vh;
    overflow-y: auto;
    z-index: 2501;
    box-shadow: var(--sh);
    position: relative;
  `;

  modalContent.innerHTML = `
    <button onclick="document.getElementById('ordersModalBg').remove()" style="
      position: absolute;
      top: 16px;
      right: 16px;
      background: var(--bg4);
      border: none;
      color: var(--tx);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      cursor: pointer;
      transition: background var(--tr);
      z-index: 10;
    " onmouseover="this.style.background='var(--bd)'" onmouseout="this.style.background='var(--bg4)'">
      ×
    </button>

    <div style="padding: 28px;">
      <h2 style="font-weight: 900; color: var(--tx); margin-bottom: 24px; font-size: 1.4rem;">
        <i class="fas fa-receipt" style="color: var(--or); margin-right: 8px;"></i> My Orders
      </h2>

      <div id="ordersList" style="min-height: 200px;">
        <div style="text-align: center; padding: 40px 20px; color: var(--tx2);">
          <i class="fas fa-spinner" style="font-size: 2rem; animation: spin 1s linear infinite;"></i>
          <p style="margin-top: 12px;">Loading orders...</p>
        </div>
      </div>
    </div>

    <style>
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    </style>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // Load orders
  loadOrders();
}

async function loadOrders() {
  try {
    const token = Auth.currentUser?.token;
    if (!token) {
      document.getElementById('ordersList').innerHTML = '<p style="text-align: center; color: var(--tx2); padding: 40px;">Please log in to view your orders.</p>';
      return;
    }

    const response = await fetch('http://localhost:3000/api/orders', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();

    if (!data.success) {
      document.getElementById('ordersList').innerHTML = '<p style="text-align: center; color: var(--tx2); padding: 40px;">Error loading orders.</p>';
      return;
    }

    if (data.data.length === 0) {
      document.getElementById('ordersList').innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--tx2);">
          <i class="fas fa-shopping-cart" style="font-size: 3rem; margin-bottom: 16px;"></i>
          <p style="font-size: 1.1rem; margin-bottom: 8px;">No orders yet</p>
          <p>Start shopping to see your orders here!</p>
        </div>
      `;
      return;
    }

    const ordersHtml = data.data.map(order => `
      <div style="border: 1px solid var(--bd); border-radius: 8px; padding: 16px; margin-bottom: 16px; background: var(--bg4);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <strong style="color: var(--tx);">Order #${order.id}</strong>
            <span style="color: var(--tx2); font-size: 0.8rem; margin-left: 12px;">${new Date(order.created_at).toLocaleDateString()}</span>
          </div>
          <span style="padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; background: ${getStatusColor(order.status)}; color: #fff;">
            ${order.status.toUpperCase()}
          </span>
        </div>
        <div style="color: var(--tx2); font-size: 0.9rem; margin-bottom: 8px;">
          Payment: ${order.payment_method}
        </div>
        <div style="font-weight: 700; color: var(--or);">
          Total: ₱${order.total_amount}
        </div>
      </div>
    `).join('');

    document.getElementById('ordersList').innerHTML = ordersHtml;

  } catch (error) {
    console.error('Error loading orders:', error);
    document.getElementById('ordersList').innerHTML = '<p style="text-align: center; color: var(--tx2); padding: 40px;">Error loading orders.</p>';
  }
}

function getStatusColor(status) {
  switch(status.toLowerCase()) {
    case 'pending': return '#ff9800';
    case 'processing': return '#2196f3';
    case 'shipped': return '#4caf50';
    case 'delivered': return '#4caf50';
    case 'cancelled': return '#f44336';
    default: return '#9e9e9e';
  }
}

// =====================================================
// FAVORITES MODAL
// =====================================================

function showFavoritesModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-bg';
  modal.id = 'favoritesModalBg';
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    z-index: 2500;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 20px;
    overflow-y: auto;
  `;

  const modalContent = document.createElement('div');
  modalContent.className = 'modal';
  modalContent.style.cssText = `
    background: var(--bg3);
    border: 1px solid var(--bd);
    border-radius: 14px;
    width: min(800px, 96vw);
    max-height: 85vh;
    overflow-y: auto;
    z-index: 2501;
    box-shadow: var(--sh);
    position: relative;
  `;

  modalContent.innerHTML = `
    <button onclick="document.getElementById('favoritesModalBg').remove()" style="
      position: absolute;
      top: 16px;
      right: 16px;
      background: var(--bg4);
      border: none;
      color: var(--tx);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      cursor: pointer;
      transition: background var(--tr);
      z-index: 10;
    " onmouseover="this.style.background='var(--bd)'" onmouseout="this.style.background='var(--bg4)'">
      ×
    </button>

    <div style="padding: 28px;">
      <h2 style="font-weight: 900; color: var(--tx); margin-bottom: 24px; font-size: 1.4rem;">
        <i class="fas fa-heart" style="color: var(--or); margin-right: 8px;"></i> My Favorites
      </h2>

      <div id="favoritesList" style="min-height: 200px;">
        <div style="text-align: center; padding: 40px 20px; color: var(--tx2);">
          <i class="fas fa-spinner" style="font-size: 2rem; animation: spin 1s linear infinite;"></i>
          <p style="margin-top: 12px;">Loading favorites...</p>
        </div>
      </div>
    </div>

    <style>
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    </style>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // Load favorites
  loadFavorites();
}

async function loadFavorites() {
  try {
    const token = Auth.currentUser?.token;
    if (!token) {
      document.getElementById('favoritesList').innerHTML = '<p style="text-align: center; color: var(--tx2); padding: 40px;">Please log in to view your favorites.</p>';
      return;
    }

    const response = await fetch('http://localhost:3000/api/favorites', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();

    if (!data.success) {
      document.getElementById('favoritesList').innerHTML = '<p style="text-align: center; color: var(--tx2); padding: 40px;">Error loading favorites.</p>';
      return;
    }

    if (data.data.length === 0) {
      document.getElementById('favoritesList').innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--tx2);">
          <i class="fas fa-heart" style="font-size: 3rem; margin-bottom: 16px;"></i>
          <p style="font-size: 1.1rem; margin-bottom: 8px;">No favorites yet</p>
          <p>Browse products and add them to your favorites!</p>
        </div>
      `;
      return;
    }

    const favoritesHtml = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px;">
        ${data.data.map(fav => `
          <div style="border: 1px solid var(--bd); border-radius: 8px; overflow: hidden; background: var(--bg4); cursor: pointer; transition: all var(--tr);" onclick="openProductModal(${fav.product_id})">
            <div style="height: 120px; background: var(--bg); display: flex; align-items: center; justify-content: center;">
              <i class="fas fa-image" style="font-size: 2rem; color: var(--tx2);"></i>
            </div>
            <div style="padding: 12px;">
              <h4 style="font-weight: 700; color: var(--tx); margin-bottom: 4px; font-size: 0.9rem;">${fav.product_name || 'Product'}</h4>
              <p style="color: var(--or); font-weight: 900; font-size: 0.95rem;">₱${fav.price || '0'}</p>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('favoritesList').innerHTML = favoritesHtml;

  } catch (error) {
    console.error('Error loading favorites:', error);
    document.getElementById('favoritesList').innerHTML = '<p style="text-align: center; color: var(--tx2); padding: 40px;">Error loading favorites.</p>';
  }
}

// =====================================================
// FAVORITES API ENDPOINT
// =====================================================

// Note: This assumes there's a favorites API route. If not, it needs to be created in routes/favorites.js

// Switch between tabs in settings modal
function switchSettingsTab(tabName, buttonElement) {
  // Hide all tabs
  document.getElementById('addressesTabContent').style.display = 'none';
  document.getElementById('profileTabContent').style.display = 'none';
  document.getElementById('passwordTabContent').style.display = 'none';

  // Remove active style from all buttons
  const buttons = buttonElement.parentElement.querySelectorAll('button');
  buttons.forEach(btn => {
    btn.style.color = 'var(--tx2)';
    btn.style.borderBottom = 'none';
  });

  // Show selected tab
  document.getElementById(tabName + 'TabContent').style.display = 'block';

  // Add active style to clicked button
  buttonElement.style.color = 'var(--or)';
  buttonElement.style.borderBottom = '3px solid var(--or)';
}

// =====================================================
// ADD/EDIT ADDRESS MODAL
// =====================================================

function showAddAddressModal(addressId = null) {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    z-index: 3000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: var(--bg3);
    border: 1px solid var(--bd);
    border-radius: 14px;
    width: min(450px, 94vw);
    padding: 24px;
    z-index: 3001;
    box-shadow: var(--sh);
  `;

  const isEditing = !!addressId;
  const title = isEditing ? 'Edit Address' : 'Add New Address';

  modalContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h3 style="font-weight: 900; color: var(--tx); margin: 0; font-size: 1.2rem;">
        <i class="fas fa-map-marker-alt" style="margin-right: 8px; color: var(--or);"></i>${title}
      </h3>
      <button onclick="this.closest('div').closest('div').parentElement.remove()" style="
        background: var(--bg4);
        border: none;
        color: var(--tx);
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 1.2rem;
        transition: background var(--tr);
      " onmouseover="this.style.background='var(--bd)'" onmouseout="this.style.background='var(--bg4)'">
        ×
      </button>
    </div>

    <form id="addressForm" style="display: flex; flex-direction: column; gap: 16px;">
      <div>
        <label style="display: block; font-weight: 700; margin-bottom: 6px; color: var(--tx); font-size: 0.88rem;">
          City *
        </label>
        <input type="text" id="city" required style="
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--bd);
          border-radius: 6px;
          background: var(--bg4);
          color: var(--tx);
          font-size: 0.9rem;
          outline: none;
          font-family: 'Nunito', sans-serif;
          transition: border-color var(--tr);
        " placeholder="e.g. Manila, Cebu City">
      </div>

      <div>
        <label style="display: block; font-weight: 700; margin-bottom: 6px; color: var(--tx); font-size: 0.88rem;">
          Region *
        </label>
        <input type="text" id="region" required style="
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--bd);
          border-radius: 6px;
          background: var(--bg4);
          color: var(--tx);
          font-size: 0.9rem;
          outline: none;
          font-family: 'Nunito', sans-serif;
          transition: border-color var(--tr);
        " placeholder="e.g. National Capital Region, Central Visayas">
      </div>

      <div>
        <label style="display: block; font-weight: 700; margin-bottom: 6px; color: var(--tx); font-size: 0.88rem;">
          Postal Code *
        </label>
        <input type="text" id="postalCode" required style="
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--bd);
          border-radius: 6px;
          background: var(--bg4);
          color: var(--tx);
          font-size: 0.9rem;
          outline: none;
          font-family: 'Nunito', sans-serif;
          transition: border-color var(--tr);
        " placeholder="e.g. 1000, 6000">
      </div>

      <div>
        <label style="display: block; font-weight: 700; margin-bottom: 6px; color: var(--tx); font-size: 0.88rem;">
          Barangay *
        </label>
        <input type="text" id="barangay" required style="
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--bd);
          border-radius: 6px;
          background: var(--bg4);
          color: var(--tx);
          font-size: 0.9rem;
          outline: none;
          font-family: 'Nunito', sans-serif;
          transition: border-color var(--tr);
        " placeholder="e.g. Barangay 123, Poblacion">
      </div>

      <div>
        <label style="display: block; font-weight: 700; margin-bottom: 6px; color: var(--tx); font-size: 0.88rem;">
          Street / House Number *
        </label>
        <textarea id="streetHouse" required rows="3" style="
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--bd);
          border-radius: 6px;
          background: var(--bg4);
          color: var(--tx);
          font-size: 0.9rem;
          outline: none;
          font-family: 'Nunito', sans-serif;
          resize: vertical;
          transition: border-color var(--tr);
        " placeholder="e.g. 123 Main Street, Apartment 4B"></textarea>
      </div>

      <div style="display: flex; align-items: center; gap: 8px; padding: 10px; background: rgba(238, 77, 45, 0.08); border-radius: 6px;">
        <input type="checkbox" id="isDefault" style="width: 18px; height: 18px; cursor: pointer;">
        <label for="isDefault" style="color: var(--tx); font-size: 0.9rem; cursor: pointer; margin: 0;">
          Set as default address
        </label>
      </div>

      <div style="display: flex; gap: 10px; margin-top: 8px;">
        <button type="submit" style="
          flex: 1;
          background: var(--or);
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 12px;
          font-weight: 800;
          font-size: 0.9rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background var(--tr);
        " onmouseover="this.style.background='var(--or2)'" onmouseout="this.style.background='var(--or)'">
          <i class="fas fa-save"></i> Save Address
        </button>
        <button type="button" onclick="this.closest('div').closest('div').parentElement.remove()" style="
          background: var(--bg4);
          color: var(--tx);
          border: 1px solid var(--bd);
          border-radius: 8px;
          padding: 12px;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          transition: background var(--tr);
        " onmouseover="this.style.background='var(--bd)'" onmouseout="this.style.background='var(--bg4)'">
          Cancel
        </button>
      </div>
    </form>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // If editing, populate the form
  if (addressId) {
    populateAddressForm(addressId);
  }

  // Handle form submission
  const form = modalContent.querySelector('#addressForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveAddress(addressId);
    modal.remove();
  });

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// Populate form for editing
async function populateAddressForm(addressId) {
  try {
    const token = Auth.currentUser?.token;
    if (!token) return;

    const response = await fetch(`http://localhost:3000/api/addresses`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (data.success) {
      const address = data.addresses.find(addr => addr.id == addressId);
      if (address) {
        document.getElementById('city').value = address.city || '';
        document.getElementById('region').value = address.region || '';
        document.getElementById('postalCode').value = address.postal_code || '';
        document.getElementById('barangay').value = address.barangay || '';
        document.getElementById('streetHouse').value = address.street_house || '';
        document.getElementById('isDefault').checked = address.is_default || false;
      }
    }
  } catch (error) {
    console.error('Error loading address for editing:', error);
  }
}

// =====================================================
// BUY NOW FUNCTION
// =====================================================

function buyNow(productId) {
  // Check if user is logged in
  if (!Auth.isLoggedIn()) {
    showToast('Please login to place an order', 'error');
    openAuth('login');
    return;
  }

  // Show the checkout modal for this product
  showCheckoutModal(productId);
}

// =====================================================
// CHECKOUT MODAL FOR BUY NOW
// =====================================================

function showCheckoutModal(productId) {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    z-index: 3000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: var(--bg3);
    border: 1px solid var(--bd);
    border-radius: 14px;
    width: min(500px, 94vw);
    max-height: 90vh;
    overflow-y: auto;
    padding: 24px;
    z-index: 3001;
    box-shadow: var(--sh);
  `;

  modalContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h3 style="font-weight: 900; color: var(--tx); margin: 0; font-size: 1.3rem;">
        <i class="fas fa-shopping-cart" style="margin-right: 8px; color: var(--or);"></i>Checkout
      </h3>
      <button onclick="this.closest('div').closest('div').parentElement.remove()" style="
        background: var(--bg4);
        border: none;
        color: var(--tx);
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 1.2rem;
        transition: background var(--tr);
      " onmouseover="this.style.background='var(--bd)'" onmouseout="this.style.background='var(--bg4)'">
        ×
      </button>
    </div>

    <div style="margin-bottom: 20px; padding: 16px; background: var(--bg4); border-radius: 8px;">
      <h4 style="font-weight: 800; color: var(--tx); margin: 0 0 8px 0; font-size: 1rem;">Order Summary</h4>
      <div id="checkoutProductInfo" style="color: var(--tx2); font-size: 0.9rem;">
        Loading product details...
      </div>
    </div>

    <form id="checkoutForm" style="display: flex; flex-direction: column; gap: 16px;">
      <h4 style="font-weight: 800; color: var(--tx); margin: 0; font-size: 1.1rem;">Delivery Address</h4>

      <div>
        <label style="display: block; font-weight: 700; margin-bottom: 6px; color: var(--tx); font-size: 0.88rem;">
          City *
        </label>
        <input type="text" id="checkoutCity" required style="
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--bd);
          border-radius: 6px;
          background: var(--bg4);
          color: var(--tx);
          font-size: 0.9rem;
          outline: none;
          font-family: 'Nunito', sans-serif;
          transition: border-color var(--tr);
        " placeholder="e.g. Manila, Cebu City">
      </div>

      <div>
        <label style="display: block; font-weight: 700; margin-bottom: 6px; color: var(--tx); font-size: 0.88rem;">
          Region *
        </label>
        <input type="text" id="checkoutRegion" required style="
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--bd);
          border-radius: 6px;
          background: var(--bg4);
          color: var(--tx);
          font-size: 0.9rem;
          outline: none;
          font-family: 'Nunito', sans-serif;
          transition: border-color var(--tr);
        " placeholder="e.g. National Capital Region, Central Visayas">
      </div>

      <div>
        <label style="display: block; font-weight: 700; margin-bottom: 6px; color: var(--tx); font-size: 0.88rem;">
          Postal Code *
        </label>
        <input type="text" id="checkoutPostalCode" required style="
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--bd);
          border-radius: 6px;
          background: var(--bg4);
          color: var(--tx);
          font-size: 0.9rem;
          outline: none;
          font-family: 'Nunito', sans-serif;
          transition: border-color var(--tr);
        " placeholder="e.g. 1000, 6000">
      </div>

      <div>
        <label style="display: block; font-weight: 700; margin-bottom: 6px; color: var(--tx); font-size: 0.88rem;">
          Barangay *
        </label>
        <input type="text" id="checkoutBarangay" required style="
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--bd);
          border-radius: 6px;
          background: var(--bg4);
          color: var(--tx);
          font-size: 0.9rem;
          outline: none;
          font-family: 'Nunito', sans-serif;
          transition: border-color var(--tr);
        " placeholder="e.g. Barangay 123, Poblacion">
      </div>

      <div>
        <label style="display: block; font-weight: 700; margin-bottom: 6px; color: var(--tx); font-size: 0.88rem;">
          Street / House Number *
        </label>
        <textarea id="checkoutStreetHouse" required rows="3" style="
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--bd);
          border-radius: 6px;
          background: var(--bg4);
          color: var(--tx);
          font-size: 0.9rem;
          outline: none;
          font-family: 'Nunito', sans-serif;
          resize: vertical;
          transition: border-color var(--tr);
        " placeholder="e.g. 123 Main Street, Apartment 4B"></textarea>
      </div>

      <!-- payment method selection -->
      <div>
        <label style="display:block;font-weight:800;color:var(--tx);font-size:1rem;margin-bottom:8px;">Payment Method</label>
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;">
          <label style="font-size:0.9rem;">
            <input type="radio" name="checkoutPayment" value="gcash" checked style="margin-right:6px;"/> GCash
          </label>
          <label style="font-size:0.9rem;">
            <input type="radio" name="checkoutPayment" value="pay_in_person" style="margin-right:6px;"/> Pay in Person
          </label>
        </div>
      </div>

      <div style="display: flex; gap: 10px; margin-top: 8px;">
        <button type="submit" style="
          flex: 1;
          background: var(--or);
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 14px;
          font-weight: 800;
          font-size: 1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background var(--tr);
        " onmouseover="this.style.background='var(--or2)'" onmouseout="this.style.background='var(--or)'">
          <i class="fas fa-credit-card"></i> Place Order
        </button>
        <button type="button" onclick="this.closest('div').closest('div').parentElement.remove()" style="
          background: var(--bg4);
          color: var(--tx);
          border: 1px solid var(--bd);
          border-radius: 8px;
          padding: 14px;
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
          transition: background var(--tr);
        " onmouseover="this.style.background='var(--bd)'" onmouseout="this.style.background='var(--bg4)'">
          Cancel
        </button>
      </div>
    </form>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Load product info
  loadCheckoutProductInfo(productId);

  // Handle form submission
  const form = modalContent.querySelector('#checkoutForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await processCheckout(productId);
    modal.remove();
  });

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// Load product information for checkout
async function loadCheckoutProductInfo(productId) {
  try {
    const response = await fetch('http://localhost:3000/api/products/all');
    const data = await response.json();
    
    if (data.success) {
      const product = data.data.find(p => p.id == productId);
      if (product) {
        const productInfo = document.getElementById('checkoutProductInfo');
        const iconSrc = (/^(https?:\/\/|\/|data:)/.test(product.image_icon || '')
                         ? product.image_icon
                         : `https://placehold.co/50x50/111827/e8480c?text=${encodeURIComponent(product.image_icon || product.name.substring(0, 10))}`);
        productInfo.innerHTML = `
          <div style="display: flex; gap: 12px; align-items: center;">
            <img src="${iconSrc}" alt="${product.name}" style="width: 50px; height: 50px; border-radius: 6px; object-fit: cover;">
            <div>
              <p style="margin: 0; font-weight: 700; color: var(--tx);">${product.name}</p>
              <p style="margin: 4px 0 0 0; color: var(--or); font-weight: 800;">₱${product.price}</p>
            </div>
          </div>
        `;
      }
    }
  } catch (error) {
    console.error('Error loading product info:', error);
    document.getElementById('checkoutProductInfo').innerHTML = 'Error loading product details';
  }
}

// Process the checkout
async function processCheckout(productId) {
  const token = Auth.currentUser?.token;
  if (!token) {
    showToast('Please log in to place an order', 'error');
    return;
  }

  const city = document.getElementById('checkoutCity').value.trim();
  const region = document.getElementById('checkoutRegion').value.trim();
  const postalCode = document.getElementById('checkoutPostalCode').value.trim();
  const barangay = document.getElementById('checkoutBarangay').value.trim();
  const streetHouse = document.getElementById('checkoutStreetHouse').value.trim();
  const paymentMethod = document.querySelector('input[name="checkoutPayment"]:checked')?.value || 'gcash';

  if (!city || !region || !postalCode || !barangay || !streetHouse) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  try {
    // First, save the address
    const addressResponse = await fetch('http://localhost:3000/api/addresses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        city: city,
        region: region,
        postal_code: postalCode,
        barangay: barangay,
        street_house: streetHouse,
        is_default: false
      })
    });

    const addressData = await addressResponse.json();
    
    if (!addressData.success) {
      showToast('Failed to save address', 'error');
      return;
    }

    // Get product details for the order
    const productResponse = await fetch('http://localhost:3000/api/products/all');
    const productData = await productResponse.json();
    
    if (!productData.success) {
      showToast('Failed to load product information', 'error');
      return;
    }
    
    const product = productData.data.find(p => p.id == productId);
    if (!product) {
      showToast('Product not found', 'error');
      return;
    }

    // Create the order with product information
    const orderResponse = await fetch('http://localhost:3000/api/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        userId: Auth.currentUser.id,
        items: [{
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          size: product.size || '',
          image_icon: product.image_icon || ''
        }],
        subtotal: product.price,
        total: product.price,
        houseNo: streetHouse,
        barangay: barangay,
        city: city,
        province: region,
        region: region,
        postalCode: postalCode,
        paymentMethod: paymentMethod
      })
    });

    const orderData = await orderResponse.json();
    
    if (!orderData.success) {
      showToast('Failed to create order: ' + (orderData.message || 'Unknown error'), 'error');
      return;
    }

    showToast(`Order #${orderData.orderId} placed successfully! 🎉`, 'success');
    
    // Show order confirmation
    setTimeout(() => {
      showOrderConfirmation(orderData.orderId);
    }, 500);

  } catch (error) {
    console.error('Error processing checkout:', error);
    showToast('Failed to place order: ' + error.message, 'error');
  }
}

// Show order confirmation modal
function showOrderConfirmation(orderId) {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    z-index: 3000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: var(--bg3);
    border: 1px solid var(--bd);
    border-radius: 14px;
    width: min(450px, 94vw);
    padding: 32px;
    z-index: 3001;
    box-shadow: var(--sh);
    text-align: center;
  `;

  modalContent.innerHTML = `
    <div style="font-size: 3rem; margin-bottom: 16px;">✅</div>
    <h2 style="font-weight: 900; color: var(--tx); margin: 0 0 12px 0; font-size: 1.5rem;">Order Confirmed!</h2>
    <p style="color: var(--tx2); margin: 0 0 8px 0;">Your order has been successfully placed.</p>
    <p style="color: var(--or); font-weight: 800; font-size: 1.3rem; margin: 16px 0;">Order #${orderId}</p>
    <p style="color: var(--tx2); margin: 16px 0 24px 0; font-size: 0.9rem;">
      We'll process your order and send you updates to your registered email address.
    </p>
    <div style="display: flex; gap: 12px;">
      <button onclick="this.closest('div').parentElement.remove(); showOrdersModal();" style="
        flex: 1;
        background: var(--or);
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 12px;
        font-weight: 800;
        font-size: 0.9rem;
        cursor: pointer;
        transition: background var(--tr);
      " onmouseover="this.style.background='var(--or2)'" onmouseout="this.style.background='var(--or)'">
        View My Orders
      </button>
      <button onclick="this.closest('div').parentElement.remove();" style="
        flex: 1;
        background: var(--bg4);
        color: var(--tx);
        border: 1px solid var(--bd);
        border-radius: 8px;
        padding: 12px;
        font-weight: 800;
        font-size: 0.9rem;
        cursor: pointer;
        transition: background var(--tr);
      " onmouseover="this.style.background='var(--bd)'" onmouseout="this.style.background='var(--bg4)'">
        Continue Shopping
      </button>
    </div>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// =====================================================
// CART CHECKOUT FUNCTIONS
// =====================================================

function showCartCheckoutModal() {
  if (Cart.items.length === 0) {
    showToast('Your cart is empty', 'error');
    return;
  }

  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    z-index: 3000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: var(--bg3);
    border: 1px solid var(--bd);
    border-radius: 14px;
    width: min(550px, 94vw);
    max-height: 90vh;
    overflow-y: auto;
    padding: 24px;
    z-index: 3001;
    box-shadow: var(--sh);
  `;

  // Calculate totals
  const subtotal = Cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal; // You can add shipping, tax, etc. here

  // Build order summary HTML
  const orderSummaryHTML = Cart.items.map(item => `
    <div style="display: flex; gap: 12px; margin-bottom: 12px; padding: 12px; background: var(--bg4); border-radius: 6px;">
      <img src="${item.image}" alt="${item.name}" style="width: 60px; height: 60px; border-radius: 6px; object-fit: cover;">
      <div style="flex: 1;">
        <p style="margin: 0 0 4px 0; font-weight: 800; color: var(--tx);">${item.name}</p>
        <p style="margin: 0; color: var(--tx2); font-size: 0.85rem;">Qty: ${item.quantity} × ₱${item.price.toLocaleString()}</p>
        <p style="margin: 4px 0 0 0; color: var(--or); font-weight: 800;">₱${(item.price * item.quantity).toLocaleString()}</p>
      </div>
    </div>
  `).join('');

  modalContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h3 style="font-weight: 900; color: var(--tx); margin: 0; font-size: 1.3rem;">
        <i class="fas fa-shopping-cart" style="margin-right: 8px; color: var(--or);"></i>Cart Checkout
      </h3>
      <button onclick="this.closest('div').closest('div').parentElement.remove()" style="
        background: var(--bg4);
        border: none;
        color: var(--tx);
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 1.2rem;
        transition: background var(--tr);
      " onmouseover="this.style.background='var(--bd)'" onmouseout="this.style.background='var(--bg4)'">
        ×
      </button>
    </div>

    <div style="margin-bottom: 20px; padding: 16px; background: var(--bg4); border-radius: 8px;">
      <h4 style="font-weight: 800; color: var(--tx); margin: 0 0 12px 0; font-size: 1rem;">Order Summary</h4>
      ${orderSummaryHTML}
      <div style="border-top: 1px solid var(--bd); padding-top: 12px; margin-top: 12px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: var(--tx2);">
          <span>Subtotal:</span>
          <span>₱${subtotal.toLocaleString()}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: 800; color: var(--or); font-size: 1.1rem;">
          <span>Total:</span>
          <span>₱${total.toLocaleString()}</span>
        </div>
      </div>
    </div>

    <form id="cartCheckoutForm" style="display: flex; flex-direction: column; gap: 16px;">
      <h4 style="font-weight: 800; color: var(--tx); margin: 0; font-size: 1.1rem;">Delivery Address</h4>

      <div>
        <label style="display: block; font-weight: 700; margin-bottom: 6px; color: var(--tx); font-size: 0.88rem;">
          City *
        </label>
        <input type="text" id="cartCheckoutCity" required style="
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--bd);
          border-radius: 6px;
          background: var(--bg4);
          color: var(--tx);
          font-size: 0.9rem;
          outline: none;
          font-family: 'Nunito', sans-serif;
          transition: border-color var(--tr);
        " placeholder="e.g. Manila, Cebu City">
      </div>

      <div>
        <label style="display: block; font-weight: 700; margin-bottom: 6px; color: var(--tx); font-size: 0.88rem;">
          Region *
        </label>
        <input type="text" id="cartCheckoutRegion" required style="
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--bd);
          border-radius: 6px;
          background: var(--bg4);
          color: var(--tx);
          font-size: 0.9rem;
          outline: none;
          font-family: 'Nunito', sans-serif;
          transition: border-color var(--tr);
        " placeholder="e.g. National Capital Region, Central Visayas">
      </div>

      <div>
        <label style="display: block; font-weight: 700; margin-bottom: 6px; color: var(--tx); font-size: 0.88rem;">
          Postal Code *
        </label>
        <input type="text" id="cartCheckoutPostalCode" required style="
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--bd);
          border-radius: 6px;
          background: var(--bg4);
          color: var(--tx);
          font-size: 0.9rem;
          outline: none;
          font-family: 'Nunito', sans-serif;
          transition: border-color var(--tr);
        " placeholder="e.g. 1000, 6000">
      </div>

      <div>
        <label style="display: block; font-weight: 700; margin-bottom: 6px; color: var(--tx); font-size: 0.88rem;">
          Barangay *
        </label>
        <input type="text" id="cartCheckoutBarangay" required style="
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--bd);
          border-radius: 6px;
          background: var(--bg4);
          color: var(--tx);
          font-size: 0.9rem;
          outline: none;
          font-family: 'Nunito', sans-serif;
          transition: border-color var(--tr);
        " placeholder="e.g. Barangay 123, Poblacion">
      </div>

      <div>
        <label style="display: block; font-weight: 700; margin-bottom: 6px; color: var(--tx); font-size: 0.88rem;">
          Street / House Number *
        </label>
        <textarea id="cartCheckoutStreetHouse" required rows="3" style="
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--bd);
          border-radius: 6px;
          background: var(--bg4);
          color: var(--tx);
          font-size: 0.9rem;
          outline: none;
          font-family: 'Nunito', sans-serif;
          resize: vertical;
          transition: border-color var(--tr);
        " placeholder="e.g. 123 Main Street, Apartment 4B"></textarea>
      </div>

      <div>
        <label style="display:block;font-weight:800;color:var(--tx);font-size:1rem;margin-bottom:8px;">Payment Method</label>
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;">
          <label style="font-size:0.9rem;">
            <input type="radio" name="cartCheckoutPayment" value="gcash" checked style="margin-right:6px;"/> GCash
          </label>
          <label style="font-size:0.9rem;">
            <input type="radio" name="cartCheckoutPayment" value="pay_in_person" style="margin-right:6px;"/> Pay in Person
          </label>
        </div>
      </div>

      <div style="display: flex; gap: 10px; margin-top: 8px;">
        <button type="submit" style="
          flex: 1;
          background: var(--or);
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 14px;
          font-weight: 800;
          font-size: 1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background var(--tr);
        " onmouseover="this.style.background='var(--or2)'" onmouseout="this.style.background='var(--or)'">
          <i class="fas fa-credit-card"></i> Place Order
        </button>
        <button type="button" onclick="this.closest('div').closest('div').parentElement.remove()" style="
          background: var(--bg4);
          color: var(--tx);
          border: 1px solid var(--bd);
          border-radius: 8px;
          padding: 14px;
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
          transition: background var(--tr);
        " onmouseover="this.style.background='var(--bd)'" onmouseout="this.style.background='var(--bg4)'">
          Cancel
        </button>
      </div>
    </form>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Handle form submission
  const form = modalContent.querySelector('#cartCheckoutForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await processCartCheckout();
    modal.remove();
  });

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// Process cart checkout
async function processCartCheckout() {
  const token = Auth.currentUser?.token;
  if (!token) {
    showToast('Please log in to place an order', 'error');
    return;
  }

  const city = document.getElementById('cartCheckoutCity').value.trim();
  const region = document.getElementById('cartCheckoutRegion').value.trim();
  const postalCode = document.getElementById('cartCheckoutPostalCode').value.trim();
  const barangay = document.getElementById('cartCheckoutBarangay').value.trim();
  const streetHouse = document.getElementById('cartCheckoutStreetHouse').value.trim();
  const paymentMethod = document.querySelector('input[name="cartCheckoutPayment"]:checked')?.value || 'gcash';

  if (!city || !region || !postalCode || !barangay || !streetHouse) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  try {
    // First, save the address
    const addressResponse = await fetch('http://localhost:3000/api/addresses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        city: city,
        region: region,
        postal_code: postalCode,
        barangay: barangay,
        street_house: streetHouse,
        is_default: false
      })
    });

    const addressData = await addressResponse.json();
    
    if (!addressData.success) {
      showToast('Failed to save address', 'error');
      return;
    }

    // Calculate totals
    const subtotal = Cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total = subtotal;

    // Create the order with all cart items
    const orderResponse = await fetch('http://localhost:3000/api/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        userId: Auth.currentUser.id,
        items: Cart.items.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image_icon: item.image || ''
        })),
        subtotal: subtotal,
        total: total,
        houseNo: streetHouse,
        barangay: barangay,
        city: city,
        province: region,
        region: region,
        postalCode: postalCode,
        paymentMethod: paymentMethod
      })
    });

    const orderData = await orderResponse.json();
    
    if (!orderData.success) {
      showToast('Failed to create order: ' + (orderData.message || 'Unknown error'), 'error');
      return;
    }

    showToast(`Order #${orderData.orderId} placed successfully! 🎉`, 'success');
    
    // Clear the cart after successful order
    Cart.clear();
    
    // Close cart dropdown
    const cartDd = document.getElementById('cartDd');
    if (cartDd) cartDd.classList.remove('open');
    
    // Show order confirmation
    setTimeout(() => {
      showOrderConfirmation(orderData.orderId);
    }, 500);

  } catch (error) {
    console.error('Error processing cart checkout:', error);
    showToast('Failed to place order: ' + error.message, 'error');
  }
}

// Placeholder functions for future features
function showChangePasswordModal() {
  showToast('Change Password - Coming soon 🔐');
}

// =====================================================
// EDIT CART ITEMS MODAL
// =====================================================

function showEditCartModal() {
  if (Cart.items.length === 0) {
    showToast('Your cart is empty', 'error');
    return;
  }

  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    z-index: 3000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: var(--bg3);
    border: 1px solid var(--bd);
    border-radius: 14px;
    width: min(600px, 94vw);
    max-height: 90vh;
    overflow-y: auto;
    padding: 24px;
    z-index: 3001;
    box-shadow: var(--sh);
  `;

  const itemsHTML = Cart.items.map((item, idx) => `
    <div style="display: flex; gap: 12px; margin-bottom: 16px; padding: 16px; background: var(--bg4); border-radius: 8px; align-items: flex-start;">
      <img src="${item.image}" alt="${item.name}" style="width: 80px; height: 80px; border-radius: 6px; object-fit: cover;">
      <div style="flex: 1;">
        <p style="margin: 0 0 4px 0; font-weight: 800; color: var(--tx); font-size: 0.95rem;">${item.name}</p>
        <p style="margin: 0 0 8px 0; color: var(--tx2); font-size: 0.85rem;">Unit Price: ₱${item.price.toLocaleString()}</p>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <label style="color: var(--tx2); font-size: 0.85rem;">Qty:</label>
          <button onclick="updateCartItemQty(${idx}, ${item.quantity - 1})" style="
            background: var(--bg3);
            border: 1px solid var(--bd);
            width: 28px;
            height: 28px;
            border-radius: 4px;
            color: var(--tx);
            cursor: pointer;
            font-weight: 800;
            transition: background var(--tr);
          " onmouseover="this.style.background='var(--bd)'" onmouseout="this.style.background='var(--bg3)'">−</button>
          <input type="number" id="qty-${idx}" value="${item.quantity}" min="1" onchange="updateCartItemQty(${idx}, this.value)" style="
            width: 50px;
            padding: 4px;
            border: 1px solid var(--bd);
            border-radius: 4px;
            background: var(--bg3);
            color: var(--tx);
            text-align: center;
            font-weight: 800;
          ">
          <button onclick="updateCartItemQty(${idx}, ${item.quantity + 1})" style="
            background: var(--bg3);
            border: 1px solid var(--bd);
            width: 28px;
            height: 28px;
            border-radius: 4px;
            color: var(--tx);
            cursor: pointer;
            font-weight: 800;
            transition: background var(--tr);
          " onmouseover="this.style.background='var(--bd)'" onmouseout="this.style.background='var(--bg3)'">+</button>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <p style="margin: 0; color: var(--or); font-weight: 800;">Subtotal: ₱${(item.price * item.quantity).toLocaleString()}</p>
          <button onclick="removeCartItem(${idx})" style="
            background: #f44336;
            color: #fff;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 0.8rem;
            cursor: pointer;
            font-weight: 700;
            transition: background var(--tr);
          " onmouseover="this.style.background='#d32f2f'" onmouseout="this.style.background='#f44336'">
            <i class="fas fa-trash"></i> Remove
          </button>
        </div>
      </div>
    </div>
  `).join('');

  const subtotal = Cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  modalContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
      <h3 style="font-weight: 900; color: var(--tx); margin: 0; font-size: 1.3rem;">
        <i class="fas fa-edit" style="margin-right: 8px; color: var(--or);"></i>Edit Cart Items
      </h3>
      <button onclick="this.closest('div').closest('div').parentElement.remove()" style="
        background: var(--bg4);
        border: none;
        color: var(--tx);
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 1.2rem;
        transition: background var(--tr);
      " onmouseover="this.style.background='var(--bd)'" onmouseout="this.style.background='var(--bg4)'">
        ×
      </button>
    </div>

    <div style="margin-bottom: 24px;">
      ${itemsHTML}
    </div>

    <div style="background: var(--bg4); padding: 16px; border-radius: 8px; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; font-weight: 800; color: var(--or); font-size: 1.1rem;">
        <span>Cart Total:</span>
        <span id="cartEditTotal">₱${subtotal.toLocaleString()}</span>
      </div>
    </div>

    <div style="display: flex; gap: 10px;">
      <button onclick="
        this.closest('div').closest('div').parentElement.remove();
        setTimeout(() => showCartCheckoutModal(), 200);
      " style="
        flex: 1;
        background: var(--or);
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 14px;
        font-weight: 800;
        font-size: 1rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: background var(--tr);
      " onmouseover="this.style.background='var(--or2)'" onmouseout="this.style.background='var(--or)'">
        <i class="fas fa-check-circle"></i> Proceed to Checkout
      </button>
      <button onclick="this.closest('div').closest('div').parentElement.remove()" style="
        background: var(--bg4);
        color: var(--tx);
        border: 1px solid var(--bd);
        border-radius: 8px;
        padding: 14px;
        font-weight: 700;
        font-size: 1rem;
        cursor: pointer;
        transition: background var(--tr);
      " onmouseover="this.style.background='var(--bd)'" onmouseout="this.style.background='var(--bg4)'">
        Back
      </button>
    </div>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function updateCartItemQty(index, quantity) {
  const qty = parseInt(quantity);
  if (qty < 1) {
    removeCartItem(index);
    return;
  }
  if (Cart.items[index]) {
    Cart.items[index].quantity = qty;
    Cart.saveToStorage();
    // Update the input if it exists
    const input = document.getElementById(`qty-${index}`);
    if (input) input.value = qty;
    // Update total display if it exists
    const totalEl = document.getElementById('cartEditTotal');
    if (totalEl) {
      const subtotal = Cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      totalEl.textContent = '₱' + subtotal.toLocaleString();
    }
  }
}

function removeCartItem(index) {
  if (confirm('Remove this item from cart?')) {
    Cart.items.splice(index, 1);
    Cart.saveToStorage();
    if (Cart.items.length === 0) {
      document.querySelector('[onclick*="showEditCartModal"]')?.closest('div').parentElement.remove();
      showToast('Cart is empty', 'info');
    } else {
      // Refresh the modal
      document.querySelector('[onclick*="showEditCartModal"]')?.closest('div').parentElement.remove();
      showEditCartModal();
    }
  }
}

function confirmDeleteAccount() {
  showToast('Delete Account - Coming soon ⚠️');
}

// =====================================================
// CART MANAGEMENT SYSTEM
// =====================================================

const Cart = {
  items: [],
  total: 0,

  init() {
    this.loadFromStorage();
    this.updateUI();
  },

  loadFromStorage() {
    try {
      const saved = localStorage.getItem('motofix_cart');
      if (saved) {
        this.items = JSON.parse(saved);
        this.calculateTotal();
      }
    } catch (error) {
      console.warn('Error loading cart from storage:', error);
      this.items = [];
    }
  },

  saveToStorage() {
    try {
      localStorage.setItem('motofix_cart', JSON.stringify(this.items));
    } catch (error) {
      console.warn('Error saving cart to storage:', error);
    }
  },

  async addItem(productId, quantity = 1) {
      // Allow adding to cart without login for now
    // if (!Auth.isLoggedIn()) {
    //   showToast('Please login to add items to cart', 'error');
    //   return;
    // }

    const existing = this.items.find(item => item.id === productId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      // Get product details from the API
      try {
        const response = await fetch('http://localhost:3000/api/products/all');
        const data = await response.json();
        if (data.success) {
          const product = data.data.find(p => p.id === productId);
          if (product) {
            this.items.push({
              id: product.id,
              name: product.name,
              price: product.price,
              image: product.image_icon || '🛒',
              quantity: quantity
            });
          }
        }
      } catch (error) {
        console.error('Error fetching product:', error);
        showToast('Failed to add item to cart', 'error');
        return;
      }
    }
    this.calculateTotal();
    this.saveToStorage();
    this.updateUI();
    showToast('Added to cart! 🛒');
  },

  removeItem(productId) {
    this.items = this.items.filter(item => item.id !== productId);
    this.calculateTotal();
    this.saveToStorage();
    this.updateUI();
  },

  updateQuantity(productId, quantity) {
    if (quantity <= 0) {
      this.removeItem(productId);
      return;
    }
    const item = this.items.find(item => item.id === productId);
    if (item) {
      item.quantity = quantity;
      this.calculateTotal();
      this.saveToStorage();
      this.updateUI();
    }
  },

  calculateTotal() {
    this.total = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  },

  getItemCount() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  },

  clear() {
    this.items = [];
    this.total = 0;
    this.saveToStorage();
    this.updateUI();
  },

  updateUI() {
    const cartCount = document.getElementById('cartCount');
    const cartBody = document.getElementById('cartBody');
    const cartFooter = document.getElementById('cartFooter');
    const cartTotal = document.getElementById('cartTotal');
    const cartToggle = document.getElementById('cartToggle');
    const cartIcon = cartToggle?.querySelector('i');

    if (cartCount) {
      cartCount.textContent = this.getItemCount();
      cartCount.style.display = this.getItemCount() > 0 ? 'flex' : 'none';
    }

    // Update cart icon color - red when items in cart, default when empty
    if (cartToggle) {
      if (this.items.length > 0) {
        cartToggle.classList.add('has-items');
      } else {
        cartToggle.classList.remove('has-items');
      }
    }

    if (cartBody && cartFooter && cartTotal) {
      if (this.items.length === 0) {
        cartBody.innerHTML = '<div class="cart-empty"><i class="fas fa-box-open"></i><span>Your basket is empty</span></div>';
        cartFooter.style.display = 'none';
      } else {
        cartBody.innerHTML = this.items.map(item => `
          <div class="cart-row">
            <img src="${item.image}" alt="${item.name}"/>
            <div class="cr-info">
              <p>${item.name}</p>
              <span>₱${item.price.toLocaleString()} × ${item.quantity}</span>
            </div>
            <button onclick="Cart.removeItem(${item.id})">×</button>
          </div>
        `).join('');
        cartFooter.style.display = 'flex';
        cartTotal.textContent = `₱${this.total.toLocaleString()}`;
      }
    }
  },

  async checkout() {
    // Check if user is logged in
    if (!Auth.isLoggedIn()) {
      showToast('Please login to checkout', 'error');
      return;
    }

    // Check if cart is empty
    if (this.items.length === 0) {
      showToast('Your cart is empty', 'error');
      return;
    }

    // Check if user has saved addresses
    try {
      const token = Auth.currentUser?.token;
      if (!token) {
        showToast('Please login to checkout', 'error');
        return;
      }

      const response = await fetch('http://localhost:3000/api/addresses', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!data.success || !data.addresses || data.addresses.length === 0) {
        // No addresses - show address required modal
        this.showAddressRequiredModal();
        return;
      }

      // Has addresses - proceed with checkout
      this.showCheckoutModal();

    } catch (error) {
      console.error('Error checking addresses:', error);
      showToast('Error checking addresses', 'error');
    }
  },

  showAddressRequiredModal() {
    const modal = document.createElement('div');
    modal.innerHTML = `
      <div class="modal-bg active" style="position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:3000;">
        <div class="modal active" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--bg3);border:1px solid var(--bd);border-radius:14px;width:min(500px,96vw);max-height:88vh;overflow-y:auto;z-index:3001;box-shadow:var(--sh);">
          <button class="modal-x" onclick="this.closest('.modal-bg').remove()" style="position:absolute;top:12px;right:12px;z-index:1;background:var(--bg4);border:none;color:var(--tx);width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.9rem;transition:background var(--tr)">×</button>

          <div style="padding:24px;text-align:center;">
            <div style="font-size:3rem;margin-bottom:16px;">📍</div>
            <h2 style="font-size:1.4rem;font-weight:900;margin-bottom:12px;color:var(--tx);">Address Required</h2>
            <p style="color:var(--tx2);font-size:1rem;margin-bottom:24px;line-height:1.6;">
              Please enter your address first.
            </p>

            <form id="checkoutAddressForm" style="display:flex;flex-direction:column;gap:16px;text-align:left;">
              <div>
                <label style="display:block;font-weight:700;margin-bottom:6px;color:var(--tx);font-size:0.88rem;">Province / City *</label>
                <input type="text" id="checkoutProvinceCity" required style="width:100%;padding:10px;border:1px solid var(--bd);border-radius:6px;background:var(--bg4);color:var(--tx);font-size:0.9rem;outline:none;" placeholder="e.g. Metro Manila, Cebu City">
              </div>

              <div>
                <label style="display:block;font-weight:700;margin-bottom:6px;color:var(--tx);font-size:0.88rem;">Barangay *</label>
                <input type="text" id="checkoutBarangay" required style="width:100%;padding:10px;border:1px solid var(--bd);border-radius:6px;background:var(--bg4);color:var(--tx);font-size:0.9rem;outline:none;" placeholder="e.g. Barangay 123, Poblacion">
              </div>

              <div>
                <label style="display:block;font-weight:700;margin-bottom:6px;color:var(--tx);font-size:0.88rem;">Street / House Number *</label>
                <textarea id="checkoutStreetHouse" required rows="3" style="width:100%;padding:10px;border:1px solid var(--bd);border-radius:6px;background:var(--bg4);color:var(--tx);font-size:0.9rem;outline:none;resize:vertical;" placeholder="e.g. 123 Main Street, Apartment 4B"></textarea>
              </div>

              <div style="display:flex;gap:12px;margin-top:8px;">
                <button type="submit" style="flex:1;background:var(--or);color:#fff;border:none;border-radius:8px;padding:12px;font-weight:800;font-size:0.9rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
                  <i class="fas fa-save"></i> Save Address & Continue
                </button>
                <button type="button" onclick="this.closest('.modal-bg').remove()" style="background:var(--bg4);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:12px;font-weight:700;font-size:0.9rem;cursor:pointer;">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const form = modal.querySelector('#checkoutAddressForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveCheckoutAddress();
      modal.remove();
      this.showCheckoutModal();
    });

    modal.addEventListener('click', (e) => {
      if(e.target === modal) modal.remove();
    });
  },

  async saveCheckoutAddress() {
    const token = Auth.currentUser?.token;
    if (!token) return;

    const provinceCity = document.getElementById('checkoutProvinceCity').value.trim();
    const barangay = document.getElementById('checkoutBarangay').value.trim();
    const streetHouse = document.getElementById('checkoutStreetHouse').value.trim();

    if (!provinceCity || !barangay || !streetHouse) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/api/addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          province_city: provinceCity,
          barangay: barangay,
          street_house: streetHouse,
          is_default: true // Make this the default address
        })
      });

      const data = await response.json();

      if (data.success) {
        showToast('Address saved successfully!');
      } else {
        showToast(data.message || 'Failed to save address', 'error');
      }
    } catch (error) {
      console.error('Error saving address:', error);
      showToast('Failed to save address', 'error');
    }
  },

  showCheckoutModal() {
    // For now, just show a success message
    // In a real implementation, this would proceed with order creation
    showToast('Checkout successful! Order placed. 🎉');
    this.clear(); // Clear cart after successful checkout
  }
};

// Global function for adding to cart (called from HTML)
function addToCart(productId, quantity = 1) {
  Cart.addItem(productId, quantity);
}

// =====================================================
// PRODUCT MANAGEMENT & DISPLAY
// =====================================================

let allProducts = [];
let filteredProducts = [];

// Load all products from database
async function loadProducts() {
  try {
    const response = await fetch('http://localhost:3000/api/products/all');
    const data = await response.json();
    
    if (data.success && data.data) {
      allProducts = data.data;
      filteredProducts = [...allProducts];
      displayProducts(filteredProducts);
    } else {
      console.error('Failed to load products:', data.message);
      showToast('Failed to load products', 'error');
    }
  } catch (error) {
    console.error('Error loading products:', error);
    showToast('Error loading products', 'error');
  }
}

// Display products in grid
function displayProducts(products) {
  const grid = document.getElementById('productsGrid');
  const noResults = document.getElementById('noResults');
  
  if (!grid) return;
  
  if (products.length === 0) {
    grid.innerHTML = '';
    noResults.classList.remove('hidden');
    return;
  }
  
  noResults.classList.add('hidden');
  grid.innerHTML = products.map(product => {
    const hasImageUrl = /^(https?:\/\/|\/|data:)/.test(product.image_icon || '');
    const iconSrc = hasImageUrl ? product.image_icon : 'https://placehold.co/190x170/111827/e8480c?text=Product';
    const discount = product.original_price && product.original_price > product.price 
                     ? Math.round((1 - product.price / product.original_price) * 100)
                     : null;
    const htmlStr = `
      <div class="prod-card" onclick="openProductModal(${product.id})">
        <div class="pc-img-wrap">
          <img src="${iconSrc}" alt="${product.name}" />
          ${discount ? '<span class="pc-disc">' + discount + '% OFF</span>' : ''}
        </div>
        <div class="pc-info">
          <p class="pc-name">${product.name}</p>
          <div class="pc-stars">
            <span class="stars">${'★'.repeat(Math.round(product.rating || 4.5))}${'☆'.repeat(5 - Math.round(product.rating || 4.5))}</span>
            <small class="pc-sold">(${product.sold_count || 0})</small>
          </div>
          <div class="pc-prices">
            <span class="pc-price">₱${product.price.toLocaleString()}</span>
            ${product.original_price && product.original_price > product.price ? 
              '<span class="pc-orig">₱' + product.original_price.toLocaleString() + '</span>' : ''}
          </div>
        </div>
        <button class="pc-cart-btn" onclick="event.stopPropagation();Cart.addItem(${product.id},1);showToast('Added to cart!','success')">
          <i class="fas fa-shopping-cart"></i>
        </button>
      </div>
    `;
    return htmlStr;
  }).join('');
}

// Filter products by category
function filterCat(category) {
  if (category === 'All') {
    filteredProducts = [...allProducts];
    document.getElementById('sectionTitle').textContent = 'All Products';
  } else if (category === 'Service') {
    filteredProducts = allProducts.filter(p => p.category === 'Service');
    document.getElementById('sectionTitle').textContent = category;
  } else {
    filteredProducts = allProducts.filter(p => p.category === category);
    document.getElementById('sectionTitle').textContent = category;
  }
  // Reset sort to default
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) sortSelect.value = 'default';
  displayProducts(filteredProducts);
}

// Sort products
function sortProducts() {
  const sortValue = document.getElementById('sortSelect').value;
  let sorted = [...filteredProducts];
  
  switch(sortValue) {
    case 'price-asc':
      sorted.sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      sorted.sort((a, b) => b.price - a.price);
      break;
    case 'rating':
      sorted.sort((a, b) => (b.rating || 4.5) - (a.rating || 4.5));
      break;
    case 'popular':
      sorted.sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0));
      break;
    default:
      sorted = [...filteredProducts];
  }
  
  displayProducts(sorted);
}

// Open product detail modal
function openProductModal(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;
  
  const modal = document.getElementById('modal');
  const modalInner = document.getElementById('modalInner');
  const hasImageUrl = /^(https?:\/\/|\/|data:)/.test(product.image_icon || '');
  const iconSrc = hasImageUrl ? product.image_icon : 'https://placehold.co/300x300/111827/e8480c?text=Product';
  
  let modalHTML = `
    <div class="modal-layout">
      <div class="modal-left">
        <img class="modal-main-img" src="${iconSrc}" alt="${product.name}"/>
      </div>
      <div class="modal-right">
        <span class="modal-cat">${product.category || 'Product'}</span>
        <h2 class="modal-title">${product.name}</h2>
        <div class="modal-rating">
          <span class="stars">${'★'.repeat(Math.round(product.rating || 4.5))}${'☆'.repeat(5 - Math.round(product.rating || 4.5))}</span>
          <small>(${product.sold_count || 0} sold, Rating: ${(product.rating || 4.5).toFixed(1)})</small>
        </div>
        <div class="modal-prices">
          <span class="m-price">₱${product.price.toLocaleString()}</span>
          ${product.original_price && product.original_price > product.price ? 
            '<span class="m-orig">₱' + product.original_price.toLocaleString() + '</span>' +
            '<span class="m-disc">' + Math.round((1 - product.price / product.original_price) * 100) + '% OFF</span>' : ''}
        </div>
        <p class="modal-desc">${product.description || 'High-quality product for your motorcycle needs.'}</p>
        <div style="margin:16px 0;padding:12px 12px;background:var(--bg4);border-radius:8px;font-size:0.88rem;color:var(--tx2)">
          <strong style="color:var(--tx)">Stock:</strong> ${product.stock > 0 ? product.stock + ' available' : 'Out of Stock'}
        </div>
        <div class="modal-qty">
          <button onclick="changeQty(-1)">−</button>
          <input type="number" id="qtyInput" value="1" min="1" max="${product.stock || 1}" style="width:50px;text-align:center"/>
          <button onclick="changeQty(1)">+</button>
        </div>
        <div class="modal-actions">
          <button class="btn-add-cart" onclick="const qty = parseInt(document.getElementById('qtyInput').value);Cart.addItem(${productId},qty);showToast('Added to cart!','success')">
            <i class="fas fa-shopping-cart"></i> Add to Cart
          </button>
          <button class="btn-buy-now" onclick="const qty = parseInt(document.getElementById('qtyInput').value);Cart.addItem(${productId},qty);showCartCheckoutModal()">
            <i class="fas fa-bolt"></i> Buy Now
          </button>
        </div>
      </div>
    </div>
  `;
  
  modalInner.innerHTML = modalHTML;
  modal.classList.add('active');
  document.getElementById('modalBg').classList.add('active');
}

function changeQty(delta) {
  const input = document.getElementById('qtyInput');
  let value = parseInt(input.value) || 1;
  value = Math.max(1, value + delta);
  input.value = value;
}

function closeModal() {
  document.getElementById('modal').classList.remove('active');
  document.getElementById('modalBg').classList.remove('active');
}

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 MotoFix Auth Initialized');

  // Load all products from database
  loadProducts();

  // Initialize cart system
  Cart.init();

  // Add checkout button event listener
  const checkoutBtn = document.querySelector('.btn-checkout');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showCartCheckoutModal();
    });
  }

  // Restore session if user was logged in
  if (Auth.isLoggedIn()) {
    console.log('✅ Session restored for:', Auth.currentUser.email);
    // Auth.updateProfileDropdown(); // Disabled - HTML handles profile dropdown
  } else {
    console.log('ℹ️ No active session');
    // Auth.updateProfileDropdown(); // Disabled - HTML handles profile dropdown
  }

  // Check if redirected from login/register
  const params = new URLSearchParams(window.location.search);
  const redirectFrom = params.get('from');
  if (redirectFrom && Auth.isLoggedIn()) {
    // Redirect to the stored page
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Setup profile dropdown toggle
  setupProfileDropdown();

  // Setup cart dropdown toggle
  setupCartDropdown();
});

// =====================================================
// PROFILE DROPDOWN TOGGLE
// =====================================================

function setupProfileDropdown() {
  const profileToggle = document.getElementById('profileToggle');
  const profileDd = document.getElementById('profileDd');

  if (!profileToggle || !profileDd) return;

  profileToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = profileDd.classList.contains('open');
    
    // Close all other dropdowns
    document.querySelectorAll('.nav-dropdown').forEach(dd => {
      dd.classList.remove('open');
    });
    
    // Toggle this dropdown
    if (!isOpen) {
      profileDd.classList.add('open');
    }
  });

  // Close dropdown when clicking elsewhere
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#profileToggle')) {
      profileDd.classList.remove('open');
    }
  });
}

// =====================================================
// CART DROPDOWN TOGGLE
// =====================================================

function setupCartDropdown() {
  const cartToggle = document.getElementById('cartToggle');
  const cartDd = document.getElementById('cartDd');

  if (!cartToggle || !cartDd) return;

  cartToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = cartDd.classList.contains('open');
    
    // Close all other dropdowns
    document.querySelectorAll('.nav-dropdown').forEach(dd => {
      dd.classList.remove('open');
    });
    
    // Toggle this dropdown
    if (!isOpen) {
      cartDd.classList.add('open');
    }
  });

  // Close dropdown when clicking elsewhere
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#cartToggle')) {
      cartDd.classList.remove('open');
    }
  });
}

// =====================================================
// SESSION RECOVERY FROM LOGIN/REGISTER PAGE
// =====================================================

function recoverSessionFromLogin() {
  // This is called by login.html and register.html after successful auth
  // It will update the profile dropdown if the user was redirected back to index.html
  Auth.currentUser = getSession();
  if (Auth.isLoggedIn()) {
    // Auth.updateProfileDropdown(); // Disabled - HTML handles profile dropdown
  }
}

// Check for session when page loads (in case returning from login)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', recoverSessionFromLogin);
} else {
  recoverSessionFromLogin();
}
