# Compra de Multiplos Estandes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o administrador defina preco, parcelas e limite por cliente no evento, enquanto o cliente compra varios estandes e todos os valores sao multiplicados pela quantidade.

**Architecture:** A configuracao comercial fica em `ExpoEvent` e `EventPaymentConfig`; os lotes geram apenas quantidade e formato. A compra passa a carregar uma lista de estandes, mas preserva o primeiro estande no campo legado para leitura de registros antigos. Frontend e backend validam o limite, enquanto o backend e a fonte final de verdade para disponibilidade, quantidade acumulada por cliente e valores.

**Tech Stack:** TypeScript, React, Vitest, Testing Library, NestJS, MongoDB repository abstraction, JSZip.

---

### Task 1: Modelo compartilhado e calculo da compra

**Files:**
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/domain.test.ts`
- Mirror: `../back-expomanage/packages/shared/src/index.ts`
- Mirror: `../back-expomanage/packages/shared/src/domain.test.ts`

- [ ] **Step 1: Escrever testes que falham para configuracao e multiplicacao**

Adicionar casos que constroem uma compra com dois estandes e verificam:

```ts
expect(profile.stands.map((stand) => stand.code)).toEqual(["N-01", "N-02"]);
expect(profile.quantity).toBe(2);
expect(profile.unitPrice).toBe(3500);
expect(profile.totalAmount).toBe(7000);
expect(profile.installments.map((item) => item.amount)).toEqual([3000, 4000]);
```

Adicionar validacao pura da configuracao:

```ts
expect(validateEventSalesConfig({
  standPrice: 3500,
  maxStandsPerClient: 3,
  installments: [
    { label: "1ª parcela", amount: 1500, dueLabel: "Imediato" },
    { label: "2ª parcela", amount: 2000, dueLabel: "Agosto/2026" }
  ]
})).toEqual([]);
```

- [ ] **Step 2: Executar os testes e confirmar a falha**

Run: `npm test --workspace @expomanage/shared`

Expected: FAIL porque `stands`, `quantity`, `unitPrice`, `totalAmount` e `validateEventSalesConfig` ainda nao existem.

- [ ] **Step 3: Implementar os tipos e funcoes compartilhadas**

Adicionar:

```ts
export interface ExpoEvent {
  slug: string;
  name: string;
  year?: number;
  standPrice?: number;
  maxStandsPerClient?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClientPurchaseProfile {
  // campos existentes
  stand: Pick<Stand, "id" | "code" | "size">;
  stands: Array<Pick<Stand, "id" | "code" | "size">>;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}
```

Alterar `PurchaseProfileInput` para aceitar `stands`, `standPrice` e `installments`. Em `buildPurchaseProfile`, usar o primeiro estande no campo legado, multiplicar cada parcela por `stands.length` e produzir um ID estavel com os IDs selecionados.

Implementar:

```ts
export function validateEventSalesConfig(input: {
  standPrice?: number;
  maxStandsPerClient?: number;
  installments: InstallmentPlanItem[];
}): string[] {
  const errors: string[] = [];
  if (!(Number(input.standPrice) > 0)) errors.push("Informe o preço por estande.");
  if (!(Number(input.maxStandsPerClient) > 0)) errors.push("Informe o limite de estandes por cliente.");
  const installmentTotal = input.installments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  if (Math.abs(installmentTotal - Number(input.standPrice || 0)) > 0.009) {
    errors.push("A soma das parcelas deve ser igual ao preço do estande.");
  }
  return errors;
}
```

- [ ] **Step 4: Espelhar o pacote shared e executar os testes**

Run:

```bash
npm test --workspace @expomanage/shared
cd ../back-expomanage
npm test --workspace @expomanage/shared
```

Expected: PASS nos dois pacotes.

- [ ] **Step 5: Commitar o dominio em cada repositorio**

```bash
git add packages/shared/src/index.ts packages/shared/src/domain.test.ts
git commit -m "feat: model multi-stand purchases"
cd ../back-expomanage
git add packages/shared/src/index.ts packages/shared/src/domain.test.ts
git commit -m "feat: model multi-stand purchases"
```

### Task 2: Configuracao comercial central do evento

**Files:**
- Modify: `../back-expomanage/apps/api/src/events/events.controller.ts`
- Modify: `../back-expomanage/apps/api/src/events/events.service.ts`
- Modify: `../back-expomanage/apps/api/src/stands/stands.service.ts`
- Test: `../back-expomanage/apps/api/src/api.test.ts`
- Test: `../back-expomanage/apps/api/src/events/events.service.test.ts`

- [ ] **Step 1: Escrever testes de configuracao que falham**

Cobrir:

```ts
await expect(service.upsert({
  name: "Festival 2026",
  standPrice: 3500,
  maxStandsPerClient: 3
})).resolves.toMatchObject({ standPrice: 3500, maxStandsPerClient: 3 });
```

E rejeitar preco/parcelas divergentes no salvamento do pagamento:

```ts
await expect(service.upsertPaymentConfig("festival-2026", {
  pixCopyPaste: "PIX",
  installments: [
    { label: "1ª parcela", amount: 1000, dueLabel: "Imediato" },
    { label: "2ª parcela", amount: 2000, dueLabel: "Agosto/2026" }
  ]
})).rejects.toThrow("A soma das parcelas deve ser igual ao preço do estande.");
```

- [ ] **Step 2: Executar os testes e confirmar a falha**

Run: `npm test --workspace @expomanage/api -- src/events/events.service.test.ts`

Expected: FAIL porque o evento ainda nao persiste nem valida a configuracao comercial.

- [ ] **Step 3: Implementar persistencia, endpoint publico e geracao**

Expandir o input de evento para `standPrice` e `maxStandsPerClient`, validando numeros positivos. Adicionar:

```ts
@Get(":slug")
getBySlug(@Param("slug") slug: string) {
  return this.events.getBySlug(slug);
}
```

Antes de gerar estandes, carregar evento e plano de parcelas e aplicar a todos os lotes:

```ts
const configuredBatches = batches.map((batch) => ({
  ...batch,
  price: event.standPrice,
  installments: paymentConfig.installments
}));
return this.stands.generateForEvent(eventSlug, configuredBatches);
```

Salvar primeiro evento e pagamento; somente depois gerar os estandes.

- [ ] **Step 4: Executar testes de evento e API**

Run: `npm test --workspace @expomanage/api -- src/events/events.service.test.ts src/api.test.ts`

Expected: PASS.

- [ ] **Step 5: Commitar configuracao do evento**

```bash
git add apps/api/src/events apps/api/src/stands/stands.service.ts apps/api/src/api.test.ts
git commit -m "feat: centralize event sales configuration"
```

### Task 3: Compra multipla, limite acumulado e contrato

**Files:**
- Modify: `../back-expomanage/apps/api/src/purchases/purchases.types.ts`
- Modify: `../back-expomanage/apps/api/src/purchases/purchases.service.ts`
- Modify: `../back-expomanage/apps/api/src/purchases/purchases.service.test.ts`
- Modify: `../back-expomanage/apps/api/src/contracts/contracts.types.ts`
- Modify: `../back-expomanage/apps/api/src/contracts/contracts.service.ts`
- Modify: `../back-expomanage/apps/api/src/contracts/contracts.service.test.ts`

- [ ] **Step 1: Escrever testes de compra multipla que falham**

Usar:

```ts
const profile = await service.createFromSignedContract({
  eventSlug: "festival-2026",
  clientName: "Maria",
  clientEmail: "maria@example.com",
  clientDocument: "12345678000199",
  standIds: ["stand-n-01", "stand-n-02"],
  contractUrl: "s3://contracts/maria.docx"
});

expect(profile.totalAmount).toBe(7000);
expect(profile.installments.map((item) => item.amount)).toEqual([3000, 4000]);
```

Adicionar testes para IDs duplicados, estande indisponivel, eventos diferentes e soma da quantidade ja comprada acima de `maxStandsPerClient`.

- [ ] **Step 2: Executar testes e confirmar a falha**

Run: `npm test --workspace @expomanage/api -- src/purchases/purchases.service.test.ts`

Expected: FAIL porque a API aceita somente `standId`.

- [ ] **Step 3: Implementar validacao e reserva em conjunto**

Alterar o input:

```ts
export interface CreatePurchaseInput {
  eventSlug?: string;
  clientName: string;
  clientEmail: string;
  clientDocument?: string;
  standIds: string[];
  contractUrl: string;
}
```

No service:

```ts
const uniqueIds = [...new Set(input.standIds)];
if (uniqueIds.length !== input.standIds.length) {
  throw new BadRequestException("Não repita estandes na mesma compra.");
}
```

Buscar todos os estandes, validar `available`, mesmo evento e limite acumulado das compras do documento. Construir o perfil com `standPrice` e `paymentConfig.installments`; depois atualizar todos os estandes para `reserved`.

- [ ] **Step 4: Adaptar contrato para varios estandes**

Aceitar:

```ts
stands: Array<{ code: string; size: string; area?: number }>;
```

Substituir os campos do modelo por codigos e tamanhos unidos por virgula e incluir no comprovante textual:

```ts
`Estandes: ${input.stands.map((stand) => stand.code).join(", ")}.`,
`Quantidade: ${input.stands.length}.`
```

Manter leitura de `stand` legado convertendo-o internamente para uma lista de um item.

- [ ] **Step 5: Executar testes de compras e contratos**

Run: `npm test --workspace @expomanage/api -- src/purchases/purchases.service.test.ts src/contracts/contracts.service.test.ts`

Expected: PASS.

- [ ] **Step 6: Commitar backend da compra multipla**

```bash
git add apps/api/src/purchases apps/api/src/contracts
git commit -m "feat: create multi-stand purchases"
```

### Task 4: Administracao simplificada no frontend

**Files:**
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Escrever teste do wizard que falha**

No teste de criacao de evento, preencher:

```ts
fireEvent.change(screen.getByLabelText("Preço por estande"), { target: { value: "3500" } });
fireEvent.change(screen.getByLabelText("Limite de estandes por cliente"), { target: { value: "3" } });
fireEvent.change(screen.getByLabelText("Valor da 1ª parcela"), { target: { value: "1500" } });
fireEvent.change(screen.getByLabelText("Valor da 2ª parcela"), { target: { value: "2000" } });
```

Verificar que o POST de evento envia `standPrice: 3500` e `maxStandsPerClient: 3`, enquanto os lotes nao enviam preco ou parcelas.

- [ ] **Step 2: Executar o teste e confirmar a falha**

Run: `npm test --workspace @expomanage/web -- src/App.test.tsx -t "configura preço e limite por evento"`

Expected: FAIL porque preco e parcelas ainda ficam nos lotes.

- [ ] **Step 3: Implementar o formulario central**

Adicionar estados `eventStandPrice` e `eventMaxStandsPerClient`. Remover controles de preco e parcelas de cada `.batch-row`; colocar no passo de pagamento:

```tsx
<label>
  Preço por estande
  <input type="number" min="0.01" step="0.01" value={eventStandPrice} />
</label>
<label>
  Limite de estandes por cliente
  <input type="number" min="1" step="1" value={eventMaxStandsPerClient} />
</label>
```

Manter o editor simples das parcelas na configuracao do evento e bloquear o salvamento quando a soma for diferente do preco.

- [ ] **Step 4: Atualizar cliente da API e ordem de salvamento**

`upsertEvent` envia os novos campos. No submit: salvar evento, salvar pagamento e depois gerar lotes. Para a previa local, aplicar o preco e as parcelas do evento aos lotes somente na chamada de `generateStandsFromBatches`.

- [ ] **Step 5: Executar os testes do wizard**

Run: `npm test --workspace @expomanage/web -- src/App.test.tsx -t "evento"`

Expected: PASS.

- [ ] **Step 6: Commitar administracao do frontend**

```bash
git add apps/web/src/api.ts apps/web/src/App.tsx apps/web/src/App.test.tsx apps/web/src/styles.css
git commit -m "feat: configure event purchase limits"
```

### Task 5: Selecao multipla e valores no frontend

**Files:**
- Modify: `apps/web/src/FestivalMap.tsx`
- Modify: `apps/web/src/FestivalMap.test.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Escrever testes de selecao que falham**

Cobrir selecao, remocao e limite:

```ts
fireEvent.click(screen.getByRole("button", { name: /Disponível N-01/ }));
fireEvent.click(screen.getByRole("button", { name: /Disponível N-02/ }));
expect(screen.getByText("2 de 3 estandes selecionados")).toBeInTheDocument();
expect(screen.getByText("Total: R$ 7.000,00")).toBeInTheDocument();
expect(screen.getByText("1ª parcela: R$ 3.000,00")).toBeInTheDocument();
expect(screen.getByText("2ª parcela: R$ 4.000,00")).toBeInTheDocument();
```

Selecionar um quarto estande e esperar a mensagem `Você pode comprar até 3 estandes neste evento.` sem perder os tres anteriores.

- [ ] **Step 2: Executar testes e confirmar a falha**

Run: `npm test --workspace @expomanage/web -- src/App.test.tsx src/FestivalMap.test.tsx`

Expected: FAIL porque o mapa aceita um unico `selectedStandId`.

- [ ] **Step 3: Tornar o mapa multi-selecao**

Trocar a prop por:

```ts
selectedStandIds: string[];
```

Em `App`, usar `selectedStandIds` e alternar IDs sem reservar imediatamente. Limpar assinatura e cadastro quando a composicao da selecao mudar. Exibir quantidade, codigos, preco unitario, total e parcelas multiplicadas.

- [ ] **Step 4: Adaptar assinatura, contrato e compra**

Usar todos os estandes selecionados no contrato:

```ts
stands: selectedSellableStands.map(({ code, size, area }) => ({ code, size, area }))
```

E na compra:

```ts
standIds: selectedSellableStands.map((stand) => stand.id)
```

O perfil local deve chamar `buildPurchaseProfile` com a lista completa, preco do evento e plano de parcelas.

- [ ] **Step 5: Atualizar perfil do cliente e administracao**

Exibir codigos unidos por virgula, quantidade e total. Para compras antigas sem `stands`, usar `[purchase.stand]`. Manter upload e confirmacao de comprovantes sem alteracao.

- [ ] **Step 6: Executar a suite do frontend**

Run: `npm test`

Expected: 100% dos testes PASS.

- [ ] **Step 7: Commitar fluxo publico**

```bash
git add apps/web/src/FestivalMap.tsx apps/web/src/FestivalMap.test.tsx apps/web/src/App.tsx apps/web/src/App.test.tsx apps/web/src/api.ts apps/web/src/styles.css
git commit -m "feat: allow multi-stand event purchases"
```

### Task 6: Verificacao integrada e publicacao

**Files:**
- Verify: all modified files in `front-expomanage`
- Verify: all modified files in `back-expomanage`

- [ ] **Step 1: Executar verificacao completa do frontend**

Run: `git diff --check && npm test && npm run build`

Expected: diff limpo, testes PASS e build Vite concluido.

- [ ] **Step 2: Executar verificacao completa do backend**

Run: `git diff --check && npm test && npm run build`

Expected: diff limpo, testes PASS e build TypeScript concluido.

- [ ] **Step 3: Revisar compatibilidade**

Confirmar em testes que compras antigas com apenas `stand` continuam aparecendo, que o backend rejeita excesso acumulado por documento/evento e que nenhum estande e reservado antes da compra ser criada.

- [ ] **Step 4: Conferir estado e historico**

Run: `git status --short && git log -5 --oneline`

Expected: somente alteracoes planejadas ou repositorios limpos apos os commits.

- [ ] **Step 5: Enviar os repositorios quando autorizado**

```bash
git push origin main
cd ../back-expomanage
git push origin main
```

Expected: `main -> main` nos dois repositorios.

