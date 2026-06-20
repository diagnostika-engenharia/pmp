# Pesquisa: Automação da Emissão de NFS-e — Diagnóstika Engenharia LTDA

**Documento de Descoberta e Requisitos**
Elaborado em junho/2026 · CNPJ Diagnóstika: 54.027.948/0001-60 · Sede: Rua Ribeirão Preto, 91 — Jardim do Trevo, Campinas/SP, CEP 13030-140

> Objetivo: automatizar a emissão da nota fiscal de serviço mensal para os 5 condomínios atendidos, personalizada por contrato e por município, com o mínimo de trabalho manual e de fricção fiscal.

---

## ⚠️ CORREÇÃO / DEFINIÇÃO DO ALVO (atualizado jun/2026, confirmado pelo Rogério)

A análise inicial assumiu emissão no município do **tomador** (Paulínia/Hortolândia). **Isso está incorreto para este caso.** A Diagnóstika emite **TODAS** as notas pela **Prefeitura de Campinas** (sede da empresa), pois o ISS é recolhido no município do **prestador**. Portanto:

- **Município-alvo único: CAMPINAS/SP** — uma só integração cobre os 5 condomínios.
- **Campinas TEM webservice próprio de NFS-e**, hoje no padrão **ABRASF 2.03 (síncrono)**, com manual público. → **Integração direta via n8n é viável, SEM gateway e SEM mensalidade.**
  - Manual do WebService: https://nfse.campinas.sp.gov.br/NotaFiscal/cpqPDF/WebService.pdf
  - Manuais: https://nfse.campinas.sp.gov.br/NotaFiscal/manuais.php · Regime em lote: https://nfse.campinas.sp.gov.br/NotaFiscal/regimeLote.php
  - Lib de referência (GitHub): https://github.com/4success/nfse-campinas · Portais: novanfse.campinas.sp.gov.br / issdigital.campinas.sp.gov.br
- **Regime tributário: Simples Nacional** (ISS conforme tabela do Simples; confirmar código de serviço LC 116 usado nas notas atuais).
- **Certificado digital A1: o Rogério JÁ TEM, instalado no computador.** ⚠️ Para o n8n (na VPS) emitir, o arquivo do certificado (.pfx/.p12) **+ senha** precisam estar disponíveis para o n8n — exportar do computador e carregar como credencial no n8n (guardar só lá, nunca no frontend).
- **Custo: praticamente zero** (sem gateway). Único custo recorrente é a renovação anual do A1 que já existe.

**Fluxo técnico:** n8n monta o RPS em XML (ABRASF 2.03) → assina com o A1 → envia ao webservice de Campinas → recebe a NFS-e. **Pendência:** confirmar qual webservice está vigente em 2026 (Campinas mudou o sistema em 2025) e baixar o manual atual; confirmar código de serviço + alíquota ISS no Simples.

> O restante deste documento (gateways, análise por município do tomador) fica como **referência histórica** — o caminho recomendado agora é o **webservice direto de Campinas via n8n**.

---

## 1. Como funciona a NFS-e no Brasil (resumo prático)

A **Nota Fiscal de Serviço Eletrônica (NFS-e)** documenta a prestação de **serviço**, cujo imposto principal é o **ISS / ISSQN** — um tributo **municipal**. Por isso, historicamente **cada prefeitura tem o seu próprio sistema, portal, regras de credenciamento e, quando existe, a sua própria API**. Não há (ainda) um único lugar onde toda empresa do Brasil emita NFS-e da mesma forma — diferentemente da NF-e de produto (mercadoria), que é estadual e padronizada há anos.

Consequências práticas para a Diagnóstika:
- A empresa precisa estar **credenciada/inscrita em cada município onde presta serviço e onde o ISS é devido** (em regra, serviço de engenharia/assessoria gera ISS no município do prestador — Campinas —, mas alguns municípios e códigos exigem inscrição/retenção no município do tomador; isso precisa ser confirmado com a contabilidade, ver §8).
- O **layout, o login e a forma de transmitir variam** de prefeitura para prefeitura.

**Padrão Nacional NFS-e (Sefin Nacional / Receita Federal) — estado em 2025/2026:**
- Existe um **padrão nacional unificado de NFS-e**, com layout único, emissor web gratuito e API nacional, integrado à Reforma Tributária (LC 214/2025).
- A **adesão dos municípios passou a ser obrigatória a partir de janeiro/2026**; municípios que não aderirem podem sofrer suspensão de transferências voluntárias da União. Em set/2025 já havia **mais de 3.000 municípios** com convênio assinado (>80% da população e da arrecadação de ISS).
- O município pode aderir de duas formas: **(a) emissor nacional gratuito** ou **(b) sistema próprio integrado** à plataforma nacional. Na prática, **a transição está em curso e ainda há instabilidade** — a própria Receita orientou contribuintes a continuarem recorrendo aos municípios durante o período de migração.

