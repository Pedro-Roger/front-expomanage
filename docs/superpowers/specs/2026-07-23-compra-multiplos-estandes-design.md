# Compra de multiplos estandes por evento

## Objetivo

Permitir que o administrador defina quantos estandes cada cliente pode comprar em um evento. O cliente pode selecionar varios estandes, inclusive de lotes diferentes, respeitando esse limite.

## Regras de negocio

- O limite de estandes e unico por cliente em cada evento.
- O limite deve ser configurado pelo administrador e precisa ser maior que zero.
- Cada lote continua definindo o preco unitario dos seus estandes.
- Todos os lotes do evento usam o mesmo plano de parcelas do evento.
- O total da compra e a soma dos precos dos estandes selecionados.
- A divisao das parcelas e aplicada proporcionalmente ao total da compra.
- O cliente pode selecionar somente estandes disponiveis do mesmo evento.
- O frontend impede selecoes acima do limite e explica o motivo.
- O backend valida novamente evento, limite e disponibilidade antes de concluir a compra.

## Administracao

O cadastro do evento tera um campo `Limite de estandes por cliente`. O plano de parcelas permanecera na configuracao geral do evento, sem repeticao em cada lote. Cada lote tera quantidade, tipo, tamanho, prefixo e preco unitario.

## Selecao publica

O mapa permitira marcar e desmarcar varios estandes. A lateral da reserva mostrara:

- quantidade selecionada e limite permitido;
- codigos dos estandes selecionados;
- valor unitario de cada estande;
- valor total da compra;
- parcelas calculadas sobre o total.

Ao atingir o limite, os demais estandes disponiveis permanecem visiveis, mas uma nova selecao sera bloqueada ate o cliente desmarcar um estande.

## Contrato e pagamento

Uma compra representa o conjunto de estandes selecionados. O contrato lista todos os codigos, tamanhos e valores. O perfil do cliente mostra o mesmo conjunto e um unico plano de pagamento para o total.

O valor de cada parcela sera calculado pela proporcao definida no plano do evento. Por exemplo, um plano de R$ 1.500 e R$ 2.000 sobre a referencia de R$ 3.500 representa as mesmas proporcoes sobre qualquer total selecionado, com ajuste de centavos na ultima parcela.

## Dados e API

- `ExpoEvent` recebe `maxStandsPerClient`.
- A criacao da compra envia `standIds` em vez de apenas `standId`.
- `ClientPurchaseProfile` armazena a lista resumida dos estandes, preservando campos legados de um estande durante a transicao.
- O backend busca todos os estandes, rejeita IDs duplicados, eventos diferentes, indisponibilidade e quantidade acima do limite.
- Depois da validacao, todos os estandes da compra passam para o estado reservado.

## Erros

- Limite ausente ou invalido: o evento nao pode ser publicado para vendas.
- Selecao acima do limite: mensagem clara sem perder os estandes ja selecionados.
- Estande indisponivel durante a conclusao: a compra nao e criada e o mapa e atualizado.
- Preco ausente: o estande nao pode ser comprado.

## Testes

- Calculo do total e das parcelas para um e varios estandes.
- Arredondamento da ultima parcela.
- Selecao e remocao no mapa ate o limite.
- Validacao do limite por cliente e evento no backend.
- Rejeicao de estandes duplicados, indisponiveis ou de eventos diferentes.
- Contrato e perfil contendo todos os estandes selecionados.
- Compatibilidade de leitura com compras antigas de um unico estande.

