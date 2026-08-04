/* ==========================================================================
   PORTA FIDEI - SUPABASE DATABASE CONNECTOR & REPOSITORY
   Versão refatorada: Admin-only, gerenciamento direto de catálogo e aluguéis
   ========================================================================== */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_KEY são obrigatórios no .env');
  process.exit(1);
}

// Cliente "anon": usado para autenticação (signInWithPassword, verificação de token)
const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cliente "service_role": ignora RLS, usado para todas as consultas às tabelas.
// NUNCA expor no frontend.
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('✅ Conectado ao Supabase (Admin-Only Mode)');

const Repository = {
  // --------------------------------------------------------------------
  // AUTH (Admin-Only)
  // --------------------------------------------------------------------

  async verifyToken(token) {
    const { data, error } = await supabaseAuth.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user;
  },

  async loginAdmin({ email, password }) {
    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });

    if (error) {
      throw new Error('E-mail ou senha incorretos.');
    }

    // Buscar perfil na tabela profiles para verificar se é admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      throw new Error('Acesso restrito: apenas a conta de administração pode acessar o sistema.');
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      profile
    };
  },

  async getProfile(userId) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) return null;
    return data;
  },

  // --------------------------------------------------------------------
  // LOCATIONS
  // --------------------------------------------------------------------
  async getLocations() {
    const { data, error } = await supabaseAdmin.from('locations').select('*');
    if (error) throw error;
    return data;
  },

  // --------------------------------------------------------------------
  // BOOKS
  // --------------------------------------------------------------------
  async getBooks({ search, location_id, category, author } = {}) {
    let query = supabaseAdmin.from('books').select('*');
    if (location_id && location_id !== 'ALL') query = query.eq('location_id', location_id);
    if (category && category !== 'ALL') query = query.eq('category', category);

    const { data, error } = await query.order('title', { ascending: true });
    if (error) throw error;

    let filtered = data;

    // Filtro por autor (case-insensitive partial match)
    if (author && author.trim() !== '' && author !== 'ALL') {
      const a = author.toLowerCase();
      filtered = filtered.filter(b => b.author.toLowerCase().includes(a));
    }

    // Filtro por busca textual (título ou autor)
    if (search && search.trim() !== '') {
      const s = search.toLowerCase();
      filtered = filtered.filter(b =>
        b.title.toLowerCase().includes(s) || b.author.toLowerCase().includes(s)
      );
    }

    // Garantir que cada livro apareça unicamente uma vez no catálogo
    const seen = new Set();
    const uniqueBooks = [];
    for (const book of filtered) {
      const key = `${book.title.trim().toLowerCase()}|${book.location_id || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueBooks.push(book);
      }
    }

    return uniqueBooks;
  },

  async getBookById(id) {
    const { data, error } = await supabaseAdmin.from('books').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },

  // Verifica se existe livro com o mesmo título (para aviso de duplicata)
  async checkDuplicateBookTitle(title) {
    const { data, error } = await supabaseAdmin
      .from('books')
      .select('id, title, author, location_id')
      .ilike('title', title.trim());

    if (error) return [];
    return data || [];
  },

  async createBook({ title, author, category, cover, location_id, copies_total }) {
    const copies = parseInt(copies_total, 10) || 1;
    const { data, error } = await supabaseAdmin.from('books').insert([{
      title: title.trim(),
      author: author.trim(),
      category,
      cover: cover || 'assets/confissoes.png',
      location_id: location_id || 'loc-1',
      copies_available: copies,
      copies_total: copies
    }]).select('*').single();
    if (error) throw error;
    return data;
  },

  async updateBook(id, fields) {
    const { data, error } = await supabaseAdmin
      .from('books')
      .update(fields)
      .eq('id', id)
      .select('*')
      .single();
    if (error) return null;
    return data;
  },

  async deleteBook(id) {
    const { error } = await supabaseAdmin.from('books').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // Retorna lista de autores únicos para o filtro
  async getDistinctAuthors() {
    const { data, error } = await supabaseAdmin.from('books').select('author');
    if (error) throw error;

    const unique = [...new Set((data || []).map(b => b.author))].sort();
    return unique;
  },

  // Helper para persistência local de metadados de aluguéis (fallback quando Supabase não tem as colunas)
  getRentalMeta() {
    try {
      const metaPath = path.join(__dirname, 'rentals_meta.json');
      if (fs.existsSync(metaPath)) {
        return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      }
    } catch {}
    return {};
  },

  saveRentalMeta(id, meta) {
    try {
      const metaPath = path.join(__dirname, 'rentals_meta.json');
      const data = this.getRentalMeta();
      data[id] = { ...data[id], ...meta };
      fs.writeFileSync(metaPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('Erro ao salvar metadados do aluguel:', err);
    }
  },

  // --------------------------------------------------------------------
  // RENTALS (Admin registra diretamente)
  // --------------------------------------------------------------------
  async getRentals({ status, book_id } = {}) {
    let query = supabaseAdmin.from('rentals').select('*, books(title, author), profiles(name, username)');
    if (status && status !== 'ALL') query = query.eq('status', status);
    if (book_id) query = query.eq('book_id', book_id);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    const meta = this.getRentalMeta();
    return (data || []).map(r => ({
      ...r,
      renter_name: r.renter_name || meta[r.id]?.renter_name || r.profiles?.name || 'Locatário',
      renter_contact: r.renter_contact || meta[r.id]?.renter_contact || '-'
    }));
  },

  async createRental({ book_id, renter_name, renter_contact, start_date, duration_days, location_id }) {
    // Buscar livro e validar disponibilidade
    const book = await this.getBookById(book_id);
    if (!book) throw new Error('Livro não encontrado.');
    if (book.copies_available <= 0) throw new Error('Não há exemplares disponíveis deste livro para aluguel.');

    // Calcular data de devolução
    const d = new Date(start_date + 'T00:00:00');
    d.setDate(d.getDate() + parseInt(duration_days, 10));
    const return_date = d.toISOString().split('T')[0];

    let insertedData = null;

    // Tenta primeiro o schema novo (com renter_name e renter_contact)
    try {
      const { data, error } = await supabaseAdmin
        .from('rentals')
        .insert([{
          book_id,
          renter_name: renter_name.trim(),
          renter_contact: (renter_contact || '').trim(),
          start_date,
          duration_days: parseInt(duration_days, 10),
          return_date,
          location_id: location_id || book.location_id,
          status: 'active'
        }])
        .select('*, books(title, author)')
        .single();

      if (error) throw error;
      insertedData = data;
    } catch (err) {
      // Se der erro de coluna não encontrada (schema antigo com user_id), usar fallback
      if (err.code === 'PGRST204' || err.message?.includes('schema cache')) {
        const { data: profiles } = await supabaseAdmin.from('profiles').select('id').limit(1);
        const fallbackUserId = profiles?.[0]?.id || null;

        const { data: fallbackData, error: fallbackError } = await supabaseAdmin
          .from('rentals')
          .insert([{
            book_id,
            user_id: fallbackUserId,
            start_date,
            duration_days: parseInt(duration_days, 10),
            return_date,
            location_id: location_id || book.location_id,
            status: 'active'
          }])
          .select('*, books(title, author)')
          .single();

        if (fallbackError) throw fallbackError;

        this.saveRentalMeta(fallbackData.id, {
          renter_name: renter_name.trim(),
          renter_contact: (renter_contact || '').trim()
        });

        insertedData = {
          ...fallbackData,
          renter_name: renter_name.trim(),
          renter_contact: (renter_contact || '').trim()
        };
      } else {
        throw err;
      }
    }

    // Decrementar exemplares disponíveis
    await supabaseAdmin
      .from('books')
      .update({ copies_available: book.copies_available - 1 })
      .eq('id', book_id);

    return insertedData;
  },

  async returnRental(rentalId) {
    // Buscar aluguel
    const { data: rental, error: findError } = await supabaseAdmin
      .from('rentals')
      .select('*')
      .eq('id', rentalId)
      .single();

    if (findError || !rental) throw new Error('Aluguel não encontrado.');
    if (rental.status === 'returned') throw new Error('Este aluguel já foi devolvido.');

    const today = new Date().toISOString().split('T')[0];
    let updated = null;

    try {
      const { data, error } = await supabaseAdmin
        .from('rentals')
        .update({
          status: 'returned',
          actual_return_date: today
        })
        .eq('id', rentalId)
        .select('*, books(title, author)')
        .single();

      if (error) throw error;
      updated = data;
    } catch (err) {
      if (err.code === 'PGRST204' || err.message?.includes('schema cache')) {
        const { data: fallbackData, error: fallbackError } = await supabaseAdmin
          .from('rentals')
          .update({ status: 'returned' })
          .eq('id', rentalId)
          .select('*, books(title, author)')
          .single();

        if (fallbackError) throw fallbackError;
        updated = fallbackData;
      } else {
        throw err;
      }
    }

    // Incrementar exemplares disponíveis (sem exceder copies_total)
    const book = await this.getBookById(rental.book_id);
    if (book) {
      const newAvailable = Math.min(book.copies_available + 1, book.copies_total);
      await supabaseAdmin
        .from('books')
        .update({ copies_available: newAvailable })
        .eq('id', rental.book_id);
    }

    return updated;
  },

  // --------------------------------------------------------------------
  // STATS (Admin Dashboard)
  // --------------------------------------------------------------------
  async getAdminStats() {
    const { data: books } = await supabaseAdmin.from('books').select('copies_available, copies_total');
    const { data: activeRentals } = await supabaseAdmin.from('rentals').select('id').eq('status', 'active');
    const { data: overdueRentals } = await supabaseAdmin.from('rentals').select('id').eq('status', 'overdue');
    const { data: returnedRentals } = await supabaseAdmin.from('rentals').select('id').eq('status', 'returned');

    const totalBooks = (books || []).length;
    const totalCopies = (books || []).reduce((sum, b) => sum + b.copies_total, 0);
    const unavailableBooks = (books || []).filter(b => b.copies_available <= 0).length;

    return {
      totalBooks,
      totalCopies,
      unavailableBooks,
      activeRentalsCount: (activeRentals || []).length,
      overdueRentalsCount: (overdueRentals || []).length,
      returnedRentalsCount: (returnedRentals || []).length
    };
  }
};

module.exports = Repository;