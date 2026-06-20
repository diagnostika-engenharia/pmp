# Arquitetura do Motor de Automação — Diagnóstika Engenharia
### WhatsApp (MegaZap) → IA → Sistemas Internos (Supabase / Google Agenda / Financeiro)

> Documento técnico para revisão de **Rogério** antes da implementação.
> Versão 1.0 — Junho/2026. Autor: Arquiteto de Automação.

---

## 0. Resumo executivo (1 minuto)

Proponho um pipeline onde **n8n** (hospedado em **VPS na nuvem**, não no PC local) recebe via **webhook** todas as mensagens dos grupos de WhatsApp captadas pelo **MegaZap/MegaAPI**, normaliza o conteúdo (transcreve áudio, lê PDF/imagem), **classifica com IA** (qual condomínio, categoria, urgência, tipo de ação) retornando um **JSON estruturado**, e **roteia** automaticamente para o destino certo: `demandas` no Supabase, Google Agenda, registro financeiro ou `whatsapp_inbox`.

Decisão central recomendada: **NÃO rodar n8n no PC Windows local** — webhooks externos 24/7 exigem URL pública estável com HTTPS. Use uma **VPS pequena (~R$ 30–60/mês)** ou **n8n Cloud (~US$ 20/mês)**. Detalhes na seção 5.

---

## 1. Visão geral do fluxo

```
                          ┌─────────────────────────────────────────────┐
                          │            GRUPOS DE WHATSAPP                 │
                          │  Síndico Condo A · B · C · D · E · Financeiro │
                          └───────────────────────┬─────────────────────┘
                                                  │ (texto / áudio / imagem / PDF)
                                                  ▼
                          ┌─────────────────────────────────────────────┐
                          │         MEGAZAP / MegaAPI (instância)         │
                          │  Dispara POST para a URL de webhook a cada    │
                          │  evento (messages.upsert)                     │
                          └───────────────────────┬─────────────────────┘
                                                  │ HTTPS POST (webhook)
                                                  ▼
   ┌──────────────────────────────────────────────────────────────────────────────┐
   │                                  n8n (VPS)                                      │
   │                                                                                │
   │  [1] Webhook Trigger                                                            │
   │        │                                                                       │
   │  [2] Filtro: é de grupo monitorado? (remoteJid termina em @g.us e está na      │
   │        │     allowlist) · ignora fromMe · ignora status                        │
   │        ▼                                                                       │
   │  [3] Normalização por tipo de mensagem                                         │
   │        ├─ texto      → usa o texto direto                                      │
   │        ├─ áudio      → baixa + descriptografa .enc → Whisper → texto           │
   │        ├─ imagem     → baixa → OCR / visão (modelo multimodal)                 │
   │        └─ PDF/doc    → baixa → extrai texto                                    │
   │        ▼                                                                       │
   │  [4] IA — CLASSIFICAÇÃO (1 chamada LLM, saída JSON estruturado)                │
   │        retorna: condo, categoria, urgência, tipo_acao, dados extraídos         │
   │        ▼                                                                       │
   │  [5] ROTEADOR (Switch sobre tipo_acao)                                         │
   │        ├─ demanda_nova        → INSERT supabase.demandas                       │
   │        ├─ agendamento         → Google Agenda (MCP/Calendar node)              │
   │        ├─ lancamento_financeiro → INSERT tabela financeira                     │
   │        ├─ documento_reforma   → INSERT supabase.whatsapp_inbox                 │
   │        └─ duvida / ignorar    → log / resposta opcional no grupo               │
   │        ▼                                                                       │
   │  [6] (Opcional) Confirmação de volta no grupo via MegaZap                      │
   │        "✅ Demanda registrada: Corretiva · Bloco B apto 42 · urgência alta"     │
   └──────────────────────────────────────────────────────────────────────────────┘
                │                       │                          │
                ▼                       ▼                          ▼
        ┌──────────────┐       ┌──────────────┐          ┌──────────────────┐
        │   SUPABASE   │       │ GOOGLE AGENDA │          │  TABELA FINANCEIRA │
        │ demandas /   │       │  (eventos)    │          │   (Supabase)       │
        │ whatsapp_inbox│      └──────────────┘          └──────────────────┘
        └──────────────┘
```

