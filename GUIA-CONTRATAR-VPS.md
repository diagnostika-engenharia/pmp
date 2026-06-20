# Guia passo a passo: contratar uma VPS na Hostinger (para o n8n)

> Feito para o Rogério. Linguagem simples, sem jargão. Você só precisa **contratar e anotar alguns dados**. A parte técnica (instalar e configurar o n8n com HTTPS) o assistente faz depois.

---

## 1. O que é uma VPS e por que precisamos dela

Uma VPS é, basicamente, **um computador que fica ligado 24 horas por dia na internet**, alugado por mês de uma empresa (no nosso caso, a Hostinger). Diferente do seu notebook, ela nunca desliga e tem um endereço fixo na internet.

Precisamos dela porque o **n8n** (a ferramenta de automação que vamos usar) tem que ficar sempre no ar para receber os "webhooks" (avisos automáticos de outros sistemas) a qualquer hora. Se rodasse no seu computador, pararia toda vez que ele desligasse.

---

## 2. Como contratar na Hostinger

> Atenção: as telas da Hostinger **mudam de tempos em tempos** e às vezes aparecem em inglês. Os nomes dos botões podem variar um pouco. Se não encontrar exatamente o que está escrito aqui, **procure o botão equivalente** (com nome parecido) — a lógica é sempre a mesma.

**Passo a passo:**

1. Acesse **https://www.hostinger.com.br**
2. No menu do topo, clique em **VPS** (ou "Hospedagem VPS" / "VPS Hosting").
3. Você verá vários planos lado a lado: **KVM 1, KVM 2, KVM 4, KVM 8**.
   - **Escolha o KVM 2** (é o recomendado: 2 núcleos de processador, 8 GB de memória, 100 GB de disco). É o equilíbrio ideal para o n8n.
   - Se quiser economizar e o KVM 2 estiver fora do orçamento, o **KVM 1** também serve, desde que tenha **pelo menos 4 GB de RAM**. Mas, se puder, prefira o KVM 2 — folga de sobra.
4. Clique em **"Escolher plano"** (ou "Comprar" / "Selecionar").
5. **Escolha o período de contratação.** A Hostinger cobra mais barato por mês quando você fecha um período longo (12, 24 ou 48 meses), mas isso significa **pagar tudo de uma vez na frente e ficar comprometido** por mais tempo.
   - Sugestão: se for testar o serviço, comece com **12 meses**. É um bom meio-termo entre preço e compromisso. (Períodos mais curtos, tipo 1 mês, costumam sair bem mais caros por mês.)
6. Se tiver um **cupom de desconto**, é aqui que você coloca.

### Escolha do sistema operacional (PASSO MAIS IMPORTANTE)

Em algum momento do processo a Hostinger vai pedir para você escolher o **sistema operacional / template** da VPS. Preste atenção aqui:

- **Opção mais fácil (se aparecer):** a Hostinger oferece um template chamado **"Ubuntu 24.04 com n8n"** (ou parecido — pode aparecer como "n8n", "n8n com fila/queue", etc.). Esse template **já vem com o n8n instalado**. Se você ver essa opção, **pode escolher ela** — vai facilitar muito o trabalho depois. Procure na seção de **"Aplicações"** / **"Apps"** / **"Templates de aplicação"**.

- **Opção padrão (sempre funciona):** se você não encontrar o template do n8n, ou ficar em dúvida, escolha simplesmente o sistema operacional **Ubuntu** na versão **22.04 LTS** ou **24.04 LTS**. Procure na seção **"Sistema Operacional"** / **"Operating System"**. O assistente instala o n8n manualmente depois, sem problema.

> ⚠️ **O que NÃO escolher:** NÃO selecione templates com painel pago (como cPanel, Plesk, CyberPanel ou similares). Eles custam mais e não precisamos deles. Em caso de dúvida, fique no **Ubuntu puro** — é a escolha segura.

7. Continue para o pagamento, crie sua conta Hostinger (ou faça login) e finalize a compra.

---

## 3. Dados que você precisa anotar (eu vou pedir depois)

Depois de comprar, a Hostinger leva alguns minutos para "montar" a VPS. Quando ficar pronta, dentro do painel da Hostinger (menu **VPS** → sua máquina) você encontra estes dados. **Anote todos no seu arquivo de senhas:**

| Dado | Onde fica / o que é |
|------|---------------------|
| **IP do servidor** | Um número tipo `203.0.113.45`. É o "endereço" da VPS na internet. |
| **Usuário** | Quase sempre é **`root`** (o usuário administrador). |
| **Senha do root** | A senha que você definiu (ou que a Hostinger gerou) ao criar a VPS. **Guarde com cuidado.** |
| **Chave SSH** (se houver) | Se a Hostinger pediu para criar uma "chave SSH" no lugar de senha, salve o arquivo dela. Se não pediu, ignore — a senha basta. |
| **Região / Datacenter** | O local físico do servidor. **Prefira Brasil / São Paulo**, se estiver disponível. |

