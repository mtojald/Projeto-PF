/* ==========================================================================
   PORTA FIDEI - NODE.JS EXPRESS REST API SERVER
   Versão migrada: autenticação via Supabase Auth (sem JWT/bcrypt próprios)
   ========================================================================== */

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:8080'
}));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// --- HELPER: remove campos internos antes de responder ---
function sanitizeProfile(profile) {
  if (!profile) return profile;
  const { ...safe } = profile; // profiles não tem password_hash, mas mantemos o padrão
  return safe;
}

function enrichRental(r, locMap) {
  return {
    ...r,
    book_title: r.books?.title,
    user_name: r.profiles?.name,
    user_email: r.profiles?.email,
    location_name: locMap[r.location_id] || r.location_id
  };
}

// --- SECURITY MIDDLEWARES ---
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Acesso não autorizado. Faça login.' });

  const authUser = await db.verifyToken(token);
  if (!authUser) return res.status(403).json({ error: 'Sessão expirada ou token inválido.' });

  const profile = await db.getProfile(authUser.id);
  if (!profile) return res.status(403).json({ error: 'Perfil não encontrado.' });

  req.user = { id: authUser.id, email: authUser.email, ...profile };
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Acesso não autorizado.' });

  const identifier = (req.user.username || req.user.email || '').toLowerCase();
  const isAdminUser = req.user.role === 'admin' && (identifier === 'cacaia' || identifier === 'cacaia@portafidei.com');

  if (!isAdminUser) {
    return res.status(403).json({ error: 'Acesso restrito: Apenas a administradora possui permissão.' });
  }

  next();
}

// --- API ENDPOINTS ---

// 1. PUBLIC: Get Locations
app.get('/api/locations', async (req, res) => {
  try {
    const locations = await db.getLocations();
    res.json(locations);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar unidades.' });
  }
});

// 2. AUTH: Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, location_id } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const username = cleanEmail.split('@')[0];

    if (cleanEmail === 'cacaia' || name.toLowerCase() === 'cacaia') {
      return res.status(400).json({ error: 'Nome de usuário reservado para a administração.' });
    }

    const profile = await db.registerUser({
      name: name.trim(),
      username,
      email: cleanEmail,
      password: password.trim(),
      location_id: location_id || 'loc-1'
    });

    res.status(201).json({
      message: 'Solicitação de cadastro enviada com sucesso! Aguarde a aprovação da administração.',
      user: sanitizeProfile(profile)
    });
  } catch (err) {
    console.error('Erro no registro:', err.message);
    res.status(400).json({ error: err.message || 'Erro interno ao realizar cadastro.' });
  }
});

// 3. AUTH: Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Informe o e-mail e a senha.' });
    }

    // Supabase Auth loga por e-mail. Se o usuário digitou um username, o front
    // pode ajustar para sempre enviar e-mail — aqui tratamos identifier como e-mail.
    const { access_token, refresh_token, profile } = await db.loginUser({
      email: identifier.trim().toLowerCase(),
      password: password.trim()
    });

    res.json({
      token: access_token,
      refresh_token,
      user: sanitizeProfile(profile)
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Usuário/E-mail ou senha incorretos.' });
  }
});

// 4. AUTH: Get Current User Me
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  res.json({ user: sanitizeProfile(req.user) });
});

// 5. BOOKS: Get Catalog
app.get('/api/books', async (req, res) => {
  try {
    const { search, location_id, category } = req.query;
    const books = await db.getBooks({ search, location_id, category });
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar livros.' });
  }
});

// 6. BOOKS (ADMIN): Add Book
app.post('/api/books', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, author, category, cover, location_id, copies_total } = req.body;
    if (!title || !author) return res.status(400).json({ error: 'Título e Autor são obrigatórios.' });

    const newBook = await db.createBook({ title, author, category, cover, location_id, copies_total });
    res.status(201).json(newBook);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao cadastrar livro.' });
  }
});

// 7. BOOKS (ADMIN): Update Book
app.put('/api/books/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const updated = await db.updateBook(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Livro não encontrado.' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar livro.' });
  }
});