---

## 2. Captação de mensagens de GRUPOS no MegaZap

### 2.1 Como o webhook funciona
O MegaZap (MegaAPI) é uma API REST baseada em **Baileys**. Configura-se a URL de webhook no painel:
**MINHAS INSTÂNCIAS → DETALHES → EDITAR → campo Webhook URL → salvar.**
A partir daí, **a cada evento** (mensagem recebida, status, etc.) a instância faz um `POST` para essa URL com o payload JSON. A URL será a do webhook do n8n (ex.: `https://n8n.diagnostika.com.br/webhook/megazap`).

### 2.2 Como identificar que veio de um grupo
No payload, o campo **`key.remoteJid`** identifica o chat:
- Contato individual → termina em **`@s.whatsapp.net`**
- **Grupo → termina em `@g.us`** ✅ (é o que nos interessa)

Dentro de grupo, **`key.participant`** (ou `contextInfo.participant`) indica **qual pessoa** enviou. **`key.fromMe`** indica se fomos nós (deve ser ignorado para evitar loop). **`pushName`** traz o nome de exibição do remetente.

> **Ação para o Rogério:** precisamos do **JID de cada grupo** monitorado. Obtém-se via endpoint de listagem de grupos do MegaAPI (`/rest/.../listGroups`) ou capturando o `remoteJid` de uma mensagem de teste em cada grupo. Montaremos uma tabela `grupos_whatsapp(jid, condo_id, tipo)` no Supabase para mapear **JID → condomínio**.

### 2.3 Estrutura do payload (campos-chave)
```jsonc
{
  "instance_key": "diagnostika-01",
  "messageType": "conversation | extendedTextMessage | audioMessage | imageMessage | documentMessage",
  "key": {
    "remoteJid": "1203630XXXXXXXXX@g.us",   // <- grupo
    "fromMe": false,
    "id": "ABCD123...",
    "participant": "556181926137@s.whatsapp.net"  // quem falou no grupo
  },
  "pushName": "João Síndico",
  "messageTimestamp": 1749600000,
  "message": {
    // o conteúdo varia conforme messageType (ver abaixo)
  }
}
```

### 2.4 Tratamento por tipo de conteúdo

| Tipo | `messageType` | Onde está o conteúdo | Como tratar |
|------|---------------|----------------------|-------------|
| Texto simples | `conversation` | `message.conversation` | usar direto |
| Texto c/ contexto | `extendedTextMessage` | `message.extendedTextMessage.text` | usar direto |
| Áudio/voz | `audioMessage` (`ptt:true`) | `url` + `mediaKey` (arquivo `.enc` criptografado) | **baixar → descriptografar → transcrever** |
| Imagem | `imageMessage` | `url` + `mediaKey` + `caption` | **baixar → descriptografar → visão/OCR** |
| PDF/doc | `documentMessage` | `url` + `mediaKey` + `fileName` + `pageCount` | **baixar → descriptografar → extrair texto** |

**Mídia é criptografada (Baileys):** o `url` aponta para um `.enc`. É preciso **descriptografar com o `mediaKey`**. Em n8n há duas opções:
1. Usar o endpoint do próprio MegaAPI que retorna a mídia já em **base64/decodificada** (preferível — menos peças móveis), **ou**
2. Usar o community node **`n8n-nodes-media-decrypt`** (descriptografa `.enc` por URL+mediaKey → binário), depois encaminhar para Whisper/visão.

> **Decisão técnica:** validar na implementação se a instância MegaZap do Rogério expõe download direto de mídia decodificada. Se sim, usamos a opção 1 (mais simples). Caso contrário, opção 2.

