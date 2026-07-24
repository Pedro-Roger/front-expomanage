# Compra de multiplos estandes por evento

## Objetivo

Permitir que o administrador defina quantos estandes cada cliente pode comprar em um evento. O cliente pode selecionar varios estandes, inclusive de lotes diferentes, respeitando esse limite.

## Regras de negocio

- O limite de estandes e unico por cliente em cada evento.
- O limite deve ser configurado pelo administrador e precisa ser maior que zero.
- O administrador define um unico preco por estande para o evento.
- O administrador informa a quantidade de parcelas e o valor exato de cada parcela.
- A soma das parcelas deve ser igual ao preco de um estande.
- Todos os lotes do evento usam o mesmo preco e o mesmo plano de parcelas.
- O total da compra e o preco do estande multiplicado pela quantidade selecionada.
- Cada parcela tambem e multiplicada pela quantidade de estandes selecionados.
- O cliente pode selecionar somente estandes disponiveis do mesmo evento.
- O frontend impede selecoes acima do limite e explica o motivo.
- O backend valida novamente evento, limite e disponibilidade antes de concluir a compra.

## Administracao

O cadastro do evento tera os campos `Limite de estandes por cliente` e `Preco por estande`. O plano de parcelas permanecera na configuracao geral do evento, com nome, valor e vencimento de cada parcela. Cada lote tera apenas quantidade, tipo, tamanho e prefixo.

## Selecao publica

O mapa permitira marcar e desmarcar varios estandes. A lateral da reserva mostrara:

- quantidade selecionada e limite permitido;
- codigos dos estandes selecionados;
- preco unico por estande;
- valor total da compra;
- parcelas multiplicadas pela quantidade selecionada.

Ao atingir o limite, os demais estandes disponiveis permanecem visiveis, mas uma nova selecao sera bloqueada ate o cliente desmarcar um estande.

## Contrato e pagamento

Uma compra representa o conjunto de estandes selecionados. O contrato lista todos os codigos, tamanhos, quantidade e valor total. O perfil do cliente mostra o mesmo conjunto e um unico plano de pagamento.

Por exemplo, com preco unitario de R$ 3.500 e parcelas de R$ 1.500 e R$ 2.000:

- um estande gera parcelas de R$ 1.500 e R$ 2.000;
- dois estandes geram parcelas de R$ 3.000 e R$ 4.000;
- tres estandes geram parcelas de R$ 4.500 e R$ 6.000.

## Dados e API

- `ExpoEvent` recebe `maxStandsPerClient` e `standPrice`.
- A criacao da compra envia `standIds` em vez de apenas `standId`.
- `ClientPurchaseProfile` armazena a lista resumida dos estandes, preservando campos legados de um estande durante a transicao.
- O backend busca todos os estandes, rejeita IDs duplicados, eventos diferentes, indisponibilidade e quantidade acima do limite.
- O backend multiplica cada valor do plano de parcelas pela quantidade de estandes.
- Depois da validacao, todos os estandes da compra passam para o estado reservado.

## Erros

- Limite ausente ou invalido: o evento nao pode ser publicado para vendas.
- Soma das parcelas diferente do preco unitario: a configuracao nao pode ser salva.
- Selecao acima do limite: mensagem clara sem perder os estandes ja selecionados.
- Estande indisponivel durante a conclusao: a compra nao e criada e o mapa e atualizado.
- Preco ausente: o estande nao pode ser comprado.

## Testes

- Calculo do total e multiplicacao das parcelas para um e varios estandes.
- Validacao da soma das parcelas contra o preco unitario.
- Selecao e remocao no mapa ate o limite.
- Validacao do limite por cliente e evento no backend.
- Rejeicao de estandes duplicados, indisponiveis ou de eventos diferentes.
- Contrato e perfil contendo todos os estandes selecionados.
- Compatibilidade de leitura com compras antigas de um unico estande.
