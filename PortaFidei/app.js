/* ==========================================================================
   PORTA FIDEI - CLIENT APPLICATION LOGIC (CONNECTED TO NODE.JS & SUPABASE API)
   ========================================================================== */

(function () {
  'use strict';

  // --- API CLIENT ---
  const API_BASE = '/api';

  class API {
    static getToken() {
      return localStorage.getItem('pf_token');
    }

    static setToken(token) {
      if (token) {
        localStorage.setItem('pf_token', token);
      } else {
        localStorage.removeItem('pf_token');
      }
    }

    static getCurrentUser() {
      const user = localStorage.getItem('pf_current_user');
      return user ? JSON.parse(user) : null;
    }

    static setCurrentUser(user) {
      if (user) {
        localStorage.setItem('pf_current_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('pf_current_user');
      }
    }

    static async request(endpoint, method = 'GET', data = null, requiresAuth = false) {
      const headers = {
        'Content-Type': 'application/json'
      };

      const token = this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const config = { method, headers };
      if (data) {
        config.body = JSON.stringify(data);
      }

      try {
        const response = await fetch(`${API_BASE}${endpoint}`, config);
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.error || 'Erro na requisição.');
        }
        return json;
      } catch (err) {
        console.error(`API Error [${endpoint}]:`, err);
        throw err;
      }
    }

    // API METHODS
    static async getLocations() {
      return await this.request('/locations');
    }

    static async login(identifier, password) {
      const res = await this.request('/auth/login', 'POST', { identifier, password });
      this.setToken(res.token);
      this.setCurrentUser(res.user);
      return res.user;
    }

    static async register(userData) {
      return await this.request('/auth/register', 'POST', userData);
    }

    static async getBooks(params = {}) {
      const query = new URLSearchParams(params).toString();
      return await this.request(`/books${query ? '?' + query : ''}`);
    }

    static async addBook(bookData) {
      return await this.request('/books', 'POST', bookData, true);
    }

    static async updateBook(bookId, fields) {
      return await this.request(`/books/${bookId}`, 'PUT', fields, true);
    }

    static async deleteBook(bookId) {
      return await this.request(`/books/${bookId}`, 'DELETE', null, true);
    }

    static async createRental(rentalData) {
      return await this.request('/rentals', 'POST', rentalData, true);
    }

    static async getMyRentals() {
      return await this.request('/rentals/my', 'GET', null, true);
    }

    static async getAdminStats() {
      return await this.request('/admin/stats', 'GET', null, true);
    }

    static async getPendingUsers() {
      return await this.request('/admin/users/pending', 'GET', null, true);
    }

    static async updateUserStatus(userId, status) {
      return await this.request(`/admin/users/${userId}/status`, 'PATCH', { status }, true);
    }

    static async getPendingRentals() {
      return await this.request('/admin/rentals/pending', 'GET', null, true);
    }

    static async updateRentalStatus(rentalId, status) {
      return await this.request(`/admin/rentals/${rentalId}/status`, 'PATCH', { status }, true);
    }
  }

  // --- APP STATE ---
  let currentUser = API.getCurrentUser();
  let currentActiveView = 'viewCatalog';

  // Strict Admin Check
  function isAdmin(user) {
    if (!user) return false;
    if (user.role !== 'admin') return false;
    const identifier = (user.username || user.email || '').toLowerCase();
    return identifier === 'cacaia' || identifier === 'cacaia@portafidei.com';
  }

  // --- DOM ELEMENTS ---
  const views = {
    viewCatalog: document.getElementById('viewCatalog'),
    viewAuth: document.getElementById('viewAuth'),
    viewUserDashboard: document.getElementById('viewUserDashboard'),
    viewAdminDashboard: document.getElementById('viewAdminDashboard')
  };

  const navBrand = document.getElementById('navBrand');
  const navCatalogBtn = document.getElementById('navCatalogBtn');
  const navMyRentalsBtn = document.getElementById('navMyRentalsBtn');
  const navAdminBtn = document.getElementById('navAdminBtn');
  const adminPendingBadge = document.getElementById('adminPendingBadge');
  const authNavSlot = document.getElementById('authNavSlot');
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  // Search Controls
  const globalSearchInput = document.getElementById('globalSearchInput');
  const globalLocationSelect = document.getElementById('globalLocationSelect');
  const categoryFilterSelect = document.getElementById('categoryFilterSelect');
  const searchSubmitBtn = document.getElementById('searchSubmitBtn');
  const bookGridContainer = document.getElementById('bookGridContainer');

  // Auth Controls
  const authTabLogin = document.getElementById('authTabLogin');
  const authTabSignup = document.getElementById('authTabSignup');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const signupLocationSelect = document.getElementById('signupLocation');

  // User Dashboard Controls
  const userRentalsTableBody = document.getElementById('userRentalsTableBody');
  const userAccountStatusBadge = document.getElementById('userAccountStatusBadge');

  // Admin Dashboard Controls
  const statPendingUsers = document.getElementById('statPendingUsers');
  const statPendingRentals = document.getElementById('statPendingRentals');
  const statActiveRentals = document.getElementById('statActiveRentals');
  const statTotalBooks = document.getElementById('statTotalBooks');

  const adminTabUsers = document.getElementById('adminTabUsers');
  const adminTabRentals = document.getElementById('adminTabRentals');
  const adminTabBooks = document.getElementById('adminTabBooks');

  const adminTabUsersContent = document.getElementById('adminTabUsersContent');
  const adminTabRentalsContent = document.getElementById('adminTabRentalsContent');
  const adminTabBooksContent = document.getElementById('adminTabBooksContent');

  const adminUsersTableBody = document.getElementById('adminUsersTableBody');
  const adminRentalsTableBody = document.getElementById('adminRentalsTableBody');
  const adminBooksTableBody = document.getElementById('adminBooksTableBody');
  const addBookForm = document.getElementById('addBookForm');
  const newBookLocation = document.getElementById('newBookLocation');

  // Rental Modal Controls
  const rentalModal = document.getElementById('rentalModal');
  const rentalRequestForm = document.getElementById('rentalRequestForm');
  const modalBookId = document.getElementById('modalBookId');
  const modalBookTitle = document.getElementById('modalBookTitle');
  const modalBookAuthor = document.getElementById('modalBookAuthor');
  const rentalStartDate = document.getElementById('rentalStartDate');
  const rentalDurationDays = document.getElementById('rentalDurationDays');
  const rentalLocation = document.getElementById('rentalLocation');
  const calculatedReturnDate = document.getElementById('calculatedReturnDate');
  const closeModalBtn = document.getElementById('closeRentalModalBtn');
  const cancelModalBtn = document.getElementById('cancelRentalModalBtn');

  // Edit Book Modal Controls
  const editBookModal = document.getElementById('editBookModal');
  const editBookForm = document.getElementById('editBookForm');
  const editBookId = document.getElementById('editBookId');
  const editBookTitle = document.getElementById('editBookTitle');
  const editBookAuthor = document.getElementById('editBookAuthor');
  const editBookCategory = document.getElementById('editBookCategory');
  const editBookLocation = document.getElementById('editBookLocation');
  const editBookCopiesTotal = document.getElementById('editBookCopiesTotal');
  const editBookCopiesAvailable = document.getElementById('editBookCopiesAvailable');
  const closeEditBookModalBtn = document.getElementById('closeEditBookModalBtn');
  const cancelEditBookModalBtn = document.getElementById('cancelEditBookModalBtn');

  // Email Modal Controls
  const emailModal = document.getElementById('emailModal');
  const emailModalRecipient = document.getElementById('emailModalRecipient');
  const emailModalSubject = document.getElementById('emailModalSubject');
  const emailModalBody = document.getElementById('emailModalBody');
  const closeEmailModalBtn = document.getElementById('closeEmailModalBtn');
  const confirmEmailModalBtn = document.getElementById('confirmEmailModalBtn');

  const toastContainer = document.getElementById('toastContainer');

  // --- HELPER FUNCTIONS ---
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info';
    toast.innerHTML = `<i data-lucide="${iconName}"></i> <span>${message}</span>`;
    toastContainer.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // REAL & SIMULATED EMAIL DISPATCHER
  function triggerRealEmail(recipientEmail, subject, bodyText) {
    if (window.emailjs && window.emailjs.send) {
      try {
        window.emailjs.send('default_service', 'template_portafidei', {
          to_email: recipientEmail,
          subject: subject,
          message: bodyText
        }).catch(err => console.warn('EmailJS fallback:', err));
      } catch (e) {
        console.warn('EmailJS note:', e);
      }
    }

    if (emailModalRecipient && emailModalSubject && emailModalBody && emailModal) {
      emailModalRecipient.textContent = recipientEmail;
      emailModalSubject.textContent = subject;

      const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;

      emailModalBody.innerHTML = `
        <div>${bodyText.replace(/\n/g, '<br>')}</div>
        <div style="margin-top: 1rem; padding-top: 0.75rem; border-top: 1px dashed var(--border-subtle);">
          <a href="${mailtoUrl}" target="_blank" class="btn btn-burgundy btn-sm" style="text-decoration: none;">
            <i data-lucide="external-link"></i> Enviar pelo meu Cliente de E-mail (Gmail/Outlook)
          </a>
        </div>
      `;

      emailModal.classList.add('open');
      if (window.lucide) window.lucide.createIcons();
    }

    showToast(`📧 E-mail de notificação enviado para ${recipientEmail}`, 'success');
  }

  function formatDateBR(dateStr) {
    if (!dateStr) return '-';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function calculateReturnDate(startDateStr, durationDays) {
    if (!startDateStr) return '-';
    const date = new Date(startDateStr + 'T00:00:00');
    date.setDate(date.getDate() + parseInt(durationDays, 10));
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function switchView(viewName) {
    if (viewName === 'viewAdminDashboard') {
      if (!isAdmin(currentUser)) {
        showToast('Acesso negado: Apenas a usuária Administradora possui permissão de acesso ao Painel de Administração.', 'error');
        viewName = 'viewCatalog';
      }
    }

    currentActiveView = viewName;
    Object.keys(views).forEach(key => {
      if (key === viewName) {
        views[key].classList.add('active');
      } else {
        views[key].classList.remove('active');
      }
    });

    navCatalogBtn.classList.toggle('active', viewName === 'viewCatalog');
    navMyRentalsBtn.classList.toggle('active', viewName === 'viewUserDashboard');
    navAdminBtn.classList.toggle('active', viewName === 'viewAdminDashboard');

    if (viewName === 'viewCatalog') renderCatalog();
    if (viewName === 'viewUserDashboard') renderUserDashboard();
    if (viewName === 'viewAdminDashboard') renderAdminDashboard();
    if (window.lucide) window.lucide.createIcons();
  }

  async function updateAuthUI() {
    currentUser = API.getCurrentUser();

    if (currentUser && isAdmin(currentUser)) {
      try {
        const stats = await API.getAdminStats();
        const totalPending = (stats.pendingUsersCount || 0) + (stats.pendingRentalsCount || 0);

        if (totalPending > 0) {
          adminPendingBadge.textContent = totalPending;
          adminPendingBadge.style.display = 'inline-flex';
        } else {
          adminPendingBadge.style.display = 'none';
        }
      } catch (err) {
        adminPendingBadge.style.display = 'none';
      }
    } else {
      adminPendingBadge.style.display = 'none';
    }

    if (currentUser) {
      navMyRentalsBtn.style.display = currentUser.role === 'user' ? 'inline-flex' : 'none';
      navAdminBtn.style.display = isAdmin(currentUser) ? 'inline-flex' : 'none';

      authNavSlot.innerHTML = `
        <div class="user-badge">
          <div class="user-avatar">${currentUser.name.charAt(0).toUpperCase()}</div>
          <span>${currentUser.name} ${isAdmin(currentUser) ? '👑 (Admin)' : ''}</span>
          <button class="btn btn-secondary btn-sm" id="logoutBtn" style="padding: 0.2rem 0.5rem; margin-left: 0.3rem;" title="Sair da conta">
            <i data-lucide="log-out"></i> Sair
          </button>
        </div>
      `;

      document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    } else {
      navMyRentalsBtn.style.display = 'none';
      navAdminBtn.style.display = 'none';

      authNavSlot.innerHTML = `
        <button class="btn btn-primary btn-sm" id="navLoginBtn">
          <i data-lucide="log-in"></i> Entrar / Cadastrar
        </button>
      `;
      document.getElementById('navLoginBtn').addEventListener('click', () => switchView('viewAuth'));
    }
    if (window.lucide) window.lucide.createIcons();
  }

  // --- RENDER LOGIC ---

  async function populateLocationDropdowns() {
    try {
      const locations = await API.getLocations();

      globalLocationSelect.innerHTML = `<option value="ALL">📍 Todas as Unidades</option>` +
        locations.map(loc => `<option value="${loc.id}">${loc.name}</option>`).join('');

      signupLocationSelect.innerHTML = locations.map(loc => `<option value="${loc.id}">${loc.name}</option>`).join('');
      rentalLocation.innerHTML = locations.map(loc => `<option value="${loc.id}">${loc.name}</option>`).join('');
      newBookLocation.innerHTML = locations.map(loc => `<option value="${loc.id}">${loc.name}</option>`).join('');

      if (editBookLocation) {
        editBookLocation.innerHTML = locations.map(loc => `<option value="${loc.id}">${loc.name}</option>`).join('');
      }
    } catch (err) {
      console.error('Erro ao carregar locais:', err);
    }
  }

  async function renderCatalog() {
    try {
      const search = globalSearchInput.value.trim();
      const location_id = globalLocationSelect.value;
      const category = categoryFilterSelect.value;

      const books = await API.getBooks({ search, location_id, category });
      const locations = await API.getLocations();
      const locMap = Object.fromEntries(locations.map(l => [l.id, l.name]));

      if (books.length === 0) {
        bookGridContainer.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <i data-lucide="book-open" style="width: 48px; height: 48px;"></i>
            <h3>Nenhum livro encontrado</h3>
            <p>Tente ajustar os termos de pesquisa ou filtros de unidade.</p>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
      }

      bookGridContainer.innerHTML = books.map(book => {
        const locName = locMap[book.location_id] || 'Casa PF';
        const availableCount = book.copies_available !== undefined ? book.copies_available : book.copiesAvailable;
        const totalCount = book.copies_total !== undefined ? book.copies_total : book.copiesTotal;
        const isAvailable = availableCount > 0;

        return `
          <div class="book-card">
            <div class="book-cover-wrap">
              <img src="${book.cover}" alt="${book.title}" class="book-cover-img" onerror="this.src='https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80'">
              <span class="book-badge-location">📍 ${locName}</span>
            </div>
            <div class="book-info">
              <span class="book-category">${book.category}</span>
              <h3 class="book-title font-serif">${book.title}</h3>
              <p class="book-author">por ${book.author}</p>
              <div class="book-stock">
                <i data-lucide="${isAvailable ? 'check-circle' : 'alert-circle'}" style="color: ${isAvailable ? '#10B981' : '#EF4444'}"></i>
                <span>${isAvailable ? `${availableCount} de ${totalCount} exemplares` : 'Indisponível no momento'}</span>
              </div>
              <div class="book-card-footer">
                <button class="btn ${isAvailable ? 'btn-primary' : 'btn-secondary'} btn-sm btn-full open-rent-modal-btn" 
                        data-book-id="${book.id}" ${!isAvailable ? 'disabled' : ''}>
                  <i data-lucide="calendar-plus"></i> ${isAvailable ? 'Solicitar Aluguel' : 'Esgotado'}
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      document.querySelectorAll('.open-rent-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const bookId = e.currentTarget.getAttribute('data-book-id');
          openRentalModal(bookId);
        });
      });

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      showToast('Erro ao carregar catálogo de livros.', 'error');
    }
  }

  async function renderUserDashboard() {
    if (!currentUser || currentUser.role !== 'user') return;

    let statusBadgeHtml = '';
    if (currentUser.status === 'approved') {
      statusBadgeHtml = `<span class="badge-status badge-approved"><i data-lucide="check-circle"></i> Conta Aprovada</span>`;
    } else if (currentUser.status === 'pending') {
      statusBadgeHtml = `<span class="badge-status badge-pending"><i data-lucide="clock"></i> Cadastro Aguardando Aprovação</span>`;
    } else {
      statusBadgeHtml = `<span class="badge-status badge-rejected"><i data-lucide="x-circle"></i> Cadastro Rejeitado</span>`;
    }
    userAccountStatusBadge.innerHTML = statusBadgeHtml;

    try {
      const rentals = await API.getMyRentals();

      if (rentals.length === 0) {
        userRentalsTableBody.innerHTML = `
          <tr>
            <td colspan="7" class="empty-state">
              <i data-lucide="inbox" style="width: 36px; height: 36px;"></i>
              <p>Você ainda não possui nenhuma solicitação de aluguel.</p>
            </td>
          </tr>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
      }

      userRentalsTableBody.innerHTML = rentals.map(r => {
        let badgeClass = 'badge-pending';
        let statusText = 'Pendente';
        if (r.status === 'approved') {
          badgeClass = 'badge-approved';
          statusText = 'Aprovado (Pronto para Retirar)';
        } else if (r.status === 'rejected') {
          badgeClass = 'badge-rejected';
          statusText = 'Solicitação Rejeitada';
        } else if (r.status === 'active') {
          badgeClass = 'badge-active';
          statusText = 'Em Empréstimo';
        }

        return `
          <tr>
            <td><strong>${r.book_title || r.bookTitle}</strong></td>
            <td>${formatDateBR(r.created_at || r.requestedAt)}</td>
            <td>${formatDateBR(r.start_date || r.startDate)}</td>
            <td>${r.duration_days || r.durationDays} Dias</td>
            <td>${formatDateBR(r.return_date || r.returnDate)}</td>
            <td>${r.location_name || r.locationName}</td>
            <td><span class="badge-status ${badgeClass}">${statusText}</span></td>
          </tr>
        `;
      }).join('');

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      showToast('Erro ao carregar seus aluguéis.', 'error');
    }
  }

  async function renderAdminDashboard() {
    if (!isAdmin(currentUser)) {
      switchView('viewCatalog');
      return;
    }

    try {
      const stats = await API.getAdminStats();
      const pendingUsers = await API.getPendingUsers();
      const pendingRentals = await API.getPendingRentals();
      const books = await API.getBooks();
      const locations = await API.getLocations();
      const locMap = Object.fromEntries(locations.map(l => [l.id, l.name]));

      statPendingUsers.textContent = stats.pendingUsersCount;
      statPendingRentals.textContent = stats.pendingRentalsCount;
      statActiveRentals.textContent = stats.activeRentalsCount;
      statTotalBooks.textContent = stats.totalBooksCount;

      // TAB 1: PENDING USERS ONLY
      if (pendingUsers.length === 0) {
        adminUsersTableBody.innerHTML = `
          <tr>
            <td colspan="6" class="empty-state">
              <i data-lucide="check-circle" style="width: 36px; height: 36px;"></i>
              <p>Nenhuma solicitação de cadastro pendente no momento. Tudo em dia!</p>
            </td>
          </tr>
        `;
      } else {
        adminUsersTableBody.innerHTML = pendingUsers.map(u => {
          const userLoc = locMap[u.location_id || u.locationId] || 'Casa PF';
          return `
            <tr>
              <td><strong>${u.name}</strong></td>
              <td>${u.email}</td>
              <td>${userLoc}</td>
              <td>${formatDateBR(u.created_at || u.createdAt)}</td>
              <td><span class="badge-status badge-pending">Pendente</span></td>
              <td>
                <div style="display: flex; gap: 0.4rem;">
                  <button class="btn btn-success btn-sm approve-user-btn" data-user-id="${u.id}">
                    <i data-lucide="check"></i> Aceitar
                  </button>
                  <button class="btn btn-danger btn-sm reject-user-btn" data-user-id="${u.id}">
                    <i data-lucide="x"></i> Rejeitar
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }

      // TAB 2: PENDING RENTALS ONLY
      if (pendingRentals.length === 0) {
        adminRentalsTableBody.innerHTML = `
          <tr>
            <td colspan="8" class="empty-state">
              <i data-lucide="check-circle" style="width: 36px; height: 36px;"></i>
              <p>Nenhuma solicitação de aluguel pendente no momento. Tudo em dia!</p>
            </td>
          </tr>
        `;
      } else {
        adminRentalsTableBody.innerHTML = pendingRentals.map(r => {
          return `
            <tr>
              <td><strong>${r.user_name || r.userName}</strong><br><small style="color:var(--text-muted);">${r.user_email || r.userEmail}</small></td>
              <td><strong>${r.book_title || r.bookTitle}</strong></td>
              <td>${formatDateBR(r.start_date || r.startDate)}</td>
              <td>${r.duration_days || r.durationDays} Dias</td>
              <td>${formatDateBR(r.return_date || r.returnDate)}</td>
              <td>${r.location_name || r.locationName}</td>
              <td><span class="badge-status badge-pending">Pendente</span></td>
              <td>
                <div style="display: flex; gap: 0.4rem;">
                  <button class="btn btn-success btn-sm approve-rental-btn" data-rental-id="${r.id}">
                    <i data-lucide="check"></i> Aceitar
                  </button>
                  <button class="btn btn-danger btn-sm reject-rental-btn" data-rental-id="${r.id}">
                    <i data-lucide="x"></i> Rejeitar
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }

      // TAB 3: MANAGE BOOKS
      adminBooksTableBody.innerHTML = books.map(b => {
        const locName = locMap[b.location_id || b.locationId] || 'Casa PF';
        const avail = b.copies_available !== undefined ? b.copies_available : b.copiesAvailable;
        const total = b.copies_total !== undefined ? b.copies_total : b.copiesTotal;

        return `
          <tr>
            <td><strong>${b.title}</strong></td>
            <td>${b.author}</td>
            <td>${b.category}</td>
            <td>${locName}</td>
            <td>
              <span style="font-weight:700; color: ${avail > 0 ? 'var(--status-approved-text)' : 'var(--status-rejected-text)'};">
                ${avail}
              </span> / ${total} disponíveis
            </td>
            <td>
              <div style="display: flex; gap: 0.4rem;">
                <button class="btn btn-secondary btn-sm edit-book-btn" data-book-id="${b.id}">
                  <i data-lucide="edit-3"></i> Editar
                </button>
                <button class="btn btn-danger btn-sm delete-book-btn" data-book-id="${b.id}">
                  <i data-lucide="trash-2"></i> Excluir
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      // Listeners
      document.querySelectorAll('.approve-user-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const uid = e.currentTarget.getAttribute('data-user-id');
          handleUpdateUserStatus(uid, 'approved');
        });
      });

      document.querySelectorAll('.reject-user-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const uid = e.currentTarget.getAttribute('data-user-id');
          handleUpdateUserStatus(uid, 'rejected');
        });
      });

      document.querySelectorAll('.approve-rental-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const rid = e.currentTarget.getAttribute('data-rental-id');
          handleUpdateRentalStatus(rid, 'approved');
        });
      });

      document.querySelectorAll('.reject-rental-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const rid = e.currentTarget.getAttribute('data-rental-id');
          handleUpdateRentalStatus(rid, 'rejected');
        });
      });

      document.querySelectorAll('.edit-book-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const bid = e.currentTarget.getAttribute('data-book-id');
          openEditBookModal(bid);
        });
      });

      document.querySelectorAll('.delete-book-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const bid = e.currentTarget.getAttribute('data-book-id');
          handleDeleteBook(bid);
        });
      });

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      showToast('Erro ao carregar dados do painel admin.', 'error');
    }
  }

  // --- ADMIN ACTIONS ---
  async function handleUpdateUserStatus(userId, status) {
    try {
      const res = await API.updateUserStatus(userId, status);
      showToast(res.message, status === 'approved' ? 'success' : 'error');

      if (status === 'approved' && res.user) {
        const subject = '[Porta Fidei] Cadastro Aprovado com Sucesso!';
        const bodyText = `Olá ${res.user.name},\n\nSua conta na Biblioteca Porta Fidei foi APROVADA com sucesso pela administração!\n\nAgora você já pode realizar o login no site com seu e-mail (${res.user.email}) e solicitar o aluguel de obras em nossas unidades (Casa PF e Samaria PF).\n\nSeja bem-vindo(a) à Porta Fidei!`;
        triggerRealEmail(res.user.email, subject, bodyText);
      }

      await updateAuthUI();
      await renderAdminDashboard();
    } catch (err) {
      showToast(err.message || 'Erro ao atualizar status do usuário.', 'error');
    }
  }

  async function handleUpdateRentalStatus(rentalId, status) {
    try {
      const res = await API.updateRentalStatus(rentalId, status);
      showToast(res.message, status === 'approved' ? 'success' : 'error');

      if (status === 'approved' && res.rental) {
        const r = res.rental;
        const subject = '[Porta Fidei] Solicitação de Aluguel Aprovada!';
        const bodyText = `Olá ${r.user_name || r.userName},\n\nSua solicitação de aluguel do livro "${r.book_title || r.bookTitle}" foi APROVADA pela administração!\n\n📍 Unidade de Retirada: ${r.location_name || r.locationName}\n📅 Dia da Retirada (Início): ${formatDateBR(r.start_date || r.startDate)}\n⏱️ Tempo de Empréstimo: ${r.duration_days || r.durationDays} Dias\n📅 Data Prevista de Devolução: ${formatDateBR(r.return_date || r.returnDate)}\n\nApresente este e-mail na unidade selecionada para retirar seu livro. Bom estudo e leitura!`;

        triggerRealEmail(r.user_email || r.userEmail, subject, bodyText);
      }

      await updateAuthUI();
      await renderAdminDashboard();
    } catch (err) {
      showToast(err.message || 'Erro ao atualizar aluguel.', 'error');
    }
  }

  async function openEditBookModal(bookId) {
    try {
      const books = await API.getBooks();
      const book = books.find(b => b.id === bookId);
      if (!book) return;

      await populateLocationDropdowns();

      editBookId.value = book.id;
      editBookTitle.value = book.title;
      editBookAuthor.value = book.author;
      editBookCategory.value = book.category;
      editBookLocation.value = book.location_id || book.locationId;
      editBookCopiesTotal.value = book.copies_total !== undefined ? book.copies_total : book.copiesTotal;
      editBookCopiesAvailable.value = book.copies_available !== undefined ? book.copies_available : book.copiesAvailable;

      editBookModal.classList.add('open');
    } catch (err) {
      showToast('Erro ao carregar dados do livro.', 'error');
    }
  }

  function closeEditBookModal() {
    if (editBookModal) editBookModal.classList.remove('open');
  }

  async function handleDeleteBook(bookId) {
    try {
      await API.deleteBook(bookId);
      showToast('Livro excluído com sucesso!', 'info');
      await renderAdminDashboard();
      await renderCatalog();
    } catch (err) {
      showToast(err.message || 'Erro ao excluir livro.', 'error');
    }
  }

  // --- RENTAL MODAL HANDLERS ---
  async function openRentalModal(bookId) {
    if (!currentUser) {
      showToast('Você precisa fazer login para solicitar um aluguel.', 'info');
      switchView('viewAuth');
      return;
    }

    if (currentUser.status === 'pending' && !isAdmin(currentUser)) {
      showToast('A sua conta está aguardando aprovação da administração. Você ainda não pode solicitar aluguéis.', 'error');
      return;
    }

    try {
      const books = await API.getBooks();
      const book = books.find(b => b.id === bookId);
      if (!book) return;

      modalBookId.value = book.id;
      modalBookTitle.textContent = book.title;
      modalBookAuthor.textContent = `por ${book.author}`;

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      rentalStartDate.value = tomorrowStr;
      rentalStartDate.min = new Date().toISOString().split('T')[0];

      rentalLocation.value = book.location_id || book.locationId;

      updateModalReturnDate();
      rentalModal.classList.add('open');
    } catch (err) {
      showToast('Erro ao abrir formulário de aluguel.', 'error');
    }
  }

  function updateModalReturnDate() {
    const startDate = rentalStartDate.value;
    const duration = rentalDurationDays.value;
    if (startDate) {
      const returnDateStr = calculateReturnDate(startDate, duration);
      calculatedReturnDate.textContent = formatDateBR(returnDateStr);
    } else {
      calculatedReturnDate.textContent = '-';
    }
  }

  function closeRentalModal() {
    rentalModal.classList.remove('open');
  }

  function closeEmailModal() {
    if (emailModal) emailModal.classList.remove('open');
  }

  // --- AUTH HANDLERS ---
  async function handleLogin(e) {
    if (e && e.preventDefault) e.preventDefault();

    const identifier = loginForm.loginEmail.value.trim();
    const password = loginForm.loginPassword.value.trim();

    try {
      const user = await API.login(identifier, password);

      if (user.role === 'user' && user.status === 'pending') {
        showToast('⚠️ Sua conta foi registrada, mas ainda aguarda aprovação da Administração.', 'info');
      }

      await updateAuthUI();
      showToast(`Bem-vindo(a), ${user.name}!`, 'success');

      if (isAdmin(user)) {
        switchView('viewAdminDashboard');
      } else {
        switchView('viewCatalog');
      }
    } catch (err) {
      showToast(err.message || 'Usuário/E-mail ou senha incorretos.', 'error');
    }
  }

  async function handleSignup(e) {
    e.preventDefault();

    const name = signupForm.signupName.value.trim();
    const email = signupForm.signupEmail.value.trim();
    const password = signupForm.signupPassword.value.trim();
    const location_id = signupForm.signupLocation.value;

    try {
      const res = await API.register({ name, email, password, location_id });
      showToast(res.message, 'success');

      signupForm.reset();
      authTabLogin.click();
    } catch (err) {
      showToast(err.message || 'Erro ao enviar cadastro.', 'error');
    }
  }

  function handleLogout() {
    API.setToken(null);
    API.setCurrentUser(null);
    updateAuthUI();
    showToast('Você saiu da sua conta.', 'info');
    switchView('viewCatalog');
  }

  // --- EVENT LISTENERS INITIALIZATION ---
  function initEventListeners() {
    navBrand.addEventListener('click', () => switchView('viewCatalog'));
    navCatalogBtn.addEventListener('click', () => switchView('viewCatalog'));
    navMyRentalsBtn.addEventListener('click', () => switchView('viewUserDashboard'));
    navAdminBtn.addEventListener('click', () => switchView('viewAdminDashboard'));

    themeToggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      const isLight = document.body.classList.contains('light-theme');
      themeToggleBtn.innerHTML = `<i data-lucide="${isLight ? 'moon' : 'sun'}"></i>`;
      if (window.lucide) window.lucide.createIcons();
    });

    authTabLogin.addEventListener('click', () => {
      authTabLogin.classList.add('active');
      authTabSignup.classList.remove('active');
      loginForm.style.display = 'block';
      signupForm.style.display = 'none';
    });

    authTabSignup.addEventListener('click', () => {
      authTabSignup.classList.add('active');
      authTabLogin.classList.remove('active');
      signupForm.style.display = 'block';
      loginForm.style.display = 'none';
    });

    loginForm.addEventListener('submit', handleLogin);
    signupForm.addEventListener('submit', handleSignup);

    adminTabUsers.addEventListener('click', () => {
      adminTabUsers.classList.add('active');
      adminTabRentals.classList.remove('active');
      adminTabBooks.classList.remove('active');
      adminTabUsersContent.style.display = 'block';
      adminTabRentalsContent.style.display = 'none';
      adminTabBooksContent.style.display = 'none';
    });

    adminTabRentals.addEventListener('click', () => {
      adminTabRentals.classList.add('active');
      adminTabUsers.classList.remove('active');
      adminTabBooks.classList.remove('active');
      adminTabRentalsContent.style.display = 'block';
      adminTabUsersContent.style.display = 'none';
      adminTabBooksContent.style.display = 'none';
    });

    adminTabBooks.addEventListener('click', () => {
      adminTabBooks.classList.add('active');
      adminTabUsers.classList.remove('active');
      adminTabRentals.classList.remove('active');
      adminTabBooksContent.style.display = 'block';
      adminTabUsersContent.style.display = 'none';
      adminTabRentalsContent.style.display = 'none';
    });

    addBookForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!isAdmin(currentUser)) {
        showToast('Acesso negado! Operação permitida apenas para a administradora.', 'error');
        return;
      }

      const title = document.getElementById('newBookTitle').value.trim();
      const author = document.getElementById('newBookAuthor').value.trim();
      const category = document.getElementById('newBookCategory').value;
      const location_id = document.getElementById('newBookLocation').value;
      const copies_total = parseInt(document.getElementById('newBookCopies').value, 10);

      try {
        await API.addBook({
          title,
          author,
          category,
          cover: 'assets/confissoes.png',
          location_id,
          copies_total
        });

        showToast(`Livro "${title}" cadastrado com sucesso!`, 'success');
        addBookForm.reset();
        await renderAdminDashboard();
        await renderCatalog();
      } catch (err) {
        showToast(err.message || 'Erro ao cadastrar livro.', 'error');
      }
    });

    if (editBookForm) {
      editBookForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!isAdmin(currentUser)) return;

        const bookId = editBookId.value;
        try {
          await API.updateBook(bookId, {
            title: editBookTitle.value.trim(),
            author: editBookAuthor.value.trim(),
            category: editBookCategory.value,
            location_id: editBookLocation.value,
            copies_total: parseInt(editBookCopiesTotal.value, 10),
            copies_available: parseInt(editBookCopiesAvailable.value, 10)
          });

          closeEditBookModal();
          showToast('Livro atualizado com sucesso!', 'success');
          await renderAdminDashboard();
          await renderCatalog();
        } catch (err) {
          showToast(err.message || 'Erro ao atualizar livro.', 'error');
        }
      });
    }

    rentalStartDate.addEventListener('change', updateModalReturnDate);
    rentalDurationDays.addEventListener('change', updateModalReturnDate);
    closeModalBtn.addEventListener('click', closeRentalModal);
    cancelModalBtn.addEventListener('click', closeRentalModal);

    if (closeEditBookModalBtn) closeEditBookModalBtn.addEventListener('click', closeEditBookModal);
    if (cancelEditBookModalBtn) cancelEditBookModalBtn.addEventListener('click', closeEditBookModal);

    if (closeEmailModalBtn) closeEmailModalBtn.addEventListener('click', closeEmailModal);
    if (confirmEmailModalBtn) confirmEmailModalBtn.addEventListener('click', closeEmailModal);

    rentalRequestForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!currentUser) return;

      const book_id = modalBookId.value;
      const start_date = rentalStartDate.value;
      const duration_days = parseInt(rentalDurationDays.value, 10);
      const location_id = rentalLocation.value;

      try {
        await API.createRental({
          book_id,
          start_date,
          duration_days,
          location_id
        });

        closeRentalModal();
        showToast('Solicitação de aluguel enviada com sucesso! Aguarde a aprovação da Administração.', 'success');
        await updateAuthUI();
        switchView('viewUserDashboard');
      } catch (err) {
        showToast(err.message || 'Erro ao enviar solicitação.', 'error');
      }
    });

    globalSearchInput.addEventListener('input', renderCatalog);
    globalLocationSelect.addEventListener('change', renderCatalog);
    categoryFilterSelect.addEventListener('change', renderCatalog);
    searchSubmitBtn.addEventListener('click', renderCatalog);
  }

  // --- INITIALIZATION ---
  document.addEventListener('DOMContentLoaded', async () => {
    await populateLocationDropdowns();
    initEventListeners();
    await updateAuthUI();
    await renderCatalog();

    if (window.lucide) {
      window.lucide.createIcons();
    }
  });

})();
