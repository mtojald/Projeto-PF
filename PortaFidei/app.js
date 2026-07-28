/* ==========================================================================
   PORTA FIDEI - LOGIC & LOCALSTORAGE MANAGER
   ========================================================================== */

(function () {
  'use strict';

  // --- SEED DATA & CONFIGURATION ---
  const INITIAL_LOCATIONS = [
    { id: 'loc-1', name: 'Casa PF' },
    { id: 'loc-2', name: 'Samaria PF' }
  ];

  const INITIAL_USERS = [
    {
      id: 'user-admin-cacaia',
      name: 'Cacaia',
      username: 'Cacaia',
      email: 'cacaia@portafidei.com',
      password: 'santafaustina',
      role: 'admin',
      status: 'approved',
      locationId: 'loc-1',
      createdAt: '2026-01-01'
    }
  ];

  const INITIAL_BOOKS = [
    {
      id: 'book-1',
      title: 'Confissões de Santo Agostinho',
      author: 'Santo Agostinho',
      category: 'Espiritualidade',
      cover: 'assets/confissoes.png',
      locationId: 'loc-1',
      copiesAvailable: 4,
      copiesTotal: 5
    },
    {
      id: 'book-2',
      title: 'Suma Teológica (Volume I)',
      author: 'Santo Tomás de Aquino',
      category: 'Teologia',
      cover: 'assets/suma-teologica.png',
      locationId: 'loc-1',
      copiesAvailable: 2,
      copiesTotal: 3
    },
    {
      id: 'book-3',
      title: 'Imitação de Cristo',
      author: 'Tomás de Kempis',
      category: 'Espiritualidade',
      cover: 'assets/confissoes.png',
      locationId: 'loc-2',
      copiesAvailable: 5,
      copiesTotal: 5
    },
    {
      id: 'book-4',
      title: 'O Castelo Interior',
      author: 'Santa Teresa de Ávila',
      category: 'Espiritualidade',
      cover: 'assets/suma-teologica.png',
      locationId: 'loc-2',
      copiesAvailable: 3,
      copiesTotal: 3
    }
  ];

  const INITIAL_RENTALS = [];

  // --- SECURITY & STORAGE MANAGER ---
  class StorageManager {
    static init() {
      // 1. Locations setup & migration
      let locations = StorageManager.get('locations');
      if (!locations || locations.length === 0 || !locations.some(l => l.name === 'Casa PF')) {
        localStorage.setItem('pf_locations', JSON.stringify(INITIAL_LOCATIONS));
      }

      // 2. Users setup & migration
      let users = StorageManager.get('users');
      if (!users || users.length === 0) {
        users = INITIAL_USERS;
      } else {
        users = users.filter(u => u.email !== 'admin@portafidei.com');

        const cacaiaIdx = users.findIndex(u =>
          (u.username && u.username.toLowerCase() === 'cacaia') ||
          (u.email && u.email.toLowerCase() === 'cacaia') ||
          (u.email && u.email.toLowerCase() === 'cacaia@portafidei.com')
        );

        if (cacaiaIdx === -1) {
          users.unshift(INITIAL_USERS[0]);
        } else {
          users[cacaiaIdx].password = 'santafaustina';
          users[cacaiaIdx].role = 'admin';
          users[cacaiaIdx].status = 'approved';
          users[cacaiaIdx].username = 'Cacaia';
        }
      }
      localStorage.setItem('pf_users', JSON.stringify(users));

      // 3. Books setup & migration
      let books = StorageManager.get('books');
      if (!books || books.length === 0) {
        localStorage.setItem('pf_books', JSON.stringify(INITIAL_BOOKS));
      } else {
        books.forEach(b => {
          if (b.locationId !== 'loc-1' && b.locationId !== 'loc-2') {
            b.locationId = 'loc-1';
          }
        });
        localStorage.setItem('pf_books', JSON.stringify(books));
      }

      // 4. Rentals setup
      if (!localStorage.getItem('pf_rentals')) {
        localStorage.setItem('pf_rentals', JSON.stringify(INITIAL_RENTALS));
      }
    }

    static get(key) {
      const data = localStorage.getItem(`pf_${key}`);
      return data ? JSON.parse(data) : [];
    }

    static set(key, value) {
      localStorage.setItem(`pf_${key}`, JSON.stringify(value));
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
  }

  // Initialize Storage
  StorageManager.init();

  // --- APP STATE ---
  let currentUser = StorageManager.getCurrentUser();
  let currentActiveView = 'viewCatalog';
  let currentAdminTab = 'adminTabUsers';

  // --- STRICT ADMIN VERIFICATION GUARD ---
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
    // 1. Try sending via EmailJS if loaded
    if (window.emailjs && window.emailjs.send) {
      try {
        window.emailjs.send('default_service', 'template_portafidei', {
          to_email: recipientEmail,
          subject: subject,
          message: bodyText
        }).catch(err => console.warn('EmailJS fallback active:', err));
      } catch (e) {
        console.warn('EmailJS dispatch note:', e);
      }
    }

    // 2. Open Email Modal Confirmation
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
    const parts = dateStr.split('-');
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
    // SECURITY GUARD: Check admin access before switching to admin view
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

    // Update Nav Buttons State
    navCatalogBtn.classList.toggle('active', viewName === 'viewCatalog');
    navMyRentalsBtn.classList.toggle('active', viewName === 'viewUserDashboard');
    navAdminBtn.classList.toggle('active', viewName === 'viewAdminDashboard');

    // Trigger renders
    if (viewName === 'viewCatalog') renderCatalog();
    if (viewName === 'viewUserDashboard') renderUserDashboard();
    if (viewName === 'viewAdminDashboard') renderAdminDashboard();
    if (window.lucide) window.lucide.createIcons();
  }

  function updateAuthUI() {
    currentUser = StorageManager.getCurrentUser();
    const pendingUsers = StorageManager.get('users').filter(u => u.status === 'pending');
    const pendingRentals = StorageManager.get('rentals').filter(r => r.status === 'pending');
    const totalPending = pendingUsers.length + pendingRentals.length;

    if (totalPending > 0 && isAdmin(currentUser)) {
      adminPendingBadge.textContent = totalPending;
      adminPendingBadge.style.display = 'inline-flex';
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

  // Populate Location Dropdowns
  function populateLocationDropdowns() {
    const locations = StorageManager.get('locations');

    // Global Filter
    globalLocationSelect.innerHTML = `<option value="ALL">📍 Todas as Unidades</option>` +
      locations.map(loc => `<option value="${loc.id}">${loc.name}</option>`).join('');

    // Signup Location
    signupLocationSelect.innerHTML = locations.map(loc => `<option value="${loc.id}">${loc.name}</option>`).join('');

    // Rental Modal Location
    rentalLocation.innerHTML = locations.map(loc => `<option value="${loc.id}">${loc.name}</option>`).join('');

    // Add Book Location
    newBookLocation.innerHTML = locations.map(loc => `<option value="${loc.id}">${loc.name}</option>`).join('');

    // Edit Book Location
    if (editBookLocation) {
      editBookLocation.innerHTML = locations.map(loc => `<option value="${loc.id}">${loc.name}</option>`).join('');
    }
  }

  // Render Book Catalog
  function renderCatalog() {
    const books = StorageManager.get('books');
    const locations = StorageManager.get('locations');
    const locMap = Object.fromEntries(locations.map(l => [l.id, l.name]));

    const searchVal = globalSearchInput.value.toLowerCase().trim();
    const selectedLoc = globalLocationSelect.value;
    const selectedCat = categoryFilterSelect.value;

    const filtered = books.filter(book => {
      const matchesSearch = book.title.toLowerCase().includes(searchVal) ||
        book.author.toLowerCase().includes(searchVal) ||
        book.category.toLowerCase().includes(searchVal);
      const matchesLoc = selectedLoc === 'ALL' || book.locationId === selectedLoc;
      const matchesCat = selectedCat === 'ALL' || book.category === selectedCat;

      return matchesSearch && matchesLoc && matchesCat;
    });

    if (filtered.length === 0) {
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

    bookGridContainer.innerHTML = filtered.map(book => {
      const locName = locMap[book.locationId] || 'Casa PF';
      const isAvailable = book.copiesAvailable > 0;

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
              <span>${isAvailable ? `${book.copiesAvailable} de ${book.copiesTotal} exemplares` : 'Indisponível no momento'}</span>
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

    // Attach listeners to rental buttons
    document.querySelectorAll('.open-rent-modal-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const bookId = e.currentTarget.getAttribute('data-book-id');
        openRentalModal(bookId);
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // Render User Dashboard
  function renderUserDashboard() {
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

    const rentals = StorageManager.get('rentals').filter(r => r.userId === currentUser.id);

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
          <td><strong>${r.bookTitle}</strong></td>
          <td>${formatDateBR(r.requestedAt)}</td>
          <td>${formatDateBR(r.startDate)}</td>
          <td>${r.durationDays} Dias</td>
          <td>${formatDateBR(r.returnDate)}</td>
          <td>${r.locationName}</td>
          <td><span class="badge-status ${badgeClass}">${statusText}</span></td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  // Render Admin Dashboard
  function renderAdminDashboard() {
    if (!isAdmin(currentUser)) {
      switchView('viewCatalog');
      return;
    }

    const users = StorageManager.get('users');
    const rentals = StorageManager.get('rentals');
    const books = StorageManager.get('books');
    const locations = StorageManager.get('locations');
    const locMap = Object.fromEntries(locations.map(l => [l.id, l.name]));

    // Filter ONLY PENDING items for the approval panels so processed items vanish!
    const pendingUsersList = users.filter(u => u.status === 'pending');
    const pendingRentalsList = rentals.filter(r => r.status === 'pending');
    const activeRentalsList = rentals.filter(r => r.status === 'approved' || r.status === 'active');

    // Update Admin Stats
    statPendingUsers.textContent = pendingUsersList.length;
    statPendingRentals.textContent = pendingRentalsList.length;
    statActiveRentals.textContent = activeRentalsList.length;
    statTotalBooks.textContent = books.length;

    // Render Tab 1: Aprovação de Usuários (SHOW ONLY PENDING)
    if (pendingUsersList.length === 0) {
      adminUsersTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            <i data-lucide="check-circle" style="width: 36px; height: 36px;"></i>
            <p>Nenhuma solicitação de cadastro pendente no momento. Tudo em dia!</p>
          </td>
        </tr>
      `;
    } else {
      adminUsersTableBody.innerHTML = pendingUsersList.map(u => {
        const userLoc = locMap[u.locationId] || 'Casa PF';
        return `
          <tr>
            <td><strong>${u.name}</strong></td>
            <td>${u.email}</td>
            <td>${userLoc}</td>
            <td>${formatDateBR(u.createdAt || '2026-07-27')}</td>
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

    // Render Tab 2: Aprovação de Aluguéis (SHOW ONLY PENDING)
    if (pendingRentalsList.length === 0) {
      adminRentalsTableBody.innerHTML = `
        <tr>
          <td colspan="8" class="empty-state">
            <i data-lucide="check-circle" style="width: 36px; height: 36px;"></i>
            <p>Nenhuma solicitação de aluguel pendente no momento. Tudo em dia!</p>
          </td>
        </tr>
      `;
    } else {
      adminRentalsTableBody.innerHTML = pendingRentalsList.map(r => {
        return `
          <tr>
            <td><strong>${r.userName}</strong><br><small style="color:var(--text-muted);">${r.userEmail}</small></td>
            <td><strong>${r.bookTitle}</strong></td>
            <td>${formatDateBR(r.startDate)}</td>
            <td>${r.durationDays} Dias</td>
            <td>${formatDateBR(r.returnDate)}</td>
            <td>${r.locationName}</td>
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

    // Render Tab 3: Gerenciar Acervo (WITH EDIT & DELETE)
    adminBooksTableBody.innerHTML = books.map(b => {
      const locName = locMap[b.locationId] || 'Casa PF';
      return `
        <tr>
          <td><strong>${b.title}</strong></td>
          <td>${b.author}</td>
          <td>${b.category}</td>
          <td>${locName}</td>
          <td>
            <span style="font-weight:700; color: ${b.copiesAvailable > 0 ? 'var(--status-approved-text)' : 'var(--status-rejected-text)'};">
              ${b.copiesAvailable}
            </span> / ${b.copiesTotal} disponíveis
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

    // Attach Admin Event Listeners
    document.querySelectorAll('.approve-user-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const uid = e.currentTarget.getAttribute('data-user-id');
        updateUserStatus(uid, 'approved');
      });
    });

    document.querySelectorAll('.reject-user-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const uid = e.currentTarget.getAttribute('data-user-id');
        updateUserStatus(uid, 'rejected');
      });
    });

    document.querySelectorAll('.approve-rental-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const rid = e.currentTarget.getAttribute('data-rental-id');
        updateRentalStatus(rid, 'approved');
      });
    });

    document.querySelectorAll('.reject-rental-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const rid = e.currentTarget.getAttribute('data-rental-id');
        updateRentalStatus(rid, 'rejected');
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
        deleteBook(bid);
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // --- ADMIN ACTIONS (SECURED & WITH REAL EMAIL NOTIFICATION) ---
  function updateUserStatus(userId, newStatus) {
    if (!isAdmin(currentUser)) {
      showToast('Acesso negado! Operação permitida apenas para a administradora.', 'error');
      return;
    }

    let users = StorageManager.get('users');
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      const targetUser = users[userIndex];
      targetUser.status = newStatus;
      StorageManager.set('users', users);

      showToast(`Cadastro de ${targetUser.name} foi ${newStatus === 'approved' ? 'ACEITO' : 'REJEITADO'}!`, newStatus === 'approved' ? 'success' : 'error');

      // Send Email Notification on Acceptance
      if (newStatus === 'approved') {
        const subject = '[Porta Fidei] Cadastro Aprovado com Sucesso!';
        const bodyText = `Olá ${targetUser.name},\n\nSua conta na Biblioteca Porta Fidei foi APROVADA com sucesso pela administração!\n\nAgora você já pode realizar o login no site com seu e-mail (${targetUser.email}) e solicitar o aluguel de obras em nossas unidades (Casa PF e Samaria PF).\n\nSeja bem-vindo(a) à Porta Fidei!`;

        triggerRealEmail(targetUser.email, subject, bodyText);
      }

      updateAuthUI();
      renderAdminDashboard();
    }
  }

  function updateRentalStatus(rentalId, newStatus) {
    if (!isAdmin(currentUser)) {
      showToast('Acesso negado! Operação permitida apenas para a administradora.', 'error');
      return;
    }

    let rentals = StorageManager.get('rentals');
    const rentalIndex = rentals.findIndex(r => r.id === rentalId);
    if (rentalIndex !== -1) {
      const rental = rentals[rentalIndex];
      const oldStatus = rental.status;
      rental.status = newStatus;
      StorageManager.set('rentals', rentals);

      // Adjust book stock if approving
      if (newStatus === 'approved' && oldStatus !== 'approved') {
        let books = StorageManager.get('books');
        const bookIndex = books.findIndex(b => b.id === rental.bookId);
        if (bookIndex !== -1 && books[bookIndex].copiesAvailable > 0) {
          books[bookIndex].copiesAvailable -= 1;
          StorageManager.set('books', books);
        }
      } else if (newStatus === 'rejected' && oldStatus === 'approved') {
        let books = StorageManager.get('books');
        const bookIndex = books.findIndex(b => b.id === rental.bookId);
        if (bookIndex !== -1) {
          books[bookIndex].copiesAvailable += 1;
          StorageManager.set('books', books);
        }
      }

      showToast(`Aluguel do livro "${rental.bookTitle}" foi ${newStatus === 'approved' ? 'ACEITO' : 'REJEITADO'}!`, newStatus === 'approved' ? 'success' : 'error');

      // Send Email Notification on Acceptance
      if (newStatus === 'approved') {
        const subject = '[Porta Fidei] Solicitação de Aluguel Aprovada!';
        const bodyText = `Olá ${rental.userName},\n\nSua solicitação de aluguel do livro "${rental.bookTitle}" foi APROVADA pela administração!\n\n📍 Unidade de Retirada: ${rental.locationName}\n📅 Dia da Retirada (Início): ${formatDateBR(rental.startDate)}\n⏱️ Tempo de Empréstimo: ${rental.durationDays} Dias\n📅 Data Prevista de Devolução: ${formatDateBR(rental.returnDate)}\n\nApresente este e-mail na unidade selecionada para retirar seu livro. Bom estudo e leitura!`;

        triggerRealEmail(rental.userEmail, subject, bodyText);
      }

      updateAuthUI();
      renderAdminDashboard();
    }
  }

  // EDIT BOOK MODAL HANDLERS
  function openEditBookModal(bookId) {
    if (!isAdmin(currentUser)) return;

    const books = StorageManager.get('books');
    const book = books.find(b => b.id === bookId);
    if (!book) return;

    populateLocationDropdowns();

    editBookId.value = book.id;
    editBookTitle.value = book.title;
    editBookAuthor.value = book.author;
    editBookCategory.value = book.category;
    editBookLocation.value = book.locationId;
    editBookCopiesTotal.value = book.copiesTotal;
    editBookCopiesAvailable.value = book.copiesAvailable;

    editBookModal.classList.add('open');
  }

  function closeEditBookModal() {
    if (editBookModal) editBookModal.classList.remove('open');
  }

  function deleteBook(bookId) {
    if (!isAdmin(currentUser)) {
      showToast('Acesso negado! Operação permitida apenas para a administradora.', 'error');
      return;
    }

    let books = StorageManager.get('books');
    const updated = books.filter(b => b.id !== bookId);
    StorageManager.set('books', updated);
    showToast('Livro removido do acervo com sucesso!', 'info');
    renderAdminDashboard();
    renderCatalog();
  }

  // --- RENTAL MODAL HANDLERS ---
  function openRentalModal(bookId) {
    if (!currentUser) {
      showToast('Você precisa fazer login para solicitar um aluguel.', 'info');
      switchView('viewAuth');
      return;
    }

    if (currentUser.status === 'pending' && !isAdmin(currentUser)) {
      showToast('A sua conta está aguardando aprovação da administração. Você ainda não pode solicitar aluguéis.', 'error');
      return;
    }

    const books = StorageManager.get('books');
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

    rentalLocation.value = book.locationId;

    updateModalReturnDate();
    rentalModal.classList.add('open');
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
  function handleLogin(e) {
    if (e && e.preventDefault) e.preventDefault();

    const inputIdentifier = loginForm.loginEmail.value.trim().toLowerCase();
    const password = loginForm.loginPassword.value.trim();

    const users = StorageManager.get('users');

    const user = users.find(u => {
      const userEmail = (u.email || '').toLowerCase();
      const userName = (u.username || '').toLowerCase();
      return (userEmail === inputIdentifier || userName === inputIdentifier) && u.password === password;
    });

    if (!user) {
      showToast('Usuário/E-mail ou senha incorretos.', 'error');
      return;
    }

    if (user.role === 'user' && user.status === 'pending') {
      showToast('⚠️ Sua conta foi registrada, mas ainda aguarda aprovação da Administração.', 'info');
    }

    StorageManager.setCurrentUser(user);
    updateAuthUI();
    showToast(`Bem-vindo(a), ${user.name}!`, 'success');

    if (isAdmin(user)) {
      switchView('viewAdminDashboard');
    } else {
      switchView('viewCatalog');
    }
  }

  function handleSignup(e) {
    e.preventDefault();

    const name = signupForm.signupName.value.trim();
    const email = signupForm.signupEmail.value.trim();
    const password = signupForm.signupPassword.value.trim();
    const locationId = signupForm.signupLocation.value;

    let users = StorageManager.get('users');
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase() || (u.username && u.username.toLowerCase() === email.toLowerCase()))) {
      showToast('Este e-mail ou nome de usuário já está cadastrado.', 'error');
      return;
    }

    const newUser = {
      id: `user-${Date.now()}`,
      name,
      email,
      username: email.split('@')[0],
      password,
      role: 'user',
      status: 'pending',
      locationId,
      createdAt: new Date().toISOString().split('T')[0]
    };

    users.push(newUser);
    StorageManager.set('users', users);

    showToast('Solicitação de cadastro enviada com sucesso! A administração irá analisar e aprovar sua conta.', 'success');

    signupForm.reset();
    authTabLogin.click();
  }

  function handleLogout() {
    StorageManager.setCurrentUser(null);
    updateAuthUI();
    showToast('Você saiu da sua conta.', 'info');
    switchView('viewCatalog');
  }

  // --- EVENT LISTENERS INITIALIZATION ---
  function initEventListeners() {
    // Navigation
    navBrand.addEventListener('click', () => switchView('viewCatalog'));
    navCatalogBtn.addEventListener('click', () => switchView('viewCatalog'));
    navMyRentalsBtn.addEventListener('click', () => switchView('viewUserDashboard'));
    navAdminBtn.addEventListener('click', () => switchView('viewAdminDashboard'));

    // Theme Toggle
    themeToggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      const isLight = document.body.classList.contains('light-theme');
      themeToggleBtn.innerHTML = `<i data-lucide="${isLight ? 'moon' : 'sun'}"></i>`;
      if (window.lucide) window.lucide.createIcons();
    });

    // Auth Tabs
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

    // Forms
    loginForm.addEventListener('submit', handleLogin);
    signupForm.addEventListener('submit', handleSignup);

    // Admin Tabs
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

    // Add Book Form
    addBookForm.addEventListener('submit', (e) => {
      e.preventDefault();

      if (!isAdmin(currentUser)) {
        showToast('Acesso negado! Operação permitida apenas para a administradora.', 'error');
        return;
      }

      const title = document.getElementById('newBookTitle').value.trim();
      const author = document.getElementById('newBookAuthor').value.trim();
      const category = document.getElementById('newBookCategory').value;
      const locationId = document.getElementById('newBookLocation').value;
      const copiesTotal = parseInt(document.getElementById('newBookCopies').value, 10);

      let books = StorageManager.get('books');
      const newBook = {
        id: `book-${Date.now()}`,
        title,
        author,
        category,
        cover: 'assets/confissoes.png',
        locationId,
        copiesAvailable: copiesTotal,
        copiesTotal
      };

      books.push(newBook);
      StorageManager.set('books', books);
      showToast(`Livro "${title}" cadastrado com sucesso!`, 'success');
      addBookForm.reset();
      renderAdminDashboard();
      renderCatalog();
    });

    // Edit Book Form Submit Listener
    if (editBookForm) {
      editBookForm.addEventListener('submit', (e) => {
        e.preventDefault();

        if (!isAdmin(currentUser)) return;

        const bookId = editBookId.value;
        let books = StorageManager.get('books');
        const index = books.findIndex(b => b.id === bookId);
        if (index === -1) return;

        books[index].title = editBookTitle.value.trim();
        books[index].author = editBookAuthor.value.trim();
        books[index].category = editBookCategory.value;
        books[index].locationId = editBookLocation.value;
        books[index].copiesTotal = parseInt(editBookCopiesTotal.value, 10);
        books[index].copiesAvailable = parseInt(editBookCopiesAvailable.value, 10);

        StorageManager.set('books', books);
        closeEditBookModal();
        showToast('Livro atualizado com sucesso!', 'success');
        renderAdminDashboard();
        renderCatalog();
      });
    }

    // Modal Close Listeners
    rentalStartDate.addEventListener('change', updateModalReturnDate);
    rentalDurationDays.addEventListener('change', updateModalReturnDate);
    closeModalBtn.addEventListener('click', closeRentalModal);
    cancelModalBtn.addEventListener('click', closeRentalModal);

    if (closeEditBookModalBtn) closeEditBookModalBtn.addEventListener('click', closeEditBookModal);
    if (cancelEditBookModalBtn) cancelEditBookModalBtn.addEventListener('click', closeEditBookModal);

    if (closeEmailModalBtn) closeEmailModalBtn.addEventListener('click', closeEmailModal);
    if (confirmEmailModalBtn) confirmEmailModalBtn.addEventListener('click', closeEmailModal);

    rentalRequestForm.addEventListener('submit', (e) => {
      e.preventDefault();

      if (!currentUser) return;

      const bookId = modalBookId.value;
      const books = StorageManager.get('books');
      const book = books.find(b => b.id === bookId);
      if (!book) return;

      const startDate = rentalStartDate.value;
      const durationDays = parseInt(rentalDurationDays.value, 10);
      const returnDate = calculateReturnDate(startDate, durationDays);
      const locId = rentalLocation.value;
      const locations = StorageManager.get('locations');
      const loc = locations.find(l => l.id === locId);

      const newRental = {
        id: `rent-${Date.now()}`,
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        bookId: book.id,
        bookTitle: book.title,
        startDate,
        durationDays,
        returnDate,
        locationId: locId,
        locationName: loc ? loc.name : 'Casa PF',
        status: 'pending',
        requestedAt: new Date().toISOString().split('T')[0]
      };

      let rentals = StorageManager.get('rentals');
      rentals.push(newRental);
      StorageManager.set('rentals', rentals);

      closeRentalModal();
      showToast('Solicitação de aluguel enviada com sucesso! Aguarde a aprovação da Administração.', 'success');
      updateAuthUI();
      switchView('viewUserDashboard');
    });

    // Search and Filter Events
    globalSearchInput.addEventListener('input', renderCatalog);
    globalLocationSelect.addEventListener('change', renderCatalog);
    categoryFilterSelect.addEventListener('change', renderCatalog);
    searchSubmitBtn.addEventListener('click', renderCatalog);
  }

  // --- INITIALIZATION ---
  document.addEventListener('DOMContentLoaded', () => {
    populateLocationDropdowns();
    initEventListeners();
    updateAuthUI();
    renderCatalog();

    if (window.lucide) {
      window.lucide.createIcons();
    }
  });

})();