**Áudio → texto:** OpenAI **Whisper** (`whisper-1`). Limite de 25 MB por arquivo; converter para `mp3/ogg/m4a` se necessário. (Alternativa mais barata/rápida: Whisper via Groq.)

**Imagem/PDF → texto:** usar modelo **multimodal** (Claude/GPT com visão) para "ler" foto de orçamento, foto de vazamento, ou PDF de ART/laudo, retornando descrição + dados estruturados. PDFs com texto nativo: extrair texto direto (node de PDF) antes de gastar tokens de visão.

---

## 3. Etapa de IA — Classificação e extração estruturada

Uma **única chamada LLM** recebe o texto já normalizado (transcrição/OCR/PDF + metadados do grupo) e devolve **JSON validado**. Recomendo **Claude (Anthropic)** pela confiabilidade em seguir schema e em português; GPT-4o-mini é alternativa de menor custo. O modelo deve receber a **lista de condomínios** e o **mapa JID→condo** no system prompt para resolver `condo_id`.

### 3.1 Schema JSON de saída (contrato fixo)
```jsonc
{
  "condo_id": "string|null",          // resolvido pelo JID do grupo (preferencial) ou pelo texto
  "tipo_acao": "demanda_nova | agendamento | lancamento_financeiro | documento_reforma | duvida | irrelevante",
  "categoria": "reforma | art | laudo | corretiva | duvida | null",
  "urgencia": "baixa | media | alta | null",
  "titulo": "string (curto, max ~80 chars)",
  "descricao": "string (resumo objetivo da mensagem)",
  "bloco": "string|null",
  "apto": "string|null",
  "confianca": 0.0,                    // 0..1 — autoconfiança da classificação
  "precisa_revisao_humana": false,     // true quando confiança baixa ou ambíguo
  "dados_financeiros": {               // só quando tipo_acao = lancamento_financeiro
    "valor": 0.0, "tipo": "receita|despesa", "descricao": "string", "vencimento": "YYYY-MM-DD|null"
  },
  "dados_agendamento": {               // só quando tipo_acao = agendamento
    "titulo": "string", "data_hora_inicio": "ISO8601|null", "duracao_min": 60, "local": "string|null"
  }
}
```

### 3.2 Prompt de classificação (rascunho)
```
[SYSTEM]
Você é o classificador de mensagens da Diagnóstika Engenharia, que presta serviços de
engenharia para condomínios. Recebe mensagens de grupos de WhatsApp (texto, transcrição de
áudio ou leitura de imagem/PDF) e as classifica para roteamento automático.

Condomínios conhecidos (JID do grupo → condo_id):
{{lista_grupos}}

Categorias de demanda: reforma, art, laudo, corretiva, duvida.

Regras:
- Use o JID do grupo de origem para definir condo_id sempre que possível; só use o texto se o
  grupo for genérico (ex.: grupo financeiro da Diagnóstika).
- "tipo_acao = irrelevante" para conversa social, bom dia, figurinhas, mensagens sem ação.
- "agendamento" quando houver pedido de visita/vistoria/reunião com data ou intenção de marcar.
- "lancamento_financeiro" quando houver valor, cobrança, pagamento, boleto, nota.
- "documento_reforma" quando for envio de documento (PDF/imagem) relacionado a reforma de unidade.
- Se a mensagem for ambígua ou faltar dado crítico, defina precisa_revisao_humana = true.
- Responda APENAS com o JSON no schema fornecido. Não invente valores; use null quando não souber.

[USER]
Grupo de origem (JID): {{remoteJid}}
Remetente: {{pushName}}
Tipo de mídia original: {{messageType}}
Conteúdo (texto / transcrição / OCR):
"""
{{conteudo_normalizado}}
"""
```

> Usar **structured output / JSON mode** para forçar o schema, e um node de **validação** (ex.: garantir que `tipo_acao` ∈ enum). Se inválido ou `confianca < 0.6` → marcar `precisa_revisao_humana`.

---