**Leitura para a Diagnóstika:** o padrão nacional é o futuro e tende a simplificar tudo, mas **em 2026 ainda é um ambiente em transição**. Para um negócio pequeno que precisa emitir já, o caminho mais seguro e de menor esforço é usar um **gateway/intermediário** que abstrai tanto os sistemas municipais legados (GISS) quanto o novo padrão nacional (ver §4).

---

## 2. Tabela por condomínio (extraída dos contratos)

| Condomínio | Município | Valor mensal | Descrição do serviço | Periodicidade / vencimento | Observações fiscais do contrato |
|---|---|---|---|---|---|
| **Monte Carlo** | **Paulínia/SP** | **R$ 2.950,00** | Assessoria técnica de engenharia (departamento técnico terceirizado): 4 visitas/mês, parecer/relatório mensal, laudo semestral, plano de manutenção preventiva, ART quando aplicável | Mensal · pagamento até dia **15** do mês subsequente, mediante NF | NF mensal de honorários; **ARTs avulsas R$ 250 cada** somadas à NF do mês |
| **Morada Morumbi** | **Paulínia/SP** | **R$ 2.431,50** | Assessoria técnica de engenharia: 2 visitas/mês (quinzenal), parecer mensal, laudo semestral, assistência pericial, reuniões com advogados/síndica, ART quando aplicável | Mensal · pagamento até dia **15** do mês subsequente, mediante NF | NF mensal de honorários; **ARTs avulsas R$ 250 cada** somadas à NF |
| **Santa Clara** | **Paulínia/SP** | **R$ 1.000,00** | Assessoria em engenharia condominial: 2 visitas/mês, relatório mensal, análise de reformas, laudos/pareceres, acesso ao portal para condôminos | Mensal · vencimento **dia 05** do mês subsequente; **boleto + NF** | Contrato exige expressamente **"Nota Fiscal Eletrônica em favor do Contratante, vencimento dia 5"** |
| **Jardins do Malta** | **Hortolândia/SP** | **R$ 2.277,00** (desconto pontualidade → **R$ 2.000,00** se pago até dia 15) | Assessoria mensal de engenharia condominial: 2 visitas/mês, 1 documento técnico/mês, plano de manutenção preventiva, análise de reformas | Mensal · desconto se pago até dia **15**; **NF enviada para fins fiscais** independentemente de pagamento prévio | Há também contrato judicial avulso (assistência técnica, processo 1005468-51.2022) de R$ 12.000 — não recorrente |
| **Portal Primavera** | **PENDENTE** (não localizado contrato de assessoria mensal) | **PENDENTE** | Só foi localizado contrato pontual de **fachada** ("CONTRATO PORTAL PRIMAVERA - FACHADA.docx") — não um contrato de assessoria mensal | **PENDENTE** | Confirmar com Rogério se há contrato mensal vigente e em qual município |

**Resumo:** 3 dos 5 condomínios estão em **Paulínia/SP**, 1 em **Hortolândia/SP**, e **Portal Primavera está pendente** (provavelmente também região de Campinas, a confirmar). Ou seja, hoje a Diagnóstika opera em **apenas 2 municípios de tomador**, ambos no estado de SP.

> Nota: o ISS de serviço de engenharia normalmente é devido no **município do prestador (Campinas)**. A tabela acima registra o município do **tomador** (condomínio) porque é o que consta dos contratos e o que importa para os dados do destinatário da NF. **A definição de onde a NF é emitida e onde o ISS é recolhido deve ser confirmada com a contabilidade** (ver §5 e §8).

---

## 3. Como é a emissão em cada município identificado

### Paulínia/SP (Monte Carlo, Morada Morumbi, Santa Clara)
- Sistema atual: **GISS Online** (portal `paulinia.giss.com.br`), padrão técnico **ABRASF 1.00**, autenticação por **Certificado Digital A1**.
- Possui **integração via API** (o padrão ABRASF é suportado pelos principais gateways — Focus, PlugNotas, Nuvem Fiscal, NFE.io já listam Paulínia como prefeitura integrada).
- Requer **inscrição municipal** e credenciamento do prestador junto à Prefeitura.
- Tende a migrar para o **padrão nacional NFS-e** ao longo de 2026.

