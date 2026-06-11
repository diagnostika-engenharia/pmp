# Briefing — Novo Dashboard para o Painel Técnico (PMP)

> Documento de contexto para construir uma **opção alternativa de dashboard** para o
> "Painel Técnico" do app **PMP — Manutenção Preventiva** da Diagnóstika Engenharia.
> O dashboard atual ("Dashboard Executivo") já existe; queremos um **modelo alternativo**,
> não substituir o que está no ar sem aprovação.

---

## 1. O que é o sistema

**PMP (App Manutenção Preventiva)** — PWA usado pela equipe técnica da Diagnóstika
(engenheiros/sócios) para gerir, em campo e remotamente, 5 condomínios clientes:
demandas de reforma, ARTs, pareceres/laudos, visitas técnicas, manutenções preventivas
(NBR 5674 / 16280 / 5410 etc.), eventos de portaria e documentos.

O **"Painel Técnico" → "Início / Dashboard Executivo"** é a tela de abertura: visão
gerencial consolidada de todos os condomínios, com filtros por condomínio e período.

---

## 2. Stack técnica (IMPORTANTE — restrições de arquitetura)

- **Frontend:** **HTML + CSS + JavaScript vanilla, em um único arquivo `index.html`**.
  **Sem framework, sem build step, sem npm/webpack.** Bibliotecas entram via `<script>` CDN
  (já usa `jsPDF`, `html2canvas`, `supabase-js`). O dashboard novo precisa caber nesse modelo:
  funções JS que retornam strings de HTML e injetam em um container.
- **Backend:** **Supabase** (Postgres + Auth + Storage + PostgREST). Acesso pelo client
  `supabase-js` já inicializado na página como `sb`.
- **Hospedagem:** **GitHub Pages**, repo `diagnostika-engenharia/pmp`,
  publicado em **https://diagnostika-engenharia.github.io/pmp/**.
- **Auth:** Supabase Auth (e-mail/senha). RLS protege as tabelas; o acesso anônimo usa a
  **anon key pública** (design normal Supabase, protegida por RLS — **não é vulnerabilidade**).
- **Padrão de render do dashboard atual:** funções `renderBI*()` que devolvem template
  strings de HTML, montadas em um **grid CSS de 12 colunas** (`.bi-grid` + classes de span
  `.bi-c2`…`.bi-c12`). Estado de filtro em variáveis globais (`_homeCondoFilter`,
  `_homePeriodFilter`) + funções `setHomeCondoFilter()` / `setHomePeriodFilter()`.

> **Pode propor outra abordagem visual/lib (ex.: Chart.js, ApexCharts via CDN), desde que
> permaneça num único HTML estático servível pelo GitHub Pages, sem build.**

---

## 3. Conexão Supabase (para protótipo)

```js
const SUPABASE_URL  = 'https://fimmjgdwhifsrrbreche.supabase.co';
const SUPABASE_ANON = '<anon key pública — pegar no index.html, linha ~1193>';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON,
  { auth:{ persistSession:true, autoRefreshToken:true } });
```
> A anon key é pública e pode ser usada no protótipo. **NUNCA** usar service_role no frontend.
> A leitura das tabelas exige usuário autenticado (login Supabase) por causa do RLS.

---

## 4. Identidade visual (paleta oficial Diagnóstika)

| Uso | Cor |
|---|---|
| Teal escuro (primária) | `#155B67` |
| Turquesa (secundária) | `#00B4AC` |
| Lima (acento) | `#8DB72A` |
| Texto escuro | `#1A2E31` |
| Texto secundário | `#5A7A7E` |
| Fundo claro | `#F0F4F5` |
| Alerta/atraso | `#E65100` |
| Erro/crítico | `#C00000` |
| Sucesso | `#1B8A4A` |

**Cores por condomínio** (usar consistentemente em legendas/gráficos):

