# Mapa dinâmico e fluxo de vendas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar a planta a partir dos lotes cadastrados, aplicar preço e parcelas por lote, encaminhar o cliente ao contrato e adotar a identidade visual do Festival do Camarão.

**Architecture:** `EventStandBatch` passa a carregar um identificador, preço e plano de parcelas. A geração copia esses dados para cada `Stand`, e a compra cria uma cópia imutável das parcelas do estande selecionado. O mapa mantém referências urbanas fixas, mas distribui os estandes por quantidade e tipo sem limites numéricos fixos.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, NestJS, MongoDB/Mongoose e CSS responsivo.

---

### Task 1: Domínio de lotes e parcelas

**Files:**
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/domain.test.ts`
- Mirror: `../back-expomanage/packages/shared/src/index.ts`
- Mirror test: `../back-expomanage/packages/shared/src/domain.test.ts`

- [ ] **Step 1: Write the failing domain tests**

```ts
it("copies batch price and installments to every generated stand", () => {
  const stands = generateStandsFromBatches([{
    id: "negocios",
    quantity: 3,
    size: "3x3",
    type: "Feira de Negócios",
    prefix: "N",
    price: 4200,
    installments: [
      { label: "Entrada", amount: 1200, dueLabel: "Imediato" },
      { label: "Saldo", amount: 3000, dueLabel: "Agosto/2026" }
    ]
  }]);

  expect(stands).toHaveLength(3);
  expect(stands[2]).toMatchObject({
    batchId: "negocios",
    price: 4200,
    installments: [
      { label: "Entrada", amount: 1200, dueLabel: "Imediato" },
      { label: "Saldo", amount: 3000, dueLabel: "Agosto/2026" }
    ]
  });
});

it("uses the selected stand installment plan in the purchase", () => {
  const profile = buildPurchaseProfile({
    clientName: "Maria",
    clientEmail: "maria@example.com",
    stand: {
      id: "stand-n-01",
      code: "N-01",
      size: "3x3",
      status: "reserved",
      installments: [{ label: "Única", amount: 4200, dueLabel: "Imediato" }]
    },
    contractUrl: "s3://contracts/n-01.docx"
  });

  expect(profile.installments).toEqual([
    expect.objectContaining({ id: "installment-1", label: "Única", amount: 4200 })
  ]);
});
```

- [ ] **Step 2: Run the shared tests and verify RED**

Run in both repositories:

```bash
npm test --workspace @expomanage/shared
```

Expected: FAIL because `id`, `installments` and `batchId` are not represented or copied.

- [ ] **Step 3: Add the commercial batch types**

```ts
export interface InstallmentPlanItem {
  label: string;
  amount: number;
  dueLabel: string;
}

export interface EventStandBatch {
  id?: string;
  quantity: number;
  size: string;
  type: string;
  prefix?: string;
  price?: number;
  installments?: InstallmentPlanItem[];
}