> **Por que preferir o datacenter no Brasil (São Paulo)?**
> 1. **Velocidade:** quanto mais perto, mais rápido — o sistema responde melhor.
> 2. **LGPD:** manter os dados no Brasil facilita estar de acordo com a lei brasileira de proteção de dados.
>
> Se na hora da compra não aparecer "Brasil", escolha o **mais próximo** (alguma cidade dos EUA, normalmente). Dá para mudar a região depois falando com o suporte, mas é mais fácil acertar agora.

---

## 4. Domínio e HTTPS (endereço "bonito" e cadeado de segurança)

Para os webhooks funcionarem bem e de forma segura (com o "cadeado" HTTPS), o ideal é que o n8n tenha um **subdomínio** apontando para o IP da VPS. Exemplo: **`n8n.diagnostika.com.br`**.

**Três cenários:**

1. **Se a Diagnóstika já tem um domínio** (ex.: `diagnostika.com.br`):
   Ótimo — só me avise qual é. Eu te passo **duas linhas de configuração** (um "registro DNS") para você colar no painel de onde o domínio está registrado, e pronto. Você não precisa entender disso, só copiar e colar onde eu indicar.

2. **Se NÃO tem domínio e quer um:**
   Dá para **registrar um domínio barato** (a própria Hostinger vende, ou Registro.br para `.com.br`). Custa pouco por ano. Me avise se quiser seguir por aqui que eu oriento.

3. **Se não quiser domínio agora:**
   A Hostinger costuma fornecer um **endereço grátis automático** (um "hostname" tipo `srv123456.hstgr.cloud`). Dá para usar isso para começar. Não é tão bonito, mas funciona.

> 📌 **Importante:** a configuração do **HTTPS (o cadeado) é comigo** — você NÃO precisa mexer nisso. Sua única tarefa aqui é: **decidir se vamos usar um domínio/subdomínio e me dizer qual.** O resto eu faço.

---

## 5. Segurança básica (importante!)

- **Guarde a senha do root** (e o IP) no seu **arquivo de senhas** de sempre. Sem esses dados, ninguém entra na VPS — nem nós.
- **NUNCA mande a senha do root em canal público** ou em grupo de WhatsApp aberto. Se precisar me enviar, mande por um canal privado e direto. Melhor ainda: me avise, e eu te digo a forma mais segura de passar.
- Se a Hostinger oferecer **autenticação em dois fatores (2FA)** na sua conta, **ative** — é uma camada de proteção a mais para sua conta.

---

## 6. Quanto custa (estimativa)

> ⚠️ **Não considere estes valores como oficiais.** Preços e promoções mudam direto. **Confira o valor atual no site da Hostinger na hora da compra.**

- O plano **KVM 2** costuma ficar na faixa de **R$ 35 a R$ 60 por mês** (valor por mês quando você fecha um período mais longo; em planos curtos, sai mais caro).
- O **KVM 1** (alternativa mais econômica) costuma ficar mais barato, na faixa de **R$ 20 a R$ 40 por mês**.
- Normalmente está **incluso**: a VPS rodando 24/7, painel de controle da Hostinger, backups básicos (confira se o plano escolhido inclui), e **30 dias de garantia de reembolso** (dá para testar sem risco).
- **Custo extra opcional:** se decidir registrar um domínio novo, some o preço anual dele (geralmente baixo).

---

## 7. Checklist final — o que me enviar quando terminar

Quando a VPS estiver comprada e no ar, me mande (por canal privado):

- [ ] **IP do servidor** (ex.: `203.0.113.45`)
- [ ] **Usuário** (normalmente `root`)
- [ ] **Senha do root** (ou o arquivo da chave SSH, se a Hostinger gerou uma)
- [ ] **Região do datacenter** escolhida (Brasil/São Paulo, espero 🙂)
- [ ] **Qual sistema/template você escolheu** (Ubuntu puro, ou o template "n8n" pronto)
- [ ] **Domínio ou subdomínio** que vamos usar — OU me avise que prefere usar o endereço grátis da Hostinger

Com isso em mãos, eu cuido de toda a instalação e configuração do n8n com HTTPS. Qualquer dúvida em qualquer passo, me chame **antes** de finalizar a compra — é mais fácil ajustar antes do que depois.

---

### Fontes consultadas (referência)
- [Hostinger – Self-hosted n8n](https://www.hostinger.com/self-hosted-n8n)
- [Hostinger – VPS Hosting (planos KVM)](https://www.hostinger.com/vps-hosting)
- [Hostinger – How to Use the n8n VPS Template](https://www.hostinger.com/support/10473267-how-to-use-the-n8n-vps-template-at-hostinger/)
- [Hostinger – VPS requirements for n8n](https://www.hostinger.com/tutorials/n8n-vps-requirements)
- [Quanto custa manter o n8n na VPS Hostinger 2026](https://horadecodar.com.br/quanto-custa-n8n-vps-hostinger-2026/)