| Condomínio | `condo_id` | Cor |
|---|---|---|
| Monte Carlo | `monte-carlo` | `#155B67` |
| Morada Morumbi | `morada-morumbi` | `#00B4AC` |
| Portal Primavera | `portal-primavera` | `#8DB72A` |
| Santa Clara | `residencial-santa-clara` | `#7D3C98` |
| Jardins do Malta | `jardins-do-malta` | `#D4A24C` |

---

## 5. Modelo de dados (tabelas Supabase relevantes)

> Campos abaixo extraídos do uso real no código. Tipos aproximados.

### `demandas` — coração do dashboard
Cada demanda = uma solicitação/ocorrência de um condomínio.
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `condo_id` | text | um dos 5 ids da tabela acima |
| `user_id` | uuid | quem criou |
| `categoria` | text | `reforma` \| `art` \| `laudo` \| `corretiva` \| `duvida` |
| `urgencia` / `urgência` | text | `alta` \| `média` \| `baixa` |
| `titulo`, `descricao` | text | |
| `bloco`, `apto` | text | localização |
| `status` | text | `aberta` \| `em_andamento` \| `resolvida` \| `fechada` |
| `clandestina` | bool | obra não autorizada (flag de portaria) |
| `irregular` | bool | |
| `origem` | text | ex.: `portaria`, `morador` |
| `porteiro_origem` | text | |
| `portaria_evento_id` | uuid | FK p/ `portaria_eventos` |
| `data_programada` | date (YYYY-MM-DD) | usada p/ "atrasadas" |
| `detalhes` | jsonb | inclui `detalhes.subtipo_morador` (`art`/`reforma`/`duvida`/`corretiva`) |
| `created_at`, `updated_at` | timestamptz | |
| `deletada_em` | timestamptz | soft-delete (ignorar quando preenchido) |

Carga: `sb.from('demandas').select('*').order('created_at',{ascending:false})`.

### `visitas` — visitas técnicas em campo
Campos: `id`, `condo_id`, `data`/`data_execucao`, `status` (`finalizada` etc.), `created_at`,
mais payload da visita. Carga: `.from('visitas').select('*').order('created_at',desc).limit(200)`.
(Há também histórico de visitas em `localStorage('historico')` para KPIs do mês.)

### `manutencoes` — execução do plano preventivo (NBR 5674)
Campos: `id`, `condo_id`, `data_execucao`, `status`, item/grupo do plano, valor (opcional).
Carga: `.from('manutencoes').select('*').order('data_execucao',desc)`.

### `portaria_eventos` — entradas de prestadores / obras sinalizadas
Campos: `id`, `condo_id`, `torre`, `apto`, `hora`, `porteiro`, `observacao`,
`revisada_em`, `revisada_por`. Alimenta abertura de demanda "obra não autorizada".

### `docs_condos` — documentos por condomínio
`id`, `condo_id`, `categoria`, `ordem`, `visivel_morador`, etc.

### `whatsapp_inbox` — documentos de reforma recebidos via WhatsApp/upload
`id`, `condo_id`, `status` (`aguardando`/`aprovado`/`reprovado`/`pendente_docs`),
`conformidade_nbr`, `ia_raw` (jsonb), `created_at`, etc.

### `user_condos` — vínculo usuário↔condomínio (papéis)
`user_id`, `condo_id`, `role`. Define o que cada login enxerga.

### Plano de manutenção preventiva (NÃO é tabela — está hardcoded no JS)
Constante grande no `index.html` com ~dezenas de itens por grupo
(Hidrossanitário, Elétrica, SPDA, Pintura, Gás, Revestimento…), cada item com
`grupo`, `nome`, `periodicidade` (Mensal/Semestral/Anual/Bienal/Trienal/Quinquenal),
`norma` (NBR 5410, 5419, 5626, 15575, Portaria MS 888/2021…), `prioridade`
(Alta/Média/Baixa), `responsavel`, `pagina_manual`. Serve para calendário de
conformidade e "o que vence quando".

