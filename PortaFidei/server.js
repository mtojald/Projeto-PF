/* ==========================================================================
   PORTA FIDEI - NODE.JS EXPRESS REST API SERVER
   Versão refatorada: Admin-only, gerenciamento direto de catálogo e aluguéis
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

// --- SECURITY MIDDLEWARES ---
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Acesso não autorizado. Faça login.' });

  const authUser = await db.verifyToken(token);
  if (!authUser) return res.status(403).json({ error: 'Sessão expirada ou token inválido.' });

  const profile = await db.getProfile(authUser.id);
  if (!profile) return res.status(403).json({ error: 'Perfil não encontrado.' });

  // Apenas admin pode acessar
  const identifier = (profile.username || profile.email || '').toLowerCase();
  const isAdminUser = profile.role === 'admin' && (identifier === 'cacaia' || identifier === 'cacaia@portafidei.com');

  if (!isAdminUser) {
    return res.status(403).json({ error: 'Acesso restrito: Apenas a administradora possui permissão.' });
  }

  req.user = { id: authUser.id, email: authUser.email, ...profile };
  next();
}

// --- API ENDPOINTS ---

// 1. AUTH: Login (admin-only)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Informe o e-mail e a senha.' });
    }

    const { access_token, refresh_token, profile } = await db.loginAdmin({
      email: email.trim().toLowerCase(),
      password: password.trim()
    });

    res.json({
      token: access_token,
      refresh_token,
      user: profile
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'E-mail ou senha incorretos.' });
  }
});

// 2. LOCATIONS (público — catálogo visível para todos)
app.get('/api/locations', async (req, res) => {
  try {
    const locations = await db.getLocations();
    res.json(locations);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar unidades.' });
  }
});

// 3. BOOKS: Get Catalog (público — catálogo visível para todos)
app.get('/api/books', async (req, res) => {
  try {
    const { search, location_id, category, author } = req.query;
    const books = await db.getBooks({ search, location_id, category, author });
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar livros.' });
  }
});

// 4. BOOKS: Get distinct authors (público — filtro do catálogo)
app.get('/api/books/authors', async (req, res) => {
  try {
    const authors = await db.getDistinctAuthors();
    res.json(authors);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar autores.' });
  }
});

// 5. BOOKS: Check duplicate title
app.get('/api/books/check-duplicate', authenticateToken, async (req, res) => {
  try {
    const { title } = req.query;
    if (!title) return res.json({ duplicates: [] });

    const duplicates = await db.checkDuplicateBookTitle(title);
    res.json({ duplicates });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao verificar duplicatas.' });
  }
});

// 6. BOOKS: Add Book
app.post('/api/books', authenticateToken, async (req, res) => {
  try {
    const { title, author, category, cover, location_id, copies_total } = req.body;
    if (!title || !author) return res.status(400).json({ error: 'Título e Autor são obrigatórios.' });

    // Verificar duplicata e avisar (mas permite cadastrar)
    const duplicates = await db.checkDuplicateBookTitle(title);
    const newBook = await db.createBook({ title, author, category, cover, location_id, copies_total });

    res.status(201).json({
      book: newBook,
      warning: duplicates.length > 0
        ? `⚠️ Atenção: Já existe(m) ${duplicates.length} livro(s) com título igual ou similar: ${duplicates.map(d => `"${d.title}" por ${d.author}`).join(', ')}`
        : null
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao cadastrar livro.' });
  }
});

// 7. BOOKS: Update Book
app.put('/api/books/:id', authenticateToken, async (req, res) => {
  try {
    const updated = await db.updateBook(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Livro não encontrado.' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar livro.' });
  }
});

// 8. BOOKS: Delete Book
app.delete('/api/books/:id', authenticateToken, async (req, res) => {
  try {
    await db.deleteBook(req.params.id);
    res.json({ success: true, message: 'Livro excluído com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir livro.' });
  }
});

// 9. RENTALS: List all (com filtros)
app.get('/api/rentals', authenticateToken, async (req, res) => {
  try {
    const { status, book_id } = req.query;
    const locations = await db.getLocations();
    const locMap = Object.fromEntries(locations.map(l => [l.id, l.name]));

    const rentals = await db.getRentals({ status, book_id });
    const enriched = rentals.map(r => ({
      ...r,
      book_title: r.books?.title || '',
      book_author: r.books?.author || '',
      location_name: locMap[r.location_id] || r.location_id
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar aluguéis.' });
  }
});

// 10. RENTALS: Create (admin registra diretamente, com decremento)
app.post('/api/rentals', authenticateToken, async (req, res) => {
  try {
    const { book_id, renter_name, renter_contact, start_date, duration_days, location_id } = req.body;

    if (!book_id || !renter_name || !start_date) {
      return res.status(400).json({ error: 'Livro, nome do locatário e data de início são obrigatórios.' });
    }

    const newRental = await db.createRental({
      book_id,
      renter_name,
      renter_contact,
      start_date,
      duration_days: duration_days || 14,
      location_id
    });

    res.status(201).json(newRental);
  } catch (err) {
    console.error('Erro no aluguel:', err.message);
    res.status(400).json({ error: err.message || 'Erro ao registrar aluguel.' });
  }
});

// 11. RENTALS: Return (devolução, com incremento)
app.patch('/api/rentals/:id/return', authenticateToken, async (req, res) => {
  try {
    const returned = await db.returnRental(req.params.id);
    res.json({
      message: `Livro "${returned.books?.title || ''}" devolvido com sucesso!`,
      rental: returned
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Erro ao registrar devolução.' });
  }
});

// 12. ADMIN: Stats & Dashboard
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await db.getAdminStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
  }
});

// Serve Single Page Application (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Servidor Porta Fidei rodando em http://localhost:${PORT}`);
  console.log(`📚 Modo: Biblioteca Porta Fidei (Catálogo Público + Admin)`);
  console.log(`=======================================================`);
});