### Hortolândia/SP (Jardins do Malta)
- Migrou para **GISS Online a partir de 01/julho** (novo sistema de escrituração eletrônica de serviços prestados/tomados). Antes era voltado principalmente a autônomos.
- Também segue o padrão **ABRASF/GISS**, portanto **integrável por gateway** (já aparece como prefeitura integrada nos provedores).
- Exige empresa **cadastrada e regularizada** junto à Prefeitura (inscrição municipal).

### Campinas/SP (sede da Diagnóstika — município provável de recolhimento do ISS)
- Caso o ISS de engenharia seja devido na sede, a NF será emitida pelo sistema de **Campinas** (também integrável por gateway). **Confirmar com a contabilidade** qual é o município de emissão/recolhimento — isso muda quais inscrições municipais são realmente necessárias.

> Boa notícia: **todos os municípios envolvidos (Paulínia, Hortolândia, Campinas) usam padrões ABRASF/GISS já suportados pelos gateways de mercado** e estão na rota do padrão nacional. Não há município "exótico" sem integração.

---

## 4. Opções de automação

### Opção A — API direta de cada prefeitura
- **Prós:** sem custo de intermediário; controle total.
- **Contras:** cada prefeitura tem layout/autenticação diferentes; manutenção pesada quando a prefeitura muda de sistema (ex.: Hortolândia acabou de migrar); exige conhecimento técnico de ABRASF, assinatura XML, certificado. **Inviável e caro de manter** para 2 pessoas e 5 notas/mês.

### Opção B — Padrão Nacional NFS-e (API gov gratuita)
- **Prós:** gratuito; é o futuro; um único layout.
- **Contras:** **ainda em transição em 2026**, com instabilidade relatada; nem todo município já recebe 100% por ele; documentação e tooling menos maduros que os gateways. Bom para acompanhar, **arriscado como dependência única hoje**.

### Opção C — Gateway / intermediário (PlugNotas, Nuvem Fiscal, Focus NFe, eNotas, NFE.io)
- **Prós:** **uma única API** que abstrai GISS, ABRASF e padrão nacional; eles cuidam das mudanças de prefeitura; suportam Paulínia, Hortolândia e Campinas; emitem, cancelam e baixam PDF/XML; muitos têm painel web (dá para emitir manualmente sem programar nada).
- **Contras:** custo mensal (baixo no nosso volume); dependência de terceiro.

**Faixas de custo (volume da Diagnóstika é ~4–5 notas/mês — cabe no menor plano de qualquer um):**

| Gateway | Entrada aprox. | Observações |
|---|---|---|
| **Focus NFe** | ~R$ 109/mês (200 docs) · **sem setup, sem fidelidade** | **Integra qualquer município novo por taxa fixa R$ 199 em até 15 dias** — ótimo se Portal Primavera estiver num município não integrado |
| **Nuvem Fiscal** | a partir de ~R$ 150/mês (anual ~R$ 1.800) · pré-pago/anual | Boa API REST, preço por operação fiscal |
| **PlugNotas (TecnoSpeed)** | planos semelhantes | Forte em suporte a desenvolvedores |
| **NFE.io** | ~R$ 119/mês (120 docs) · setup + 3 meses mín. | Boa documentação de prefeituras |
| **eNotas** | planos para PJ digital | Foco em automação para prestadores recorrentes |

> Para 5 notas/mês, o custo real fica em torno de **R$ 90–150/mês** em qualquer gateway — irrelevante frente ao faturamento (~R$ 8,4 mil/mês só nos 4 contratos confirmados).

### RECOMENDAÇÃO
**Usar um gateway — recomendação principal: Focus NFe** (ou Nuvem Fiscal como alternativa próxima). Motivos:
1. Volume baixíssimo (4–5 notas/mês) não justifica desenvolver/manter integração direta.
2. Já cobre Paulínia, Hortolândia e Campinas, e **adiciona qualquer município novo por R$ 199** — cobre o risco do Portal Primavera estar em outra cidade.
3. Sem fidelidade/sem setup (Focus): dá para começar pequeno e cancelar se o padrão nacional amadurecer.
4. Permite começar **emitindo pelo painel web** (zero código) e depois automatizar via API dentro do próprio "App Manutenção Preventiva".

---

## 5. O que é preciso ter / configurar

