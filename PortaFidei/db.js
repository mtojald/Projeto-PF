/* ==========================================================================
   PORTA FIDEI - SUPABASE DATABASE CONNECTOR & REPOSITORY
   Versão migrada: usa Supabase Auth nativo (auth.users + profiles)
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

// Cliente "anon": só para operações de autenticação (signUp, signInWithPassword,
// verificação de token). Nunca usado para consultar tabelas diretamente.
const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cliente "service_role": ignora RLS. Usado para TODAS as consultas às tabelas
// (profiles, books, rentals), porque a autorização já é garantida no server.js
// (authenticateToken + requireAdmin + checagens de dono). NUNCA exponha esta
// chave no frontend — ela só pode existir aqui, no backend.
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('✅ Conectado ao Supabase (Auth nativo + service_role para dados)');

const Repository = {
  isSupabaseActive() {
    return true;
  },

  // --------------------------------------------------------------------
  // AUTH
  // --------------------------------------------------------------------

  // Verifica um access_token do Supabase e retorna o usuário autenticado (ou null)
  async verifyToken(token) {
    const { data, error } = await supabaseAuth.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user; // { id, email, ... }
  },

  async registerUser({ name, username, email, password, location_id }) {
    const { data, error } = await supabaseAuth.auth.signUp({
      email,
      password,
      options: {
        data: { name, username }
      }
    });

    if (error) {
      throw new Error(error.message === 'User already registered'
        ? 'Este e-mail já está cadastrado.'
        : error.message);
    }

    // O trigger on_auth_user_created já criou a linha em profiles com name/username.
    // Só falta gravar a location_id escolhida no cadastro.
    if (data.user && location_id) {
      await supabaseAdmin
        .from('profiles')
        .update({ location_id })
        .eq('id', data.user.id);
    }

    return this.getProfile(data.user.id);
  },

  async loginUser({ email, password }) {
    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });

    if (error) {
      throw new Error('Usuário/E-mail ou senha incorretos.');
    }

    const profile = await this.getProfile(data.user.id);

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
  // PROFILES (usuários)
  // --------------------------------------------------------------------
  async getProfiles(statusFilter = null) {
    let query = supabaseAdmin.from('profiles').select('*');
    if (statusFilter) query = query.eq('status', statusFilter);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async updateProfileStatus(userId, status) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ status })
      .eq('id', userId)
      .select('*')
      .single();
    if (error) return null;
    return data;
  },

  // --------------------------------------------------------------------
  // BOOKS
  // --------------------------------------------------------------------
  async getBooks({ search, location_id, category } = {}) {
    let query = supabaseAdmin.from('books').select('*');
    if (location_id && location_id !== 'ALL') query = query.eq('location_id', location_id);
    if (category && category !== 'ALL') query = query.eq('category', category);

    const { data, error } = await query;
    if (error) throw error;

    if (search) {
      const s = search.toLowerCase();
      return data.filter(b => b.title.toLowerCase().includes(s) || b.author.toLowerCase().includes(s));
    }
    return data;
  },

  async getBookById(id) {
    const { data, error } = await supabaseAdmin.from('books').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },

  async createBook({ title, author, category, cover, location_id, copies_total }) {
    const copies = parseInt(copies_total, 10) || 1;
    const { data, error } = await supabaseAdmin.from('books').insert([{
      title,
      author,
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

  // --------------------------------------------------------------------
  // RENTALS
  // --------------------------------------------------------------------
  async getRentals({ userId, status } = {}) {
    let query = supabaseAdmin.from('rentals').select('*, books(title), profiles(name, email)');
    if (userId) query = query.eq('user_id', userId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async createRental(rentalData) {
    const { data, error } = await supabaseAdmin
      .from('rentals')
      .insert([rentalData])
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updateRentalStatus(rentalId, status) {
    const { data, error } = await supabaseAdmin
      .from('rentals')
      .update({ status })
      .eq('id', rentalId)
      .select('*')
      .single();
    if (error) return null;

    if (data && status === 'approved') {
      const book = await this.getBookById(data.book_id);
      if (book && book.copies_available > 0) {
        await this.updateBook(data.book_id, { copies_available: book.copies_available - 1 });
      }
    }

    return data;
  }
};

module.exports = Repository;