// 8. BOOKS (ADMIN): Delete Book
app.delete('/api/books/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.deleteBook(req.params.id);
    res.json({ success: true, message: 'Livro excluído com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir livro.' });
  }
});

// 9. RENTALS: Create Rental Request
app.post('/api/rentals', authenticateToken, async (req, res) => {
  try {
    const { book_id, start_date, duration_days, location_id } = req.body;

    if (req.user.status !== 'approved' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Sua conta ainda aguarda aprovação da administração.' });
    }

    const book = await db.getBookById(book_id);
    if (!book || book.copies_available <= 0) {
      return res.status(400).json({ error: 'Livro indisponível para aluguel no momento.' });
    }

    const d = new Date(start_date + 'T00:00:00');
    d.setDate(d.getDate() + parseInt(duration_days, 10));
    const return_date = d.toISOString().split('T')[0];

    const rentalData = {
      user_id: req.user.id,
      book_id: book.id,
      start_date,
      duration_days: parseInt(duration_days, 10),
      return_date,
      location_id: location_id || book.location_id,
      status: 'pending'
    };

    const newRental = await db.createRental(rentalData);
    res.status(201).json(newRental);
  } catch (err) {
    console.error('Erro no aluguel:', err.message);
    res.status(500).json({ error: 'Erro ao criar solicitação de aluguel.' });
  }
});

// 10. RENTALS: My Rentals
app.get('/api/rentals/my', authenticateToken, async (req, res) => {
  try {
    const locations = await db.getLocations();
    const locMap = Object.fromEntries(locations.map(l => [l.id, l.name]));
    const rentals = await db.getRentals({ userId: req.user.id });
    res.json(rentals.map(r => enrichRental(r, locMap)));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar aluguéis.' });
  }
});

// 11. ADMIN: Stats & Dashboard
app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pendingUsers = await db.getProfiles('pending');
    const pendingRentals = await db.getRentals({ status: 'pending' });
    const activeRentals = await db.getRentals({ status: 'approved' });
    const books = await db.getBooks();

    res.json({
      pendingUsersCount: pendingUsers.length,
      pendingRentalsCount: pendingRentals.length,
      activeRentalsCount: activeRentals.length,
      totalBooksCount: books.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
  }
});

// 12. ADMIN: Pending Users
app.get('/api/admin/users/pending', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pendingUsers = await db.getProfiles('pending');
    res.json(pendingUsers.map(sanitizeProfile));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar usuários pendentes.' });
  }
});

// 13. ADMIN: Approve / Reject User
app.patch('/api/admin/users/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await db.updateProfileStatus(req.params.id, status);
    if (!updated) return res.status(404).json({ error: 'Usuário não encontrado.' });

    res.json({
      message: `Usuário ${updated.name} foi ${status === 'approved' ? 'ACEITO' : 'REJEITADO'}!`,
      user: sanitizeProfile(updated)
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar status do usuário.' });
  }
});

// 14. ADMIN: Pending Rentals
app.get('/api/admin/rentals/pending', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const locations = await db.getLocations();
    const locMap = Object.fromEntries(locations.map(l => [l.id, l.name]));
    const pendingRentals = await db.getRentals({ status: 'pending' });
    res.json(pendingRentals.map(r => enrichRental(r, locMap)));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar aluguéis pendentes.' });
  }
});

// 15. ADMIN: Approve / Reject Rental
app.patch('/api/admin/rentals/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await db.updateRentalStatus(req.params.id, status);
    if (!updated) return res.status(404).json({ error: 'Solicitação de aluguel não encontrada.' });

    const book = await db.getBookById(updated.book_id);

    res.json({
      message: `Aluguel do livro "${book?.title || ''}" foi ${status === 'approved' ? 'ACEITO' : 'REJEITADO'}!`,
      rental: updated
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar status do aluguel.' });
  }
});

// Serve Single Page Application (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Servidor Porta Fidei Node.js rodando em http://localhost:${PORT}`);
  console.log(`🔒 Autenticação: Supabase Auth nativo`);
  console.log(`=======================================================`);
});