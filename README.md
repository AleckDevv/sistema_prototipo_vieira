# Vieira | Gestão Operacional — protótipo de demonstração

Protótipo navegável de um **Sistema de Gestão Operacional de Frota** para a **Vieira Serviços e Transportes**, feito para apresentação à diretoria.

> **Importante:** é uma demonstração. Todos os números, placas, nomes de apoio, fornecedores e valores são **fictícios**. O protótipo não deve ser usado em operações reais da empresa.

Feito apenas com HTML5, CSS3 e JavaScript puro (módulos ES6). Sem frameworks, sem backend, sem banco de dados remoto e sem serviços externos. Funciona offline.

---

## 1. Como executar

Por usar módulos ES6, o navegador não carrega o sistema abrindo o `index.html` direto do disco. É preciso um servidor local simples (já incluído).

**Windows (mais simples):** dê dois cliques em `iniciar-demo.bat`. O navegador abre em `http://localhost:8080`. Mantenha a janela preta aberta durante a apresentação.

**Qualquer sistema com Node.js (v18 ou superior):**

```bash
node servidor.js --abrir            # abre http://localhost:8080
node servidor.js --porta 8090       # se a porta 8080 estiver ocupada
```

O `servidor.js` não tem dependências e atende apenas este computador (`127.0.0.1`).

**Alternativas**, se preferir outro servidor:

```bash
python -m http.server 8080          # depois acesse http://localhost:8080
npx serve .                         # requer internet na primeira execução
```

No VS Code, a extensão *Live Server* também funciona.

Navegadores recomendados: Chrome, Edge, Safari ou Firefox atualizados.

### Telas e dispositivos

A interface é responsiva de 320 px (celular pequeno) a monitores largos, sem rolagem lateral em nenhuma tela:

| Largura | Comportamento |
|---|---|
| 1200 px ou mais | Menu lateral fixo, tabelas completas. Abaixo de 1366 px, colunas secundárias ficam ocultas (continuam no CSV e na impressão). |
| 900 a 1199 px | Menu lateral recolhido no botão ☰, conteúdo em largura total. |
| Tablet (641 a 899 px) | Indicadores em 2 colunas e gráficos empilhados; abaixo de 760 px os formulários passam a uma coluna. |
| Celular (até 640 px) | Tabelas largas viram cartões ("rótulo: valor"), abas viram botões em grade, modais ocupam a tela, campos com 16 px (sem zoom automático no iPhone) e botões maiores em telas de toque. |

Além dos pontos de quebra, `js/responsivo.js` mede o espaço real: se uma tabela não couber no contêiner, ela passa a ser exibida em cartões; se as abas não couberem, viram uma grade.

### Publicar na Vercel

O projeto é um site estático: **não tem etapa de build nem dependências**. A Vercel publica a pasta como está.

**Pelo GitHub (recomendado):**