export interface Stand {
  // existing fields
  batchId?: string;
  installments?: InstallmentPlanItem[];
}
```

Update `generateStandsFromBatches` to create a stable `batchId`, preserve an explicitly entered price, and clone the installment list. Update `buildPurchaseProfile` to use `input.stand.installments` before `defaultPaymentInstallments()`.

- [ ] **Step 4: Run tests and verify GREEN**

```bash
npm test --workspace @expomanage/shared
```

Expected: all shared tests pass in both repositories.

### Task 2: Backend purchase plan

**Files:**
- Modify: `../back-expomanage/apps/api/src/purchases/purchases.service.ts`
- Test: `../back-expomanage/apps/api/src/purchases/purchases.service.test.ts`

- [ ] **Step 1: Write the failing service test**

```ts
it("copies the selected stand batch installments into the purchase", async () => {
  const repository = new InMemoryExpoRepository();
  await repository.replaceEventStands("festival-2026", [{
    id: "stand-festival-n-01",
    eventSlug: "festival-2026",
    code: "N-01",
    size: "3x3",
    status: "reserved",
    batchId: "negocios",
    price: 4200,
    installments: [
      { label: "Entrada", amount: 1200, dueLabel: "Imediato" },
      { label: "Saldo", amount: 3000, dueLabel: "Agosto/2026" }
    ]
  }]);

  const service = new PurchasesService(repository, new FakeReceiptStorage());
  const profile = await service.createFromSignedContract({
    eventSlug: "festival-2026",
    clientName: "Maria",
    clientEmail: "maria@example.com",
    standId: "stand-festival-n-01",
    contractUrl: "s3://contracts/n-01.docx"
  });

  expect(profile.installments.map(({ label, amount }) => ({ label, amount }))).toEqual([
    { label: "Entrada", amount: 1200 },
    { label: "Saldo", amount: 3000 }
  ]);
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
npm test --workspace @expomanage/api -- src/purchases/purchases.service.test.ts
```

Expected: FAIL with the default installment values.

- [ ] **Step 3: Pass the complete stand to the shared purchase builder**

Keep the repository-loaded `stand` as the single source of batch price and installments. The shared builder clones each plan item and adds `id`, `status` and receipt state.

- [ ] **Step 4: Run the API tests and verify GREEN**

```bash
npm test --workspace @expomanage/api -- src/purchases/purchases.service.test.ts
```

Expected: all purchase tests pass.

### Task 3: Event wizard, contract transition and locked identity

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Write failing UI tests**

```tsx
it("configures price and installments for each stand batch", async () => {
  const user = userEvent.setup();
  markAdminLoggedIn();
  renderAt("/admin");

  await user.click(screen.getByRole("button", { name: "Criar evento" }));
  await user.type(screen.getByLabelText("Nome do novo evento"), "Festival 2027");
  await user.click(screen.getByRole("button", { name: "Avançar para stands" }));
  await user.clear(screen.getByLabelText("Preço lote 1"));
  await user.type(screen.getByLabelText("Preço lote 1"), "4200");
  await user.clear(screen.getByLabelText("Valor parcela 1 do lote 1"));
  await user.type(screen.getByLabelText("Valor parcela 1 do lote 1"), "1200");

  expect(screen.getByLabelText("Preço lote 1")).toHaveValue(4200);
  expect(screen.getByLabelText("Valor parcela 1 do lote 1")).toHaveValue(1200);
});

it("scrolls to a locked signature identity after submitting interest", async () => {
  const scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
  renderAt("/venda");
  // fill the existing valid interest form
  fireEvent.click(screen.getByRole("button", { name: "Enviar solicitação" }));

  expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  expect(screen.getByLabelText("Assinante")).toHaveAttribute("readOnly");
  expect(screen.getByLabelText("Documento do assinante")).toHaveAttribute("readOnly");
});
```

- [ ] **Step 2: Run the targeted tests and verify RED**

```bash
npm test --workspace @expomanage/web -- src/App.test.tsx -t "configures price|scrolls to a locked"
```

Expected: FAIL because the commercial controls, scrolling and locked values do not exist.

- [ ] **Step 3: Implement the simple batch editor**

Add price plus a compact installment editor inside each `.batch-row`. Use immutable update helpers:

```ts
function updateBatchInstallment(
  batchIndex: number,
  installmentIndex: number,
  field: keyof InstallmentPlanItem,
  value: string
) {
  setEventBatches((current) => current.map((batch, index) => index === batchIndex ? {
    ...batch,
    installments: (batch.installments ?? []).map((installment, itemIndex) =>
      itemIndex === installmentIndex
        ? { ...installment, [field]: field === "amount" ? Number(value) : value }
        : installment
    )
  } : batch));
}
```

Default each standard lot to two editable installments. Add and remove installment buttons without an advanced financial calculator.

- [ ] **Step 4: Implement the contract transition**

Attach a `ref` to the signature section. After a valid `submitInterest`, call:

```ts
window.requestAnimationFrame(() => {
  signatureSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
});
```

Bind `signerName` and `signerDocument` to `clientDraft`, mark both fields `readOnly`, and prevent edits.

- [ ] **Step 5: Run the UI tests and verify GREEN**

```bash
npm test --workspace @expomanage/web -- src/App.test.tsx
```

Expected: all web tests pass.

### Task 4: Dynamic map and Festival identity

**Files:**
- Modify: `apps/web/src/FestivalMap.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Write failing dynamic-map assertions**

Add a component-level assertion through the public map using six business stands:

```tsx
expect(within(screen.getByLabelText("Coluna esquerda da Feira de Negócios")).getAllByRole("button")).toHaveLength(3);
expect(within(screen.getByLabelText("Coluna direita da Feira de Negócios")).getAllByRole("button")).toHaveLength(3);
```

Use an odd quantity and assert the difference between columns is at most one.

- [ ] **Step 2: Run and verify RED**

```bash
npm test --workspace @expomanage/web -- src/App.test.tsx -t "distributes any business stand quantity"
```

Expected: FAIL because `groupStands` splits at the hard-coded stand number 40.

- [ ] **Step 3: Replace the hard-coded split**

```ts
const midpoint = Math.ceil(business.length / 2);
const businessLeft = business.slice(0, midpoint).reverse();
const businessRight = business.slice(midpoint);
```

Add accessible labels to both columns. Keep the gastronomic grid auto-wrapping at five columns on desktop and fewer columns on narrow screens.

- [ ] **Step 4: Apply centralized brand tokens**

Replace the root palette with:

```css
:root {
  --primary: #e84f20;
  --primary-deep: #bd3817;
  --tertiary: #078fc4;
  --brand-cream: #fbf0df;
  --neutral: #fffaf2;
  --ink: #35251f;
  --secondary: #684a3e;
  --muted: #856f64;
  --line: #ead7c3;
  --selected: #078fc4;
}
```

Update page backgrounds, top bar, cards, primary actions, active navigation, map header and selection treatment to use the tokens. Preserve green, amber and red semantic status colors.

- [ ] **Step 5: Run tests and build**

```bash
npm test
npm run build
```

Expected: 0 failed tests and a successful Vite production build.

### Task 5: Final verification and publication

**Files:**
- Verify all modified files in `front-expomanage`
- Verify all modified files in `back-expomanage`

- [ ] **Step 1: Run complete backend checks**

```bash
npm test
npm run build
git diff --check
```

Expected: all API/shared tests pass, TypeScript build exits 0, and no whitespace errors.

- [ ] **Step 2: Run complete frontend checks**

```bash
npm test
npm run build
git diff --check
```

Expected: all web/shared tests pass, Vite build exits 0, and no whitespace errors.

- [ ] **Step 3: Review scope**

Use `git status -sb` and `git diff --stat` in each repository. Confirm the frontend commit includes the approved design, plan, UI and prior requested CNPJ/empty-state changes. Confirm the backend commit includes domain, contract-download and CNPJ lookup changes.

- [ ] **Step 4: Commit frontend and backend separately**

```bash
git add <explicit frontend paths>
git commit -m "feat: add dynamic festival sales flow"

git add <explicit backend paths>
git commit -m "feat: support dynamic stand sales"
```

- [ ] **Step 5: Push both repositories**

```bash
git push origin main
```

Expected: both `main` branches are synchronized with their `origin/main`.