## 4. Roteamento — regras por destino

Node **Switch** sobre `tipo_acao`:

### 4.1 `demanda_nova` → `INSERT supabase.demandas`
```sql
insert into demandas
  (condo_id, categoria, urgencia, titulo, descricao, bloco, apto, status, detalhes, created_at)
values
  (:condo_id, :categoria, :urgencia, :titulo, :descricao, :bloco, :apto,
   'aberta',
   jsonb_build_object(
     'origem','whatsapp','grupo_jid',:remoteJid,'remetente',:pushName,
     'msg_id',:msg_id,'confianca',:confianca,'transcricao',:conteudo_normalizado),
   now());
```
Guardar `msg_id` em `detalhes` para **idempotência** (não duplicar se o webhook reenviar).

### 4.2 `agendamento` → Google Agenda
Criar evento via node Google Calendar (ou MCP de Calendar já disponível) com `dados_agendamento`. Se faltar data → `precisa_revisao_humana=true` e cria demanda de follow-up em vez de evento. Vincular o `event_id` retornado de volta em `demandas.detalhes` quando aplicável.

### 4.3 `lancamento_financeiro` → tabela financeira (Supabase)
`INSERT` na tabela financeira com `valor`, `tipo` (receita/despesa), `descricao`, `vencimento`, `condo_id` e mesma origem/rastreio. **Recomendo que lançamentos financeiros sempre nasçam com status `pendente_confirmacao`** — dinheiro é sensível demais para confiar 100% na IA (ver seção 9).

### 4.4 `documento_reforma` → `INSERT supabase.whatsapp_inbox`
Quando vier PDF/imagem de reforma: salvar arquivo no **Supabase Storage** e registrar metadados em `whatsapp_inbox` (já existente), referenciando `condo_id`, bloco/apto e link do arquivo. Reaproveita o fluxo de aprovação de reforma já existente.

### 4.5 `duvida` / `irrelevante`
Logar (tabela de auditoria) e, opcionalmente, deixar para resposta humana. **Não** responder automaticamente a dúvidas técnicas de engenharia sem revisão.

---

## 5. Recomendação de hospedagem do n8n ⭐

**Problema central:** webhooks do MegaZap são chamadas **externas** que precisam chegar ao n8n a qualquer hora. O PC Windows do escritório **não é adequado** porque:
- Não tem IP público estável / fica atrás do roteador (precisaria de túnel tipo ngrok/Cloudflare Tunnel sempre ligado);
- Desliga, dorme, reinicia, cai a internet → **mensagens perdidas**;
- Sem HTTPS válido nem uptime 24/7.

### Comparativo

| Opção | Custo aprox. | Prós | Contras |
|-------|-------------|------|---------|
| **PC local (Windows)** | R$ 0 | "de graça" | ❌ sem IP público estável, sem 24/7, perde webhooks, manutenção manual. **Não recomendado para produção.** |
| **n8n Cloud** | ~US$ 20–25/mês (Starter) | Zero manutenção, HTTPS pronto, updates automáticos, suporte | Limite de workflows/execuções no plano básico; dados trafegam por infra de terceiros (atenção LGPD) |
| **VPS + n8n self-hosted** ⭐ | ~R$ 30–60/mês (VPS 2 GB RAM, ex. Hostinger/Contabo/Hetzner) | Workflows/execuções **ilimitados**, **dados ficam na nossa infra** (melhor p/ LGPD), custo previsível, controle total | Exige setup inicial (Docker + domínio + SSL via Caddy/Traefik) e manutenção (updates, backup) |

### ✅ Decisão recomendada
**VPS pequena com n8n self-hosted em Docker**, atrás de um proxy com HTTPS automático (Caddy ou Traefik), domínio próprio (ex.: `n8n.diagnostika.com.br`). 2 GB de RAM bastam para esse volume.
- **Motivos:** custo igual ou menor que o Cloud, **execuções ilimitadas** (vamos ter várias mídias/transcrições), e **dados de clientes ficam sob nosso controle** — ponto forte para LGPD.
- **Alternativa válida** se o Rogério **não quiser nenhuma manutenção de servidor:** **n8n Cloud** — paga-se um pouco mais e abre-se mão de parte do controle de dados, mas é "ligar e usar". É a escolha certa se ninguém aqui vai cuidar de updates/backup da VPS.

