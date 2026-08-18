# Porta Fidei

Sistema web de catálogo e gerenciamento de empréstimos da biblioteca Porta Fidei. O catálogo, as recomendações e a disponibilidade dos livros são públicos; as operações administrativas ficam protegidas por autenticação.

## Funcionalidades

### Acesso público

- Visualização do catálogo de livros disponíveis.
- Busca e filtros por título, autor e categoria.
- Consulta de disponibilidade por exemplar e unidade.
- Aba **Reviews Alma Pequenina**, com notas e recomendações de livros já lidos.

### Área administrativa

- Login restrito à conta de administração.
- Cadastro, edição e exclusão de livros.
- Importação do acervo por `.xlsx`, `.xls` ou `.csv`.
- Registro de empréstimos e acompanhamento de prazos.
- Registro de devoluções e atualização automática da disponibilidade.
- Gerenciamento das reviews: publicar, editar, verificar duplicidade pelo nome do livro e fixar uma review no topo.

### Regra do ID do livro

Todo empréstimo exige o ID do livro. Esse identificador é gravado no registro do empréstimo e permanece como referência até que a devolução seja registrada. Isso evita a troca de exemplar durante o ciclo do aluguel.

## Stack

- Node.js e Express.
- Frontend em HTML, CSS e JavaScript, sem framework.
- Supabase Auth para autenticação.
- Supabase Postgres para livros, unidades, empréstimos e reviews.
- GitHub Actions para CI e aplicação das migrações.

## Estrutura

```text
.
├── PortaFidei/
│   ├── app.js                 # Interface e comportamento do frontend
│   ├── db.js                  # Acesso ao Supabase e regras de persistência
│   ├── server.js              # API Express
│   ├── index.html             # Estrutura da aplicação
│   ├── style.css              # Identidade visual
│   ├── schema.sql              # Schema inicial e dados seed
│   └── tests/smoke.test.js    # Testes estáticos de fumaça
├── supabase/
│   ├── config.toml
│   └── migrations/            # Migrações versionadas
└── .github/workflows/
    ├── ci.yml                 # Lint, testes e build
    └── cd.yml                 # Migrações no Supabase
```

## Requisitos

- Node.js 20 ou superior.
- Uma conta/projeto no Supabase.
- O Supabase CLI para aplicar migrações remotamente.

## Configuração local

1. Clone o repositório e entre na pasta do projeto:

   ```bash
   git clone https://github.com/mtojald/Projeto-PF.git
   cd Projeto-PF/PortaFidei
   ```

2. Instale as dependências:

   ```bash
   npm ci
   ```

3. Crie `PortaFidei/.env` com as variáveis abaixo:

   ```env
   SUPABASE_URL=https://seu-projeto.supabase.co
   SUPABASE_ANON_KEY=sua-chave-anon
   SUPABASE_SERVICE_KEY=sua-chave-service-role
   PORT=8080
   ALLOWED_ORIGIN=http://localhost:8080
   ```

   `SUPABASE_SERVICE_KEY` é uma credencial exclusiva do servidor. Nunca a exponha no frontend, no Git ou em issues/PRs. O arquivo `.env` já está ignorado pelo `.gitignore`.

4. Prepare o banco no Supabase. Para uma instalação inicial, execute [`PortaFidei/schema.sql`](PortaFidei/schema.sql) no SQL Editor. Para instalações que já usam o histórico de migrações:

   ```bash
   supabase login
   supabase link --project-ref SEU_PROJECT_ID
   supabase db push
   ```

5. Inicie o servidor:

   ```bash
   npm start
   ```

   Acesse [http://localhost:8080](http://localhost:8080).

## Scripts

Execute dentro de `PortaFidei/`:

| Comando | Finalidade |
| --- | --- |
| `npm start` | Inicia a API e a aplicação em `http://localhost:8080` |
| `npm run lint` | Verifica a sintaxe dos arquivos JavaScript |
| `npm test` | Executa os testes de fumaça |
| `npm run build` | Valida a compilação/sintaxe de produção |

## Reviews Alma Pequenina

A página de reviews é pública para leitura e possui edição restrita à administradora. Cada review contém:

- nome do livro;
- autor;
- nota de `0` a `10`, aceitando incrementos de `0,5`;
- opinião;
- opção de fixar no primeiro lugar.

O sistema rejeita uma segunda review para o mesmo livro, comparando o nome sem diferenciar maiúsculas, minúsculas ou espaços nas extremidades. Reviews publicadas podem ser editadas pela administradora.

## CI/CD

O workflow de CI é executado em Pull Requests e pushes na `main`. Ele instala as dependências e executa:

```text
npm ci
npm run lint
npm test
npm run build
```

O workflow de CD aplica as migrações do Supabase em pushes na `main` ou manualmente pelo GitHub Actions. Configure os seguintes secrets no ambiente `production` do repositório:

| Secret | Uso |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Autenticação do Supabase CLI |
| `SUPABASE_DB_PASSWORD` | Senha do banco para as migrações |
| `SUPABASE_PROJECT_ID` | Referência do projeto Supabase |

Para executar manualmente pela CLI do GitHub:

```bash
gh workflow run "Supabase migrations" --ref main --repo mtojald/Projeto-PF
```

Depois de cadastrar ou alterar os secrets, uma execução com falha também pode ser reprocessada pela aba **Actions** do GitHub.

## Segurança

- A `main` é protegida e alterações entram por Pull Request.
- Operações de escrita da API exigem sessão administrativa válida.
- O acesso de serviço ao Supabase fica no backend.
- Credenciais e arquivos `.env` não devem ser commitados.

## Licença

Consulte o arquivo [`LICENSE`](LICENSE).