1. **Certificado Digital A1 (e-CNPJ)** da Diagnóstika (arquivo .pfx + senha) — obrigatório para assinar as NFS-e e para autenticar nos sistemas GISS/ABRASF e no padrão nacional. **Validade de 1 ano** — controlar renovação.
2. **Inscrição Municipal** ativa no(s) município(s) de emissão. No mínimo onde o ISS é devido (provavelmente **Campinas**); confirmar se Paulínia/Hortolândia exigem inscrição/credenciamento do prestador para tomadores de lá. **PENDENTE confirmar com contabilidade.**
3. **Credenciamento no portal de cada prefeitura** envolvida (login GISS) — necessário pelo menos uma vez para liberar a emissão eletrônica.
4. **Regime tributário** da Diagnóstika (Simples Nacional? Lucro Presumido?) — define alíquotas e se há retenções. **PENDENTE.**
5. **Código de serviço municipal + item da Lista de Serviços LC 116** e **CNAE** corretos para "assessoria/serviços de engenharia" (família 7.01 / 7.03 da LC 116 — engenharia, perícias, laudos, assessoria). **Confirmar com contabilidade o código exato aceito em Paulínia/Hortolândia/Campinas.**
6. **Alíquota de ISS** aplicável ao código de serviço em cada município (varia, tipicamente 2% a 5%). **PENDENTE.**
7. **Conta no gateway** escolhido + upload do certificado A1.

---

## 6. Como personalizar a NF por condomínio (template)

Cada nota é montada combinando **dados fixos da Diagnóstika** + **dados variáveis do condomínio**. Sugestão de template/cadastro por condomínio dentro do app:

| Campo | Fonte | Exemplo (Monte Carlo) |
|---|---|---|
| Prestador (emitente) | Fixo Diagnóstika | CNPJ 54.027.948/0001-60, Campinas/SP, inscrição municipal [PENDENTE] |
| **Tomador** (nome, CNPJ, endereço) | Por condomínio | Cond. Res. Monte Carlo, CNPJ 63.079.240/0001-43, Paulínia/SP |
| **Valor do serviço** | Contrato | R$ 2.950,00 (+ ARTs do mês × R$ 250, quando houver) |
| **Descrição do serviço** | Texto padrão por contrato | "Assessoria técnica de engenharia — competência MM/AAAA. 4 visitas técnicas mensais, parecer/relatório técnico e acompanhamento de manutenção preventiva, conforme contrato." |
| **Código de serviço / item LC 116** | Fixo (ou por município) | 7.01/7.03 — engenharia/assessoria [confirmar] |
| **Alíquota / valor do ISS** | Por município | [PENDENTE — por código e cidade] |
| **Retenções** (ISS, IRRF, PIS, COFINS, CSLL, INSS) | Regra fiscal | Em geral, tomador **condomínio** não retém quando prestador é Simples Nacional; condomínio **pode ser obrigado a reter ISS e INSS** em certos casos. **Confirmar com contabilidade por contrato.** |
| **Vencimento / dados de cobrança** | Contrato | Santa Clara dia 05; demais dia 15 |

**Dados dos tomadores já extraídos dos contratos (prontos para cadastro):**
- Monte Carlo — CNPJ **63.079.240/0001-43** — Rua Armando Antonio D'Ottaviano, 175, Jd. dos Calegaris, Paulínia/SP, CEP 13140-135
- Morada Morumbi — CNPJ **42.407.400/0001-66** — Av. Dr. Alexandre Martins Laroca, 930, Santa Terezinha, Paulínia/SP
- Santa Clara — CNPJ **39.836.306/0001-18** — Av. João Vieira, 1877, João Aranha, Paulínia/SP, CEP 13145-756
- Jardins do Malta — CNPJ **39.520.821/0001-94** — Rua das Quaresmeiras, 160, Jardim do Malta, Hortolândia/SP, CEP 13185-096
- Portal Primavera — **PENDENTE** (CNPJ e endereço não localizados)

---

## 7. Plano de implementação em fases

**Fase 0 — Pré-requisitos (1ª semana)**
- Reunir com a contabilidade: regime tributário, inscrição(ões) municipal(is), código de serviço LC 116, alíquota ISS por município, e regras de retenção por condomínio.
- Garantir o certificado A1 (.pfx) e senha.

**Fase 1 — MVP: 1 condomínio via gateway, painel web (semanas 1–2)**
- Criar conta no **Focus NFe** (ou Nuvem Fiscal), subir o A1.
- Cadastrar Diagnóstika + 1 condomínio (sugestão: **Santa Clara**, pois o contrato exige NF explícita e é o de menor valor/risco).
- Emitir manualmente a NF de competência pelo painel, validar PDF/XML, e checar com a contabilidade se ISS/retenções saíram corretos.

