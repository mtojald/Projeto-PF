/* ==========================================================================
   PORTA FIDEI - CLIENT APPLICATION LOGIC
   Versão refatorada: Biblioteca com catálogo público + painel admin
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

    static async request(endpoint, method = 'GET', data = null) {
      const headers = { 'Content-Type': 'application/json' };
      const token = this.getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const config = { method, headers };
      if (data) config.body = JSON.stringify(data);

      try {
        const response = await fetch(`${API_BASE}${endpoint}`, config);
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || 'Erro na requisição.');
        return json;
      } catch (err) {
        console.error(`API Error [${endpoint}]:`, err);
        throw err;
      }
    }

    // --- API METHODS ---
    static async login(email, password) {
      const res = await this.request('/auth/login', 'POST', { email, password });
      this.setToken(res.token);
      this.setCurrentUser(res.user);
      return res.user;
    }

    static async getLocations() {
      return await this.request('/locations');
    }

    static async getBooks(params = {}) {
      const query = new URLSearchParams(params).toString();
      return await this.request(`/books${query ? '?' + query : ''}`);
    }

    static async getAuthors() {
      return await this.request('/books/authors');
    }

    static async checkDuplicateTitle(title) {
      return await this.request(`/books/check-duplicate?title=${encodeURIComponent(title)}`);
    }

    static async addBook(bookData) {
      return await this.request('/books', 'POST', bookData);
    }

    static async updateBook(bookId, fields) {
      return await this.request(`/books/${bookId}`, 'PUT', fields);
    }

    static async deleteBook(bookId) {
      return await this.request(`/books/${bookId}`, 'DELETE');
    }

    static async importBooks(books) {
      return await this.request('/books/import', 'POST', { books });
    }

    static async getRentals(params = {}) {
      const query = new URLSearchParams(params).toString();
      return await this.request(`/rentals${query ? '?' + query : ''}`);
    }

    static async createRental(rentalData) {
      return await this.request('/rentals', 'POST', rentalData);
    }

    static async returnRental(rentalId) {
      return await this.request(`/rentals/${rentalId}/return`, 'PATCH');
    }

    static async getAdminStats() {
      return await this.request('/admin/stats');
    }
  }

  // --- APP STATE ---
  let currentUser = API.getCurrentUser();
  let currentActiveView = 'viewCatalog';

  // --- DOM ELEMENTS ---
  const views = {
    viewLogin: document.getElementById('viewLogin'),
    viewCatalog: document.getElementById('viewCatalog'),
    viewAdminDashboard: document.getElementById('viewAdminDashboard')
  };

  const navBrand = document.getElementById('navBrand');
  const navLinksContainer = document.getElementById('navLinksContainer');
  const navCatalogBtn = document.getElementById('navCatalogBtn');
  const navAdminBtn = document.getElementById('navAdminBtn');
  const adminActiveBadge = document.getElementById('adminActiveBadge');
  const authNavSlot = document.getElementById('authNavSlot');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const searchBarContainer = document.getElementById('searchBarContainer');

  // Search Controls
  const globalSearchInput = document.getElementById('globalSearchInput');
  const globalLocationSelect = document.getElementById('globalLocationSelect');
  const categoryFilterSelect = document.getElementById('categoryFilterSelect');
  const authorFilterSelect = document.getElementById('authorFilterSelect');
  const searchSubmitBtn = document.getElementById('searchSubmitBtn');
  const bookGridContainer = document.getElementById('bookGridContainer');

  // Login
  const loginForm = document.getElementById('loginForm');

  // Admin Dashboard
  const statTotalBooks = document.getElementById('statTotalBooks');
  const statTotalCopies = document.getElementById('statTotalCopies');
  const statActiveRentals = document.getElementById('statActiveRentals');
  const statUnavailableBooks = document.getElementById('statUnavailableBooks');

  const adminTabRentals = document.getElementById('adminTabRentals');
  const adminTabBooks = document.getElementById('adminTabBooks');
  const adminTabRentalsContent = document.getElementById('adminTabRentalsContent');
  const adminTabBooksContent = document.getElementById('adminTabBooksContent');

  const adminRentalsTableBody = document.getElementById('adminRentalsTableBody');
  const adminBooksTableBody = document.getElementById('adminBooksTableBody');
  const rentalStatusFilter = document.getElementById('rentalStatusFilter');
  const openNewRentalBtn = document.getElementById('openNewRentalBtn');
  const addBookForm = document.getElementById('addBookForm');
  const newBookLocation = document.getElementById('newBookLocation');
  const newBookTitleInput = document.getElementById('newBookTitle');
  const duplicateWarning = document.getElementById('duplicateWarning');

  // Rental Modal
  const rentalModal = document.getElementById('rentalModal');
  const rentalForm = document.getElementById('rentalForm');
  const rentalBookSelect = document.getElementById('rentalBookSelect');
  const rentalBookStock = document.getElementById('rentalBookStock');
  const rentalRenterName = document.getElementById('rentalRenterName');
  const rentalRenterContact = document.getElementById('rentalRenterContact');
  const rentalStartDate = document.getElementById('rentalStartDate');
  const rentalDurationDays = document.getElementById('rentalDurationDays');
  const rentalLocationSelect = document.getElementById('rentalLocationSelect');
  const calculatedReturnDate = document.getElementById('calculatedReturnDate');
  const closeRentalModalBtn = document.getElementById('closeRentalModalBtn');
  const cancelRentalModalBtn = document.getElementById('cancelRentalModalBtn');

  // Edit Book Modal
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
    currentActiveView = viewName;
    Object.keys(views).forEach(key => {
      if (key === viewName) {
        views[key].classList.add('active');
      } else {
        views[key].classList.remove('active');
      }
    });

    if (navCatalogBtn) navCatalogBtn.classList.toggle('active', viewName === 'viewCatalog');
    if (navAdminBtn) navAdminBtn.classList.toggle('active', viewName === 'viewAdminDashboard');

    if (viewName === 'viewCatalog') renderCatalog();
    if (viewName === 'viewAdminDashboard') renderAdminDashboard();
    if (window.lucide) window.lucide.createIcons();
  }

  function updateAuthUI() {
    currentUser = API.getCurrentUser();

    // Search bar and catalog nav always visible
    searchBarContainer.style.display = 'flex';
    navLinksContainer.style.display = 'flex';

    // Admin nav button only visible when logged in
    if (navAdminBtn) navAdminBtn.closest('li').style.display = currentUser ? '' : 'none';

    if (currentUser) {
      authNavSlot.innerHTML = `
        <div class="user-badge">
          <div class="user-avatar">${currentUser.name.charAt(0).toUpperCase()}</div>
          <span>${currentUser.name} 👑</span>
          <button class="btn btn-secondary btn-sm" id="logoutBtn" style="padding: 0.2rem 0.5rem; margin-left: 0.3rem;" title="Sair da conta">
            <i data-lucide="log-out"></i> Sair
          </button>
        </div>
      `;
      document.getElementById('logoutBtn').addEventListener('click', handleLogout);

      // Update active rentals badge
      updateAdminBadge();
    } else {
      authNavSlot.innerHTML = `
        <button class="btn btn-primary btn-sm" id="navLoginBtn">
          <i data-lucide="log-in"></i> Login Admin
        </button>
      `;
      document.getElementById('navLoginBtn').addEventListener('click', () => switchView('viewLogin'));
    }
    if (window.lucide) window.lucide.createIcons();
  }

  async function updateAdminBadge() {
    try {
      const stats = await API.getAdminStats();
      const activeCount = stats.activeRentalsCount || 0;
      if (activeCount > 0) {
        adminActiveBadge.textContent = activeCount;
        adminActiveBadge.style.display = 'inline-flex';
      } else {
        adminActiveBadge.style.display = 'none';
      }
    } catch {
      adminActiveBadge.style.display = 'none';
    }
  }

  // --- POPULATE DROPDOWNS ---
  async function populateLocationDropdowns() {
    try {
      const locations = await API.getLocations();

      globalLocationSelect.innerHTML = `<option value="ALL">📍 Todas as Unidades</option>` +
        locations.map(loc => `<option value="${loc.id}">${loc.name}</option>`).join('');

      newBookLocation.innerHTML = locations.map(loc => `<option value="${loc.id}">${loc.name}</option>`).join('');
      rentalLocationSelect.innerHTML = locations.map(loc => `<option value="${loc.id}">${loc.name}</option>`).join('');

      if (editBookLocation) {
        editBookLocation.innerHTML = locations.map(loc => `<option value="${loc.id}">${loc.name}</option>`).join('');
      }
    } catch (err) {
      console.error('Erro ao carregar locais:', err);
    }
  }

  async function populateAuthorFilter() {
    try {
      const authors = await API.getAuthors();
      authorFilterSelect.innerHTML = `<option value="ALL">✍️ Todos os Autores</option>` +
        authors.map(a => `<option value="${a}">${a}</option>`).join('');
    } catch (err) {
      console.error('Erro ao carregar autores:', err);
    }
  }

  // --- RENDER CATALOG ---
  async function renderCatalog() {
    try {
      const search = globalSearchInput.value.trim();
      const location_id = globalLocationSelect.value;
      const category = categoryFilterSelect.value;
      const author = authorFilterSelect.value;

      const books = await API.getBooks({ search, location_id, category, author });
      const locations = await API.getLocations();
      const locMap = Object.fromEntries(locations.map(l => [l.id, l.name]));

      if (books.length === 0) {
        bookGridContainer.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <i data-lucide="book-open" style="width: 48px; height: 48px;"></i>
            <h3>Nenhum livro encontrado</h3>
            <p>Tente ajustar os termos de pesquisa ou filtros.</p>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
      }

      const isAdmin = !!currentUser;

      bookGridContainer.innerHTML = books.map(book => {
        const locName = locMap[book.location_id] || 'Casa PF';
        const availableCount = book.copies_available;
        const totalCount = book.copies_total;
        const isAvailable = availableCount > 0;

        // Botão de aluguel só aparece para admin logado
        const rentBtnHtml = isAdmin
          ? `<div class="book-card-footer">
               <button class="btn ${isAvailable ? 'btn-primary' : 'btn-secondary'} btn-sm btn-full quick-rent-btn"
                       data-book-id="${book.id}" ${!isAvailable ? 'disabled' : ''}>
                 <i data-lucide="calendar-plus"></i> ${isAvailable ? 'Registrar Aluguel' : 'Esgotado'}
               </button>
             </div>`
          : '';

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
                <span>${isAvailable ? `${availableCount} ${availableCount === 1 ? 'disponível' : 'disponíveis'}` : 'Indisponível'}</span>
              </div>
              ${rentBtnHtml}
            </div>
          </div>
        `;
      }).join('');

      // Quick rent buttons from catalog cards
      document.querySelectorAll('.quick-rent-btn').forEach(btn => {
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

  // --- RENDER ADMIN DASHBOARD ---
  async function renderAdminDashboard() {
    if (!currentUser) return;

    try {
      const stats = await API.getAdminStats();
      const statusFilter = rentalStatusFilter.value;
      const rentals = await API.getRentals({ status: statusFilter });
      const books = await API.getBooks();
      const locations = await API.getLocations();
      const locMap = Object.fromEntries(locations.map(l => [l.id, l.name]));

      // Update stats
      statTotalBooks.textContent = stats.totalBooks;
      statTotalCopies.textContent = stats.totalCopies;
      statActiveRentals.textContent = stats.activeRentalsCount;
      statUnavailableBooks.textContent = stats.unavailableBooks;

      // RENTALS TABLE
      if (rentals.length === 0) {
        adminRentalsTableBody.innerHTML = `
          <tr>
            <td colspan="9" class="empty-state">
              <i data-lucide="inbox" style="width: 36px; height: 36px;"></i>
              <p>Nenhum aluguel encontrado com este filtro.</p>
            </td>
          </tr>
        `;
      } else {
        adminRentalsTableBody.innerHTML = rentals.map(r => {
          let badgeClass = 'badge-active';
          let statusText = 'Ativo';
          if (r.status === 'returned') {
            badgeClass = 'badge-returned';
            statusText = 'Devolvido';
          } else if (r.status === 'overdue') {
            badgeClass = 'badge-overdue';
            statusText = 'Atrasado';
          }

          const actionsHtml = r.status === 'active' || r.status === 'overdue'
            ? `<button class="btn btn-success btn-sm return-rental-btn" data-rental-id="${r.id}">
                 <i data-lucide="rotate-ccw"></i> Devolver
               </button>`
            : `<span style="color: var(--text-muted); font-size: 0.8rem;">${formatDateBR(r.actual_return_date)}</span>`;

          return `
            <tr>
              <td><strong>${r.book_title || ''}</strong></td>
              <td><strong>${r.renter_name}</strong></td>
              <td>${r.renter_contact || '-'}</td>
              <td>${formatDateBR(r.start_date)}</td>
              <td>${r.duration_days} Dias</td>
              <td>${formatDateBR(r.return_date)}</td>
              <td>${r.location_name || locMap[r.location_id] || '-'}</td>
              <td><span class="badge-status ${badgeClass}">${statusText}</span></td>
              <td>${actionsHtml}</td>
            </tr>
          `;
        }).join('');
      }

      // BOOKS TABLE
      adminBooksTableBody.innerHTML = books.map(b => {
        const locName = locMap[b.location_id] || 'Casa PF';
        return `
          <tr>
            <td><strong>${b.title}</strong></td>
            <td>${b.author}</td>
            <td>${b.category}</td>
            <td>${locName}</td>
            <td>
              <span style="font-weight:700; color: ${b.copies_available > 0 ? 'var(--status-approved-text)' : 'var(--status-rejected-text)'};">
                ${b.copies_available}
              </span> / ${b.copies_total} disponíveis
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

      // Event listeners
      document.querySelectorAll('.return-rental-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const rid = e.currentTarget.getAttribute('data-rental-id');
          handleReturnRental(rid);
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

  // --- RENTAL ACTIONS ---
  async function openRentalModal(preselectedBookId = null) {
    if (!currentUser) return;

    try {
      const books = await API.getBooks();
      await populateLocationDropdowns();

      rentalBookSelect.innerHTML = `<option value="">Selecione um livro...</option>` +
        books.filter(b => b.copies_available > 0).map(b =>
          `<option value="${b.id}" ${b.id === preselectedBookId ? 'selected' : ''}>${b.title} — por ${b.author} (${b.copies_available} disp.)</option>`
        ).join('');

      // Set today's date
      const today = new Date().toISOString().split('T')[0];
      rentalStartDate.value = today;
      rentalStartDate.min = today;

      rentalRenterName.value = '';
      rentalRenterContact.value = '';
      rentalDurationDays.value = '14';

      updateModalReturnDate();
      updateBookStockHint();

      rentalModal.classList.add('open');
      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      showToast('Erro ao abrir formulário de aluguel.', 'error');
    }
  }

  function updateBookStockHint() {
    const selectedOption = rentalBookSelect.options[rentalBookSelect.selectedIndex];
    if (selectedOption && selectedOption.value) {
      rentalBookStock.style.display = 'block';
      rentalBookStock.textContent = `📦 ${selectedOption.text.split('(').pop()?.replace(')', '') || ''}`;
    } else {
      rentalBookStock.style.display = 'none';
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

  async function handleCreateRental(e) {
    e.preventDefault();
    if (!currentUser) return;

    const book_id = rentalBookSelect.value;
    const renter_name = rentalRenterName.value.trim();
    const renter_contact = rentalRenterContact.value.trim();
    const start_date = rentalStartDate.value;
    const duration_days = parseInt(rentalDurationDays.value, 10);
    const location_id = rentalLocationSelect.value;

    if (!book_id) {
      showToast('Selecione um livro para o aluguel.', 'error');
      return;
    }
    if (!renter_name) {
      showToast('Informe o nome do locatário.', 'error');
      return;
    }

    try {
      await API.createRental({ book_id, renter_name, renter_contact, start_date, duration_days, location_id });

      closeRentalModal();
      showToast(`Aluguel registrado com sucesso para ${renter_name}!`, 'success');

      await populateAuthorFilter();
      await renderCatalog();
      await updateAdminBadge();

      if (currentActiveView === 'viewAdminDashboard') {
        await renderAdminDashboard();
      }
    } catch (err) {
      showToast(err.message || 'Erro ao registrar aluguel.', 'error');
    }
  }

  async function handleReturnRental(rentalId) {
    try {
      const res = await API.returnRental(rentalId);
      showToast(res.message || 'Livro devolvido com sucesso!', 'success');

      await renderAdminDashboard();
      await renderCatalog();
      await updateAdminBadge();
    } catch (err) {
      showToast(err.message || 'Erro ao registrar devolução.', 'error');
    }
  }

  // --- BOOK ACTIONS ---
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
      editBookLocation.value = book.location_id;
      editBookCopiesTotal.value = book.copies_total;
      editBookCopiesAvailable.value = book.copies_available;

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
      await populateAuthorFilter();
    } catch (err) {
      showToast(err.message || 'Erro ao excluir livro.', 'error');
    }
  }

  // --- DUPLICATE CHECK ---
  let duplicateCheckTimeout = null;
  function handleDuplicateCheck() {
    clearTimeout(duplicateCheckTimeout);
    const title = newBookTitleInput.value.trim();

    if (title.length < 3) {
      duplicateWarning.style.display = 'none';
      return;
    }

    duplicateCheckTimeout = setTimeout(async () => {
      try {
        const res = await API.checkDuplicateTitle(title);
        if (res.duplicates && res.duplicates.length > 0) {
          duplicateWarning.style.display = 'block';
          duplicateWarning.innerHTML = `
            <i data-lucide="alert-triangle"></i>
            <div>
              <strong>⚠️ Atenção:</strong> Já existe(m) livro(s) com título similar:
              <ul style="margin: 0.3rem 0 0 1rem; font-size: 0.82rem;">
                ${res.duplicates.map(d => `<li>"${d.title}" por ${d.author}</li>`).join('')}
              </ul>
              <small>Você ainda pode cadastrar o livro normalmente.</small>
            </div>
          `;
          if (window.lucide) window.lucide.createIcons();
        } else {
          duplicateWarning.style.display = 'none';
        }
      } catch {
        duplicateWarning.style.display = 'none';
      }
    }, 500);
  }

  // --- AUTH ---
  async function handleLogin(e) {
    e.preventDefault();
    const email = loginForm.loginEmail.value.trim();
    const password = loginForm.loginPassword.value.trim();

    try {
      const user = await API.login(email, password);
      updateAuthUI();
      showToast(`Bem-vinda, ${user.name}! 👑`, 'success');

      await populateLocationDropdowns();
      await populateAuthorFilter();
      switchView('viewCatalog');
    } catch (err) {
      showToast(err.message || 'E-mail ou senha incorretos.', 'error');
    }
  }

  function handleLogout() {
    API.setToken(null);
    API.setCurrentUser(null);
    updateAuthUI();
    showToast('Você saiu do sistema.', 'info');
    switchView('viewCatalog');
  }

  // --- EVENT LISTENERS ---
  function initEventListeners() {
    navBrand.addEventListener('click', () => {
      if (currentUser) switchView('viewCatalog');
    });

    navCatalogBtn.addEventListener('click', () => switchView('viewCatalog'));
    navAdminBtn.addEventListener('click', () => switchView('viewAdminDashboard'));

    themeToggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      const isLight = document.body.classList.contains('light-theme');
      themeToggleBtn.innerHTML = `<i data-lucide="${isLight ? 'moon' : 'sun'}"></i>`;
      if (window.lucide) window.lucide.createIcons();
    });

    loginForm.addEventListener('submit', handleLogin);

    // Admin Tab switching
    adminTabRentals.addEventListener('click', () => {
      adminTabRentals.classList.add('active');
      adminTabBooks.classList.remove('active');
      adminTabRentalsContent.style.display = 'block';
      adminTabBooksContent.style.display = 'none';
    });

    adminTabBooks.addEventListener('click', () => {
      adminTabBooks.classList.add('active');
      adminTabRentals.classList.remove('active');
      adminTabBooksContent.style.display = 'block';
      adminTabRentalsContent.style.display = 'none';
    });

    // Rental status filter
    rentalStatusFilter.addEventListener('change', renderAdminDashboard);

    // Open new rental modal
    openNewRentalBtn.addEventListener('click', () => openRentalModal());

    // Rental modal
    rentalForm.addEventListener('submit', handleCreateRental);
    rentalStartDate.addEventListener('change', updateModalReturnDate);
    rentalDurationDays.addEventListener('change', updateModalReturnDate);
    rentalBookSelect.addEventListener('change', updateBookStockHint);
    closeRentalModalBtn.addEventListener('click', closeRentalModal);
    cancelRentalModalBtn.addEventListener('click', closeRentalModal);

    // Edit book modal
    if (closeEditBookModalBtn) closeEditBookModalBtn.addEventListener('click', closeEditBookModal);
    if (cancelEditBookModalBtn) cancelEditBookModalBtn.addEventListener('click', closeEditBookModal);

    if (editBookForm) {
      editBookForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return;

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
          await populateAuthorFilter();
        } catch (err) {
          showToast(err.message || 'Erro ao atualizar livro.', 'error');
        }
      });
    }

    // Add book form
    addBookForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentUser) return;

      const title = document.getElementById('newBookTitle').value.trim();
      const author = document.getElementById('newBookAuthor').value.trim();
      const category = document.getElementById('newBookCategory').value;
      const location_id = document.getElementById('newBookLocation').value;
      const copies_total = parseInt(document.getElementById('newBookCopies').value, 10);

      try {
        const res = await API.addBook({
          title,
          author,
          category,
          cover: 'assets/confissoes.png',
          location_id,
          copies_total
        });

        if (res.warning) {
          showToast(res.warning, 'info');
        }

        showToast(`Livro "${title}" cadastrado com sucesso!`, 'success');
        addBookForm.reset();
        duplicateWarning.style.display = 'none';
        await renderAdminDashboard();
        await renderCatalog();
        await populateAuthorFilter();
      } catch (err) {
        showToast(err.message || 'Erro ao cadastrar livro.', 'error');
      }
    });

    // Duplicate check on title input
    newBookTitleInput.addEventListener('input', handleDuplicateCheck);

    // Catalog filters
    globalSearchInput.addEventListener('input', renderCatalog);
    globalLocationSelect.addEventListener('change', renderCatalog);
    categoryFilterSelect.addEventListener('change', renderCatalog);
    authorFilterSelect.addEventListener('change', renderCatalog);
    searchSubmitBtn.addEventListener('click', renderCatalog);

    // Import XLSX button & file handler
    const importXlsxBtn = document.getElementById('importXlsxBtn');
    const xlsxFileInput = document.getElementById('xlsxFileInput');

    if (importXlsxBtn && xlsxFileInput) {
      importXlsxBtn.addEventListener('click', () => xlsxFileInput.click());

      xlsxFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (typeof XLSX === 'undefined') {
          showToast('Biblioteca XLSX ainda não foi carregada. Tente novamente em instantes.', 'error');
          return;
        }

        try {
          showToast('Lendo e processando arquivo XLSX...', 'info');
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

          if (rawJson.length === 0) {
            showToast('O arquivo selecionado está vazio.', 'error');
            xlsxFileInput.value = '';
            return;
          }

          const res = await API.importBooks(rawJson);
          showToast(`🎉 Importação concluída! ${res.count} livro(s) importado(s) com sucesso.`, 'success');
          xlsxFileInput.value = '';

          await renderAdminDashboard();
          await renderCatalog();
          await populateAuthorFilter();
        } catch (err) {
          showToast(err.message || 'Erro ao processar arquivo XLSX.', 'error');
          xlsxFileInput.value = '';
        }
      });
    }
  }

  // --- INITIALIZATION ---
  document.addEventListener('DOMContentLoaded', async () => {
    initEventListeners();
    updateAuthUI();

    // Catálogo sempre visível — carregar filtros e exibir para todos
    await populateLocationDropdowns();
    await populateAuthorFilter();
    switchView('viewCatalog');

    if (window.lucide) {
      window.lucide.createIcons();
    }
  });

})();