> **Importante:** mesmo na VPS, configurar **backup automático** dos workflows e credenciais, e **fila/retry** no n8n para não perder mensagem se a IA ou o Supabase falharem momentaneamente.

---

## 6. Credenciais / conexões necessárias no n8n

| Conexão | Para quê | Tipo de credencial | Onde fica |
|---------|----------|--------------------|-----------|
| **MegaZap / MegaAPI** | receber webhook + enviar resposta + baixar mídia | `instance_key` + token/API key | **Só no n8n** (credential store) |
| **Supabase** | INSERT em `demandas`, financeira, `whatsapp_inbox`, Storage | **`service_role` key** (ou Postgres connection string) | **Só no n8n — NUNCA no frontend** ⚠️ |
| **OpenAI** (ou Groq) | Whisper (transcrição) | API key | Só no n8n |
| **Anthropic** (ou OpenAI) | classificação + visão (PDF/imagem) | API key | Só no n8n |
| **Google** | Google Agenda (e Gmail, se notificar) | OAuth2 / MCP já disponível no ambiente | Só no n8n |

### Riscos de segurança (regras inegociáveis)
1. **`service_role` do Supabase ignora RLS — tem poder total no banco.** Ela vive **exclusivamente** dentro do n8n (credential store criptografado). **Nunca** vai para frontend, app, repositório Git ou print de tela.
2. **Webhook do n8n deve ter segredo:** usar um token/secret na URL ou validar um header, para que ninguém além do MegaZap consiga injetar mensagens falsas no fluxo.
3. **HTTPS obrigatório** em toda a cadeia (webhook e chamadas).
4. **Variáveis de ambiente / n8n credentials**, nunca hardcode em nodes "Code".
5. **Princípio do menor privilégio:** se possível, em vez de `service_role`, usar um **Postgres role dedicado** com permissão só nas tabelas necessárias (`demandas`, financeira, `whatsapp_inbox`).
6. **Logs:** evitar logar conteúdo sensível (CPF, valores) em texto plano nos logs de execução do n8n; reter execuções por tempo limitado.

---

## 7. LGPD e privacidade (ler grupos de WhatsApp de clientes)

Estaremos lendo e processando **mensagens de terceiros** (síndicos, condôminos) — dados pessoais sob a LGPD. Pontos:

1. **Base legal e transparência:** os participantes dos grupos devem **saber** que mensagens são processadas automaticamente pela Diagnóstika para fins de atendimento/gestão de demandas. Recomendo uma **mensagem de aviso fixada** em cada grupo e cláusula no contrato com o condomínio (legítimo interesse / execução de contrato).
2. **Finalidade e minimização:** processar **apenas** o necessário (gerar demanda/agenda/financeiro). **Não** captar/armazenar mídia ou texto sem relação com o serviço. Filtrar `irrelevante` cedo.
3. **Dados sensíveis:** transcrições de áudio podem conter dados pessoais; tratar com o mesmo cuidado do banco.
4. **Subprocessadores (IA):** OpenAI/Anthropic processam o conteúdo. Verificar que estão em modo **sem treinar com nossos dados** (APIs comerciais não treinam por padrão) e mencionar esses subprocessadores na política de privacidade.
5. **Retenção e exclusão:** definir prazo de retenção de transcrições/execuções e atender pedidos de exclusão.
6. **Controle de acesso:** acesso ao n8n e ao Supabase com autenticação forte (2FA) e poucas pessoas.
7. **Soberania de dados:** outro argumento a favor da **VPS self-hosted** (seção 5) — os dados não passam por uma plataforma SaaS adicional.

