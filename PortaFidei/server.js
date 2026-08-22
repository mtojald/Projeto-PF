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
    const { email, username, password } = req.body;
    const identifier = (email || username || '').trim();

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Informe o e-mail/usuário e a senha.' });
    }

    const { access_token, refresh_token, profile } = await db.loginAdmin({
      identifier,
      password: password.trim()
    });

    res.json({
      token: access_token,
      refresh_token,
      user: profile
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Usuário/E-mail ou senha incorretos.' });
  }
});

// 2. LOCATIONS (público — catálogo visível para todos)
app.get('/api/locations', async (req, res) => {
  try {
    const locations = await db.getLocations();
    res.json(locations);
  } catch (err) {
    console.error('Erro ao buscar unidades no Supabase:', err.message);
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
    console.error('Erro ao buscar livros no Supabase:', err.message);
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

// 4.5. BOOKS: Get distinct categories (público — filtro e formulários)
app.get('/api/books/categories', async (req, res) => {
  try {
    const categories = await db.getDistinctCategories();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar categorias.' });
  }
});

// 4.6. REVIEWS: leitura pública
app.get('/api/reviews', async (req, res) => {
  try {
    const reviews = await db.getReviews();
    res.json(reviews);
  } catch (err) {
    console.error('Erro ao buscar reviews no Supabase:', err.message);
    res.status(500).json({ error: 'Erro ao buscar reviews.' });
  }
});

// 4.7. REVIEWS: validar duplicidade por nome (admin-only)
app.get('/api/reviews/check-duplicate', authenticateToken, async (req, res) => {
  try {
    const { book_title, exclude_id } = req.query;
    if (!book_title?.trim()) return res.json({ duplicate: false, review: null });

    const review = await db.findReviewByBookTitle(book_title, exclude_id);
    res.json({ duplicate: Boolean(review), review });
  } catch (err) {
    console.error('Erro ao verificar duplicidade da review:', err.message);
    res.status(500).json({ error: 'Erro ao verificar duplicidade da review.' });
  }
});

// 4.8. REVIEWS: publicar (admin-only)
app.post('/api/reviews', authenticateToken, async (req, res) => {
  try {
    const { book_title, author, rating, opinion, is_pinned } = req.body;
    const review = await db.createReview({
      book_title,
      author,
      rating,
      opinion,
      is_pinned,
      created_by: req.user?.id || null
    });

    res.status(201).json(review);
  } catch (err) {
    console.error('Erro ao publicar review:', err.message);
    const status = err.message?.includes('Já existe') ? 409 : 400;
    res.status(status).json({ error: err.message || 'Erro ao publicar review.' });
  }
});

// 4.9. REVIEWS: editar (admin-only)
app.put('/api/reviews/:id', authenticateToken, async (req, res) => {
  try {
    const { book_title, author, rating, opinion, is_pinned } = req.body;
    const review = await db.updateReview(req.params.id, {
      book_title,
      author,
      rating,
      opinion,
      is_pinned
    });

    res.json(review);
  } catch (err) {
    console.error('Erro ao atualizar review:', err.message);
    const status = err.message?.includes('Já existe') ? 409 : 400;
    res.status(status).json({ error: err.message || 'Erro ao atualizar review.' });
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

// 8.5. BOOKS: Import Multiple Books (XLSX / CSV)
app.post('/api/books/import', authenticateToken, async (req, res) => {
  try {
    const { books } = req.body;
    if (!Array.isArray(books) || books.length === 0) {
      return res.status(400).json({ error: 'Nenhum livro válido encontrado para importação.' });
    }

    const locations = await db.getLocations();
    const locMap = {};
    locations.forEach(l => {
      locMap[l.name.toLowerCase().trim()] = l.id;
      locMap[l.id.toLowerCase().trim()] = l.id;
    });

    let importedCount = 0;

    for (let item of books) {
      let title = '', author = '', category = 'Espiritualidade', rawLoc = '', copies = 1, cover = 'assets/confissoes.png';

      if (typeof item === 'object' && item !== null) {
        const values = Object.values(item);

        // Caso 1: Objeto de coluna única com valores separados por pipe (ex: "O Castelo Interior | Santa Teresa | ... | http://...")
        if (values.length === 1 && typeof values[0] === 'string' && values[0].includes('|')) {
          const parts = values[0].split('|').map(s => s.trim());
          title = parts[0] || '';
          author = parts[1] || '';
          category = parts[2] || 'Espiritualidade';
          rawLoc = parts[3] || '';
          copies = parseInt(parts[4] || 1, 10) || 1;
          if (parts[5]) cover = parts[5];
        } else if (typeof item[Object.keys(item)[0]] === 'string' && Object.keys(item)[0].includes('|')) {
          // Caso 2: Header único com nome "titulo|autor|..."
          const pipeHeaderKey = Object.keys(item)[0];
          const pipeValKey = item[pipeHeaderKey];
          const parts = pipeValKey.toString().split('|').map(s => s.trim());
          title = parts[0] || '';
          author = parts[1] || '';
          category = parts[2] || 'Espiritualidade';
          rawLoc = parts[3] || '';
          copies = parseInt(parts[4] || 1, 10) || 1;
          if (parts[5]) cover = parts[5];
        } else {
          // Caso 3: Colunas Excel normais (titulo, autor, categoria, unidade, exemplares, capa/imagem/cover)
          title = (item.titulo || item.title || item.Título || item['TÍTULO'] || '').toString().trim();
          author = (item.autor || item.author || item.Autor || item['AUTOR'] || '').toString().trim();
          category = (item.categoria || item.category || item.Categoria || item['CATEGORIA'] || 'Espiritualidade').toString().trim();
          rawLoc = (item.unidade || item.location || item.Unidade || item.location_id || item['UNIDADE'] || '').toString().trim();
          copies = parseInt(item.exemplares || item.copies || item.Exemplares || item.copies_total || item['EXEMPLARES'] || 1, 10) || 1;
          cover = (item.capa || item.cover || item.imagem || item.url || item.url_imagem || item.Capa || item.Imagem || item['CAPA'] || item['IMAGEM'] || item['COVER'] || 'assets/confissoes.png').toString().trim() || 'assets/confissoes.png';
        }
      }

      if (!title || !author) continue;

      let location_id = locMap[rawLoc.toLowerCase()] || locations[0]?.id || 'loc-1';

      await db.createBook({
        title,
        author,
        category,
        cover,
        location_id,
        copies_total: copies
      });
      importedCount++;
    }

    res.json({ success: true, count: importedCount });
  } catch (err) {
    console.error('Erro na importação:', err);
    res.status(500).json({ error: 'Erro ao importar acervo.' });
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
    const { book_id, copy_id, renter_name, renter_contact, start_date, duration_days, location_id } = req.body;

    if (!book_id || !copy_id || !renter_name || !start_date) {
      return res.status(400).json({ error: 'Livro, ID do exemplar, nome do locatário e data de início são obrigatórios.' });
    }

    const newRental = await db.createRental({
      book_id,
      copy_id,
      renter_name,
      renter_contact,
      start_date,
      duration_days: duration_days || 14,
      location_id
    });

    res.status(201).json(newRental);
  } catch (err) {
    console.error('Erro no aluguel:', err.message);
    const status = err.code === 'COPY_ALREADY_RENTED' ? 409 : 400;
    res.status(status).json({ error: err.message || 'Erro ao registrar aluguel.' });
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