1. Envie as alterações para o repositório (`git push`).
2. Em [vercel.com/new](https://vercel.com/new), importe o repositório.
3. Em *Framework Preset*, deixe **Other**. Não preencha *Build Command* nem *Output Directory*.
4. Clique em **Deploy**. A cada novo `git push`, a Vercel publica a versão atualizada.

**Pela linha de comando** (na pasta do projeto, com Node.js instalado):

```bash
npx vercel          # primeira vez: faz login e cria uma versão de pré-visualização
npx vercel --prod   # publica na URL de produção
```

O que já vem configurado:

- `vercel.json`: cabeçalhos de segurança (CSP restrita a arquivos do próprio site, `nosniff`, bloqueio de incorporação em outros sites) e `noindex`, para a demonstração não aparecer em buscadores.
- `.vercelignore`: `servidor.js`, `iniciar-demo.bat` e o README não são publicados.
- `404.html`: página exibida para endereços inexistentes.
- As rotas usam `#` (ex.: `/#/compras/SC-0013`), então links diretos funcionam sem configuração extra no servidor.

Na versão publicada, os dados continuam **no navegador de cada visitante** (LocalStorage): cada pessoa vê a própria cópia da demonstração, e o que um visitante altera não aparece para os outros. Qualquer pessoa com o link consegue abrir a demonstração. Os dados são fictícios, mas compartilhe o endereço só com quem deve vê-lo.

---

## 2. Perfis de demonstração

Não há login nem senha. Use o **seletor de perfil** no canto superior direito (nome e avatar) para alternar o usuário. Menus, botões e páginas se adaptam ao perfil.

Ações não permitidas aparecem com cadeado e a dica "disponível para…". Nesta simulação, as permissões também são verificadas nas funções JavaScript, mas **isso não é segurança real**: qualquer pessoa com acesso ao navegador pode alterar o código ou os dados locais.

| Usuário | Função | O que demonstra |
|---|---|---|
| Diretor Vieira | Diretor | **Aprovar ou rejeitar compras**, ver todos os indicadores, despesas e relatórios, ativar/desativar usuários |
| Gabriel | Comprador | Criar solicitações de compra, registrar pedido ao fornecedor e recebimento, cadastrar materiais |
| Luiz Henrique | Gerente | Indicadores operacionais, relatórios, despesas (consulta), cadastro de veículos, ajuste de inventário |
| Daniele | Financeiro | Registrar e conferir despesas (inclusive a despesa efetiva de uma compra), relatórios |
| Pedro | Fiscal | Abastecimento e quilometragem, entradas/saídas de estoque, recebimento de compras, **destinação de peças por placa** |
| Rafael Moura *(fictício)* | Segundo fiscal | As mesmas ações do Pedro (lançamentos ficam registrados com o nome dele) |
| Márcia | Operacional | Cadastro e situação dos veículos, abastecimentos, abertura de solicitações mecânicas |
| Antônio Batista *(fictício)* | Chefe de oficina | Gerenciar solicitações mecânicas e ordens de serviço, aplicar peças, destinar peças |

A matriz completa de permissões está em **Usuários → Perfis e permissões**.

---

## 3. Roteiro sugerido para a apresentação

1. **Dashboard** (como Diretor Vieira): indicadores, filtros por cidade/período/situação, alertas operacionais. Clique em um card ou alerta para ir ao detalhe.
2. **Compras — fluxo de aprovação:**
   - Troque para **Gabriel** → *Solicitações de compra* → **Nova solicitação de compra** → escolha itens e envie. Ela entra como *Aguardando aprovação*. Os botões Aprovar/Rejeitar não aparecem para ele.
   - Troque para **Diretor Vieira** → abra a solicitação → **Aprovar** ou **Rejeitar** (a rejeição exige motivo). O sistema registra quem decidiu, a data e o motivo. O sino do diretor mostra as pendências.
   - **Gabriel** → *Registrar pedido ao fornecedor*. **Pedro** → *Registrar recebimento* → os itens entram no estoque.
   - **Daniele** → *Registrar despesa efetiva*. A aprovação nunca registra pagamento.
3. **Peças por veículo** (como **Pedro** ou **Rafael**): *Registrar destinação* → escolha a placa, um pneu ou bateria e a unidade específica. O usuário responsável é preenchido automaticamente pelo perfil ativo.
4. **Abastecimento** (como Pedro): registre um abastecimento. O valor total é calculado automaticamente, uma quilometragem menor que a anterior é bloqueada e a prévia mostra o consumo do trecho.
5. **Manutenção** (como **Antônio**): abra uma solicitação aberta → *Abrir ordem de serviço* → aplique uma peça (baixa no estoque) → conclua a OS. O veículo é liberado e a despesa do serviço é lançada.
6. **Despesas e Relatórios** (como Daniele ou Luiz Henrique): filtre por cidade, exporte CSV, imprima um relatório.
7. **Restaurar dados da demonstração** (rodapé do menu lateral): volta ao estado inicial para reapresentar.

---

## 4. Módulos

| Módulo | Principais recursos |
|---|---|
| Dashboard | 8 indicadores calculados, filtros (cidade, período, situação), despesas por categoria/cidade, situação da frota por cidade, solicitações recentes e alertas operacionais |
| Veículos | Listagem com busca e filtros, cadastro/edição, alteração de situação com motivo, ficha com manutenção, abastecimentos, peças instaladas, despesas e histórico. Exclusão só para veículo sem histórico (os demais devem ser inativados) |
| Manutenção | Solicitações (6 status, prioridade, responsável, observações, histórico) e ordens de serviço (diagnóstico, serviço, peças, executor, datas, custo estimado e final) |
| Solicitações de compra | Etapas do fluxo, aprovação/rejeição exclusiva do diretor, pedido, recebimento com entrada no estoque, despesa vinculada |
| Estoque e inventário | Materiais, saldo, mínimo, custo médio, depósito, entradas, saídas, ajuste com justificativa, histórico de movimentações e controle individual de pneus e baterias (identificador, instalação, retirada, recapagem, baixa) |
| Peças por veículo | Destinação por placa (instalação, substituição, reposição) e retirada, com consulta do que está instalado em cada veículo |
| Abastecimento e quilometragem | Registro com cálculo automático, leituras de hodômetro, consumo por veículo, gastos por cidade e por mês |
| Despesas | 6 categorias, filtros (cidade, categoria, período, veículo, status), resumo por cidade e categoria, conferência/cancelamento, CSV |
| Relatórios | 10 relatórios com filtros, total, exportação CSV e versão para impressão |
| Usuários | Usuários e setores, ativação/desativação, matriz de permissões e registro de atividades |

---

## 5. Como os módulos se conectam

- Aprovar uma compra muda o status dela. O recebimento gera **entradas no estoque** (uma única vez). Uma compra rejeitada não gera entrada.
- Toda saída de estoque reduz o saldo e nunca o deixa negativo.
- Peças aplicadas em uma OS são baixadas do estoque **uma vez**, no lançamento, e aparecem também em *Peças por veículo*. Concluir a OS não gera nova baixa.
- A destinação registra a placa, o usuário do perfil ativo e a data.
- Cada abastecimento atualiza o histórico de combustível e a quilometragem do veículo e lança uma despesa de combustível.
- **Sem dupla contagem:** cada compra, OS ou abastecimento tem no máximo uma despesa ativa. A despesa de uma OS considera apenas o serviço, porque as peças já foram contabilizadas na compra.
- Abrir uma OS coloca o veículo *Em manutenção*. Concluí-la pode liberá-lo.
- Dashboard, notificações, alertas e relatórios são recalculados a cada alteração.
- As operações registram usuário, data e histórico (*Usuários → Registro de atividades*).
- Os registros se relacionam por identificadores internos (ex.: `VEI-003`, `SC-0013`, `OS-0016`, `MAT-021`), não por nomes exibidos.

---

## 6. Dados fictícios

O conjunto inicial tem 40 veículos (frota 101 a 140) em Teresina, Jatobá, Oeiras e Angical. Inclui cerca de 500 abastecimentos, 25 solicitações mecânicas, 19 ordens de serviço, 15 solicitações de compra em todas as etapas, 28 materiais (alguns abaixo do mínimo), pneus e baterias rastreáveis, destinações por placa e despesas de todas as categorias.

Os dados são gerados **relativos à data em que a demonstração é aberta ou restaurada** (cerca dos últimos 100 dias), para que filtros como "Este mês" sempre tenham conteúdo. O gerador usa as mesmas regras de negócio da interface, o que mantém saldos, despesas e históricos consistentes.

Não há CNPJ, endereço, telefone, logotipo oficial ou dado real da empresa. A marca exibida é apenas tipográfica.

---

## 7. Limitações e transparência

- **Os dados ficam só neste navegador** (LocalStorage). Não são compartilhados entre computadores nem entre navegadores, e somem se os dados do site forem limpos. Isso **não** equivale a um banco de dados de produção.
- Não há backend, autenticação real, controle de acesso seguro, integração com GPS, bancos, pagamentos, e-mail, notificações reais ou sistemas externos.
- As notificações do sino são calculadas a partir dos registros. Nenhuma mensagem é enviada.
- A fonte Inter é usada se estiver instalada no computador. Caso contrário, Segoe UI/Arial (nada é baixado da internet).

### Demonstrável hoje
Navegação completa, perfis com permissões simuladas, cadastros e edições, fluxo de aprovação de compras, estoque com movimentações e inventário, controle individual de pneus e baterias, destinação por placa, ordens de serviço integradas ao estoque, abastecimentos com consumo, despesas sem duplicidade, indicadores, alertas, relatórios com CSV e impressão, restauração dos dados.

### Depende de desenvolvimento para produção
- Backend e banco de dados central (multiusuário, sincronização entre dispositivos, backups).
- Autenticação real (login, senhas, recuperação de acesso) e permissões validadas no servidor.
- Trilha de auditoria imutável e LGPD (controle de dados pessoais).
- Anexos (notas fiscais, fotos, orçamentos) e cotações com múltiplos fornecedores.
- Estoque por múltiplos depósitos, transferências, entradas parciais e inventário cíclico.
- Integrações opcionais: telemetria/GPS, cartões de combustível, ERP/contábil, e-mail/WhatsApp.
- Aplicativo móvel ou modo offline para fiscais e oficina.
- Testes automatizados, monitoramento e hospedagem.

---

## 8. Estrutura de arquivos

```
index.html               Página única (shell da aplicação)
404.html                 Página para endereços inexistentes (publicação)
vercel.json              Cabeçalhos de segurança e noindex na Vercel
.vercelignore            Arquivos locais que não são publicados
servidor.js              Servidor local sem dependências
iniciar-demo.bat         Atalho para Windows
css/styles.css           Identidade visual, responsividade e impressão
assets/favicon.svg       Ícone da aba
js/boot.js               Aviso ao abrir o index.html direto do disco
js/app.js                Inicialização, menu, cabeçalho, perfis, notificações, restauração
js/router.js             Rotas por hash (#/pagina/identificador?filtro=valor)
js/responsivo.js         Ajuste automático de tabelas (cartões) e abas (grade) ao espaço disponível
js/storage.js            Estado em memória + LocalStorage
js/data.js               Gerador dos dados fictícios
js/constants.js          Cidades, status, categorias e rótulos
js/permissions.js        Perfis e matriz de permissões (simulação)
js/ui.js                 Modais, confirmações, avisos, formulários, tabelas, paginação
js/charts.js             Gráficos (barras em HTML e colunas em SVG)
js/icons.js              Ícones lineares em SVG
js/utils.js              Formatação, datas e exportação CSV
js/services/             Regras de negócio (uma camada só, usada pelas telas e pelo gerador)
  core.js                Usuário ativo, permissões, IDs, auditoria e transações
  frota.js               Veículos, abastecimentos e quilometragem
  manutencao.js          Solicitações e ordens de serviço
  compras.js             Compras e aprovação
  estoque.js             Materiais, movimentações, unidades rastreáveis e destinação
  despesas.js            Despesas (com regra anti-duplicidade)
  usuarios.js            Troca de perfil e ativação de usuários
  consultas.js           Indicadores, consumo, alertas e notificações
js/modules/              Uma tela por arquivo (dashboard, veiculos, manutencao, compras,
                         estoque, pecas, abastecimento, despesas, relatorios, usuarios)
```

As telas nunca alteram dados diretamente. Elas chamam `js/services/`, que valida, aplica a permissão simulada, registra o histórico e grava. Se uma validação falhar no meio de uma operação, a alteração inteira é desfeita.

---

## 9. Verificação realizada

Testes automatizados de ponta a ponta foram executados no Microsoft Edge (modo headless), clicando e preenchendo os formulários da própria interface:

- navegação das 10 páginas, ficha de veículo e links diretos (inclusive o botão Voltar);
- criação, aprovação, rejeição (motivo obrigatório), pedido, recebimento com entrada no estoque e despesa de compra, com bloqueio de recebimento duplicado, despesa duplicada e entrada de compra rejeitada;
- entrada, saída (bloqueio de saldo negativo) e ajuste de inventário, com saldos conferidos contra as movimentações;
- destinação de pneu por placa pelo segundo fiscal, com o usuário identificado automaticamente;
- abastecimento com valor calculado, bloqueio de quilometragem regressiva, atualização do km e despesa de combustível;
- OS com peça baixada uma única vez, conclusão, liberação do veículo e despesa só do serviço;
- filtros por cidade e situação no dashboard e nas despesas, CSV filtrado, 10 relatórios e totais filtrados;
- ativação e desativação de usuários, cadastro, edição e exclusão de veículos;
- persistência após recarregar e restauração dos dados iniciais;
- visualização de impressão dos relatórios.

Resultado: 44 de 44 verificações aprovadas, sem erros de JavaScript no console.

**Auditoria de responsividade:** 45 telas, abas, modais, formulários e menus foram verificados automaticamente em 25 larguras (320, 360, 390, 414, 480, 600, 667, 768, 820, 844, 900, 932, 960, 1024, 1100, 1180, 1199, 1200, 1279, 1280, 1366, 1440, 1600, 1920 e 2560 px). Nenhum elemento ultrapassa a tela, nenhuma tabela ou aba precisa de rolagem lateral e nenhum texto de botão, título ou indicador é cortado. As telas principais também foram revisadas por captura de tela em celular, tablet, notebook, desktop e celular na horizontal.