> **Ação para o Rogério:** alinhar com os condomínios o aviso de processamento automatizado e revisar o contrato. Esse é um pré-requisito de conformidade, não opcional.

---

## 8. Plano de implementação em fases

### Fase 0 — Infra (semana 1)
- Provisionar VPS, instalar n8n (Docker) + Caddy (HTTPS) + domínio.
- Configurar credenciais (MegaZap, Supabase, OpenAI/Anthropic, Google).
- Criar tabela `grupos_whatsapp(jid, condo_id, tipo)` e popular com o JID de **1 grupo piloto**.

### Fase 1 — MVP: 1 grupo → classificar → criar demanda (semanas 2–3)
- Webhook recebe mensagens do **1 grupo piloto**.
- Tratar **só texto** primeiro.
- Classificação IA → `INSERT demandas` com `status='aberta'`.
- Confirmação simples de volta no grupo ("✅ Demanda registrada...").
- **Critério de sucesso:** N mensagens reais classificadas corretamente; medir taxa de acerto e falsos positivos.

### Fase 2 — Mídia (semana 4)
- Adicionar **áudio** (download+decrypt+Whisper) e **PDF/imagem** (visão/OCR).
- Rotear `documento_reforma` → `whatsapp_inbox` + Storage.

### Fase 3 — Roteamento completo (semanas 5–6)
- Ativar `agendamento` → Google Agenda e `lancamento_financeiro` → tabela financeira (com `pendente_confirmacao`).
- Painel/visão de "itens que precisam de revisão humana" (`precisa_revisao_humana=true`).

### Fase 4 — Escala (semana 7+)
- Expandir para **os 5 condomínios** + grupo financeiro.
- Ajustar prompt com base nos erros reais, métricas, alertas de falha, backups.

> Filosofia: **começar pequeno e medir**. Só expandimos um grupo/destino quando o anterior estiver confiável.

---

## 9. Riscos e pontos abertos (decisões do Rogério)

### Decisões que preciso do Rogério
1. **Hospedagem do n8n:** aprovar **VPS self-hosted** (recomendado) ou preferir **n8n Cloud** (zero manutenção, custo um pouco maior)? — *bloqueia a Fase 0.*
2. **Nível de automação x supervisão:** o sistema deve **lançar automaticamente** demandas/agenda/financeiro, ou criar tudo como **rascunho/pendente de confirmação** que um humano aprova? (Recomendo: **demandas automáticas**, mas **financeiro e agenda sempre com confirmação** no início.)
3. **LGPD / aviso aos grupos:** autorizar e providenciar o **aviso de processamento automatizado** nos grupos e o ajuste contratual com os condomínios.

### Riscos técnicos / pontos abertos
- **Erros de classificação da IA** (condomínio/categoria errados, alucinação de valor financeiro). Mitigação: `confianca`, `precisa_revisao_humana`, financeiro pendente, confirmação no grupo.
- **Duplicação de mensagens** se o webhook reenviar. Mitigação: idempotência por `msg_id`.
- **Loop de automação** (o bot responde e ele mesmo capta a resposta). Mitigação: ignorar `fromMe=true` e o próprio número.
- **Custo de IA** com volume de áudios/imagens. Mitigação: filtrar `irrelevante` antes da IA, usar modelos baratos (mini/Groq) onde der.
- **Mídia criptografada do MegaZap:** confirmar se a instância entrega mídia decodificada ou se precisamos do node de decrypt (seção 2.4).
- **Estabilidade do MegaZap/WhatsApp não-oficial:** número pode cair/ser banido se houver envio em massa. Mitigação: moderar envios; este projeto é majoritariamente **leitura**, o que é mais seguro.
- **Mapeamento JID→condomínio:** depende de coletarmos os JIDs reais dos 5 grupos (+ financeiro).
- **Backup e recuperação** dos workflows/credenciais na VPS.

---

*Fim do documento — aguardando revisão de Rogério para iniciar a Fase 0.*