---

## 6. Dashboard atual — o que já existe (referência)

Tela "Dashboard Executivo" (funções `renderBI*` no `index.html`):

- **Header** (`renderBIHeader`): título + filtros de período (`30 dias` / `90 dias` / `2026`)
  + botão "📥 PDF" + chips de condomínio (com contagem de demandas por condo) e "Todos".
- **4 KPIs** (`renderBIKPIs`, função `computeHomeKPIs`):
  1. **Demandas ativas** — `status≠fechada && !deletada_em` (com sparkline 14 dias).
  2. **⚠ Atrasadas** — `data_programada < hoje` e não resolvida/fechada; OU `aberta` sem
     programação há > 7 dias.
  3. **⚡ Em andamento** — `status==='em_andamento'`.
  4. **✓ Visitas no mês** — visitas finalizadas no mês corrente.
- **Faixa "5 tipos de demanda"** (`renderBITipos`): ART, Aprovação de Reforma, Parecer/Laudo,
  Dúvida, Corretiva — cada um com total + pendentes. Classificação por
  `detalhes.subtipo_morador` ou `categoria`.
- **"⚡ Requer sua ação"** (`renderBIRequerAcao`): lista de itens que pedem ação do técnico.
- **Detalhes em abas** (`renderBIDetalhes` + `switchBITab`): Demandas por condomínio,
  Funil, Conformidade NBR, Solicitações/Entregas.
- **Tendência**: sparklines de demandas criadas (últimos 14/30 dias).

Filtro central: `_biFilteredDemandas()` aplica condomínio + período sobre `_demandasAllPMP`.

**Feedback do usuário sobre o atual:** a versão anterior ficou "muito poluída"; já houve um
redesign "Foco em ação". Esta nova opção deve buscar **clareza e foco gerencial**, não repetir
a poluição. Pense em legibilidade, hierarquia e "o que preciso decidir hoje".

---

## 7. O que se espera do novo modelo

Um **dashboard executivo alternativo** para a equipe técnica, que responda rápido a:
- Quantas demandas ativas / atrasadas / em andamento, por condomínio e no período.
- Onde está o risco agora (atrasos, obras não autorizadas, ARTs/pareceres pendentes).
- Saúde da manutenção preventiva (o que vence/venceu por norma e condomínio).
- Tendência (entrada de demandas, throughput de resolução).
- Visão por condomínio (comparativo lado a lado) **e** visão consolidada.

Liberdade para propor o **layout e os gráficos** (cards, séries temporais, heatmap
condo×status, funil, gauge de conformidade, ranking de pendências, timeline de visitas…).
Priorizar **ação e decisão**, com filtros de condomínio + período como o atual.

### Requisitos não-negociáveis
1. **Único HTML estático** servível por GitHub Pages, **sem build** (libs só via CDN).
2. Usar a **paleta oficial** e as **cores por condomínio** acima.
3. Ler dados do **Supabase via `sb`** (anon key + login), respeitando RLS.
4. Responsivo (usado em desktop e em campo).
5. Português (pt-BR); datas em `dd/mm/aaaa`.
6. Entregar como **função(ões) JS que retornam HTML** + CSS isolado, fácil de plugar como
   uma aba alternativa — **não** sobrescrever o dashboard atual.

### Formato de entrega sugerido
- Um HTML de protótipo standalone (mock data OU conectado ao Supabase) +
- O bloco de CSS e as funções de render isoladas, prontas para integrar ao `index.html`.

---

## 8. Notas finais
- Hoje há **5 condomínios**; o modelo deve escalar para mais sem quebrar (não fixar em 5).
- `created_at`/`updated_at` em UTC (timestamptz) — converter para horário BR na exibição.
- Soft-delete: sempre ignorar registros com `deletada_em` preenchido.
- Não inventar campos: se precisar de um dado que não existe, sinalizar como "pendente de
  criar no schema" em vez de assumir.
