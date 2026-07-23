# Mapa dinâmico e fluxo de vendas

## Objetivo

Criar uma planta interativa inspirada no mapa do Festival do Camarão, com quantidade de estandes gerada pelos lotes cadastrados pelo administrador. O mesmo cadastro define preço e parcelas por lote. A interface deve adotar a paleta laranja, azul e creme da marca.

## Escopo

### Cadastro de lotes

Cada lote terá:

- tipo;
- metragem;
- quantidade;
- prefixo de numeração;
- preço único aplicado a todos os estandes do lote;
- lista de parcelas com nome, valor e vencimento.

As parcelas continuam com a apresentação simples existente. Não haverá editor financeiro avançado nesta versão.

### Geração de estandes

Os estandes serão gerados a partir da quantidade informada em cada lote. Código, tipo, metragem, preço e plano de parcelas serão derivados do lote. A quantidade visual nunca dependerá de números fixos.

### Mapa interativo

A planta terá estrutura visual fixa e estandes dinâmicos:

- feira gastronômica no topo, com quebra automática em linhas;
- feira de negócios em duas colunas, divididas de forma equilibrada;
- praça, palco, ruas, árvores e prédios como referências decorativas;
- fallback em grade para tipos de lote que não sejam gastronômico ou de negócios.

Os botões dos estandes exibirão número e metragem. As cores semânticas continuarão indicando disponível, ocupado, reservado e selecionado. No celular, a planta preservará a ordem das áreas e permitirá leitura e seleção sem sobreposição.

## Fluxo do cliente

1. O cliente seleciona um estande disponível no mapa.
2. Preenche o formulário de interesse.
3. Ao clicar em "Enviar solicitação", a página rola suavemente até a área do contrato.
4. Os campos "Assinante" e "Documento" recebem os dados do formulário e ficam bloqueados para edição.
5. O cliente assina e aceita o contrato.
6. O contrato real é gerado antes da abertura do perfil de pagamentos.
7. O perfil mostra as parcelas do lote escolhido, mantendo o formato atual de valor, vencimento, status e envio de comprovante.

Se a geração do contrato falhar, o perfil de pagamentos não será criado com um endereço fictício. A interface exibirá uma mensagem e permitirá nova tentativa.

## Modelo de dados

O lote será a fonte do preço e do plano de parcelas. Cada estande gerado manterá um `batchId` e o preço vigente. Na assinatura, o backend localizará o lote pelo `batchId` e copiará suas parcelas para a compra, evitando que uma edição futura do lote altere compras já realizadas.

## Componentes

- `FestivalMap`: agrupa os estandes por tipo e distribui as quantidades dinamicamente.
- Cadastro de evento/lotes: edita quantidade, metragem, preço e parcelas.
- Formulário de interesse: registra os dados do cliente e inicia a transição para o contrato.
- Assinatura digital: usa os dados bloqueados do formulário e gera o contrato.
- Perfil do cliente: apresenta o plano de parcelas copiado para a compra.

## Identidade visual

A interface usará variáveis CSS centralizadas:

- laranja da marca para ações principais, títulos e destaques;
- azul da marca para links, seleção e elementos interativos secundários;
- creme da marca para fundos e superfícies;
- tom escuro quente para textos;
- verde, amarelo e vermelho reservados aos estados dos estandes e pagamentos.

A mudança será aplicada ao sistema inteiro, preservando contraste e legibilidade.

## Validação e erros

- Quantidade deve ser inteira e maior que zero.
- Preço e valores das parcelas não podem ser negativos.
- Nome e vencimento da parcela são obrigatórios.
- Estandes indisponíveis não podem ser reservados no fluxo público.
- Falha ao gerar contrato mantém o cliente na assinatura e não cria perfil inválido.
- Arquivo de contrato inexistente retorna mensagem específica, não erro genérico 500.

## Testes

- Geração de qualquer quantidade de estandes por lote.
- Divisão equilibrada dos estandes de negócios em duas colunas.
- Quebra automática dos estandes gastronômicos.
- Propagação do preço e das parcelas do lote para a compra.
- Rolagem para o contrato após envio válido.
- Preenchimento bloqueado de assinante e documento.
- Bloqueio de perfil quando o contrato não for gerado.
- Estados visuais e seleção no mapa.
- Layout responsivo em larguras de desktop e celular.

## Fora do escopo

- Editor livre com arrastar e soltar estandes.
- Upload de uma planta como fundo.
- Posicionamento manual de ruas, prédios ou áreas decorativas.
- Editor financeiro avançado ou cálculo automático de juros.