**Fase 2 — Os 4 condomínios confirmados (semanas 3–4)**
- Cadastrar Monte Carlo, Morada Morumbi e Jardins do Malta com seus templates.
- Definir rotina mensal: gerar as 4 notas nas datas (Santa Clara dia 05; demais dia 15), incluindo ARTs avulsas do mês quando houver.

**Fase 3 — Automação dentro do "App Manutenção Preventiva" (mês 2)**
- Integrar a **API do gateway** ao app: cadastro de condomínio/contrato → botão "Emitir NF do mês" → guarda PDF/XML e dispara e-mail ao síndico/administradora.
- Adicionar tratamento de ARTs avulsas (Monte Carlo/Morumbi) somadas ao valor.

**Fase 4 — Portal Primavera + monitorar padrão nacional (contínuo)**
- Incluir Portal Primavera assim que o contrato/município forem confirmados.
- Acompanhar a maturidade do **padrão nacional NFS-e**; quando estável, avaliar migração (reduz dependência do gateway).

---

## 8. Pendências e perguntas para o Rogério responder

1. **Regime tributário** da Diagnóstika (Simples Nacional, Lucro Presumido, MEI não — é LTDA)? Define alíquota e retenções.
2. **Inscrição Municipal** da Diagnóstika — qual(is) cidade(s)? Já existe em Campinas? Precisa em Paulínia/Hortolândia?
3. **Município onde o ISS é recolhido** para o serviço de engenharia/assessoria condominial — Campinas (sede) ou município do condomínio?
4. **Código de serviço (LC 116 / lista municipal)** e **CNAE** corretos a usar na NF.
5. **Alíquota de ISS** por município/código.
6. **Retenções por condomínio:** algum condomínio retém ISS, INSS, IRRF, PIS/COFINS/CSLL? (Condomínios às vezes retêm ISS e INSS.)
7. **Certificado Digital A1 (e-CNPJ):** já existe? Onde está o .pfx e a senha? Validade?
8. **Portal Primavera:** existe contrato de assessoria mensal vigente? Qual valor, município (CNPJ/endereço do condomínio) e periodicidade? (Só localizamos um contrato de fachada.)
9. **Jardins do Malta:** emitir NF sobre R$ 2.277,00 (valor cheio) ou R$ 2.000,00 (com desconto)? Fiscalmente o correto costuma ser emitir o valor cheio e o desconto ser condição de pagamento — confirmar com contabilidade.
10. Quer **automação total no app** (botão único mensal) ou começar emitindo pelo **painel web** do gateway?

---

### Fontes
- [Receita Federal — NFS-e padrão nacional](https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2025/agosto/nota-fiscal-de-servico-eletronica-nfs-e-padrao-nacional-para-simplificar-o-cotidiano-das-empresas)
- [FENACON — instabilidade NFS-e nacional](https://fenacon.org.br/reforma-tributaria/contadores-relatam-instabilidade-para-emissao-de-nfs-e-nacional-receita-orienta-buscar-os-municipios/)
- [TecnoSpeed — adesão NFS-e nacional / como funciona](https://blog.tecnospeed.com.br/nfse-nacional-tudo/)
- [Associação Mineira de Municípios — obrigatoriedade jan/2026](https://portalamm.com/modernizacao-tributaria-adesao-a-nfs-e-nacional-sera-obrigatoria-a-partir-de-janeiro-de-2026/)
- [NFE.io — emissão NFS-e Paulínia/SP (GISS, ABRASF 1.00, A1)](https://nfe.io/docs/prefeituras-integradas/sao-paulo/paulinia-sp-3536505/)
- [GISS Online Paulínia](https://paulinia.giss.com.br/)
- [Prefeitura de Hortolândia — novo sistema GISS Online](https://www.hortolandia.sp.gov.br/2026/06/02/prefeitura-disponibilizara-treinamento-gratuito-sobre-novo-sistema-de-emissao-de-nota-fiscal/)
- [NFE.io — emissão NFS-e Hortolândia/SP](https://nfe.io/docs/prefeituras-integradas/sao-paulo-prefeituras-integradas/hortolandia-sp-3519071/)
- [Focus NFe — preços e integração de municípios](https://focusnfe.com.br/precos/)
- [Nuvem Fiscal — planos](https://www.nuvemfiscal.com.br/planos/)
- [Notaas — comparativo de APIs NFS-e 2025/2026](https://www.notaas.com.br/blog/post/comparativo-5-apis-para-emissao-de-nfe-nfse-e-nfce-2025)
