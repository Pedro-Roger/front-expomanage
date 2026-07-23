import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildPurchaseProfile,
  defaultPaymentInstallments,
  sampleStands,
  type ClientPurchaseProfile
} from "@expomanage/shared";
import { App } from "./App";

afterEach(() => {
  window.history.pushState({}, "", "/");
  window.sessionStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("ExpoManage web app", () => {
  it("renders the login page as the initial route", () => {
    renderAt("/");

    expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cliente CNPJ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar como admin" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar com CNPJ" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Reserva de Estandes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Dashboard Administrativo" })).not.toBeInTheDocument();
  });

  it("logs the admin in with email and password before showing the dashboard", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "http://api.test/auth/login" && init?.method === "POST") {
        return jsonResponse({ token: "admin-token" });
      }

      if (url === "http://api.test/stands") {
        return jsonResponse(sampleStands);
      }

      if (url === "http://api.test/purchases") {
        return jsonResponse([]);
      }

      return jsonResponse({ message: `Unexpected ${url}` }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/");

    fireEvent.change(screen.getByLabelText("E-mail do admin"), { target: { value: "admin@expomanage.local" } });
    fireEvent.change(screen.getByLabelText("Senha do admin"), { target: { value: "admin123" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar como admin" }));

    await screen.findByRole("heading", { name: "Dashboard Administrativo" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/auth/login",
      expect.objectContaining({ method: "POST" })
    );
    expect(screen.queryByRole("heading", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("logs out from the admin dashboard", async () => {
    markAdminLoggedIn();
    renderAt("/admin");

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(window.sessionStorage.getItem("expomanage.adminSession")).toBeNull();
    expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Dashboard Administrativo" })).not.toBeInTheDocument();
  });

  it("logs a company client in with CNPJ and shows its payment profile", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    const profile = buildPurchaseProfile({
      clientName: "Bruno Eventos LTDA",
      clientEmail: "contato@brunoeventos.com",
      clientDocument: "12345678000199",
      stand: { ...sampleStands[2], status: "reserved" },
      contractUrl: "https://lc-web-quero.s3.us-east-2.amazonaws.com/contracts/contract-C-02.docx"
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "http://api.test/stands") {
        return jsonResponse(sampleStands);
      }

      if (url === "http://api.test/purchases/client/12345678000199/profiles") {
        return jsonResponse([profile]);
      }

      return jsonResponse({ message: `Unexpected ${url}` }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/");

    fireEvent.change(screen.getByLabelText("CNPJ do cliente"), { target: { value: "12.345.678/0001-99" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar com CNPJ" }));

    const clientProfile = await screen.findByLabelText("Perfil do Cliente");
    expect(within(clientProfile).getByText("Bruno Eventos LTDA")).toBeInTheDocument();
    expect(within(clientProfile).getByText("C-02 · 64m²")).toBeInTheDocument();
  });

  it("lets a CNPJ client choose between purchases from simultaneous events", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    const festivalProfile = buildPurchaseProfile({
      eventSlug: "festival-camarao-2026",
      clientName: "Bruno Eventos LTDA",
      clientEmail: "contato@brunoeventos.com",
      clientDocument: "12345678000199",
      stand: { id: "stand-festival-n-01", code: "N-01", size: "3x3", status: "reserved" },
      contractUrl: "s3://contracts/festival.docx"
    });
    const feiraProfile = buildPurchaseProfile({
      eventSlug: "feira-negocios-2026",
      clientName: "Bruno Eventos LTDA",
      clientEmail: "contato@brunoeventos.com",
      clientDocument: "12345678000199",
      stand: { id: "stand-feira-g-02", code: "G-02", size: "Barraca", status: "reserved" },
      contractUrl: "s3://contracts/feira.docx"
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "http://api.test/purchases/client/12345678000199/profiles") {
        return jsonResponse([festivalProfile, feiraProfile]);
      }

      return jsonResponse({ message: `Unexpected ${url}` }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/");

    fireEvent.change(screen.getByLabelText("CNPJ do cliente"), { target: { value: "12.345.678/0001-99" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar com CNPJ" }));

    const chooser = await screen.findByLabelText("Compras do Cliente");
    expect(within(chooser).getByRole("heading", { name: "Escolha o evento" })).toBeInTheDocument();
    expect(within(chooser).getByRole("button", { name: "Abrir festival-camarao-2026 N-01 3x3" })).toBeInTheDocument();
    fireEvent.click(within(chooser).getByRole("button", { name: "Abrir feira-negocios-2026 G-02 Barraca" }));

    const clientProfile = await screen.findByLabelText("Perfil do Cliente");
    expect(within(clientProfile).getByText("G-02 · Barraca")).toBeInTheDocument();
  });

  it("logs out from the client profile", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    const profile = buildPurchaseProfile({
      clientName: "Bruno Eventos LTDA",
      clientEmail: "contato@brunoeventos.com",
      clientDocument: "12345678000199",
      stand: { ...sampleStands[2], status: "reserved" },
      contractUrl: "https://lc-web-quero.s3.us-east-2.amazonaws.com/contracts/contract-C-02.docx"
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input) === "http://api.test/purchases/client/12345678000199/profiles"
          ? jsonResponse([profile])
          : jsonResponse(sampleStands)
      )
    );
    renderAt("/");

    fireEvent.change(screen.getByLabelText("CNPJ do cliente"), { target: { value: "12.345.678/0001-99" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar com CNPJ" }));
    await screen.findByLabelText("Perfil do Cliente");
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Perfil do Cliente")).not.toBeInTheDocument();
  });

  it("renders only the public sales flow on the client route", () => {
    renderAt("/venda");

    expect(screen.getByRole("heading", { name: "ExpoManage" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reserva de Estandes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Login" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("button", { name: "Prosseguir" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Dashboard Administrativo" })).not.toBeInTheDocument();
  });

  it("renders only the admin dashboard on the admin route", () => {
    markAdminLoggedIn();
    renderAt("/admin");

    expect(screen.getByText("ExpoManage")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dashboard Administrativo" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Meus eventos" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: "Solicitações Recebidas" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerenciar stands" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Reserva de Estandes" })).not.toBeInTheDocument();
  });

  it("shows simultaneous events for the admin to manage separately", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    markAdminLoggedIn();
    const festivalStands = [{ ...sampleStands[2], eventSlug: "festival-camarao-2026" }];
    const feiraStands = [{ ...sampleStands[5], eventSlug: "feira-negocios-2026" }];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "http://api.test/auth/login") {
        return jsonResponse({ token: "admin-token" });
      }

      if (url === "http://api.test/events") {
        return jsonResponse([
          { slug: "festival-camarao-2026", name: "Festival do Camarão 2026", year: 2026 },
          { slug: "feira-negocios-2026", name: "Feira de Negócios 2026", year: 2026 }
        ]);
      }

      if (url === "http://api.test/stands?eventSlug=festival-camarao-2026") {
        return jsonResponse(festivalStands);
      }

      if (url === "http://api.test/stands?eventSlug=feira-negocios-2026") {
        return jsonResponse(feiraStands);
      }

      if (url === "http://api.test/purchases?eventSlug=festival-camarao-2026" || url === "http://api.test/purchases?eventSlug=feira-negocios-2026") {
        return jsonResponse([]);
      }

      if (url === "http://api.test/events/festival-camarao-2026/payment-config" || url === "http://api.test/events/feira-negocios-2026/payment-config") {
        return jsonResponse({
          eventSlug: url.includes("festival") ? "festival-camarao-2026" : "feira-negocios-2026",
          pixCopyPaste: "PIX-EVENTO",
          installments: defaultPaymentInstallments()
        });
      }

      return jsonResponse({ message: `Unexpected ${url}` }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/admin");

    const eventsPanel = await screen.findByLabelText("Eventos cadastrados");
    expect(within(eventsPanel).getByText("Festival do Camarão 2026")).toBeInTheDocument();
    fireEvent.click(within(eventsPanel).getByRole("button", { name: "Gerenciar Feira de Negócios 2026" }));

    const eventManager = await screen.findByLabelText("Gerenciamento de Feira de Negócios 2026");
    await waitFor(() => expect(within(eventManager).getByDisplayValue("feira-negocios-2026")).toBeInTheDocument());
    expect(screen.getAllByText("Feira de Negócios 2026").length).toBeGreaterThan(0);
    expect(within(eventManager).getByRole("button", { name: "Inativar evento" })).toBeInTheDocument();
  });

  it("deletes an event through the admin API before removing it from the list", async () => {
    const user = userEvent.setup();
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    markAdminLoggedIn();
    let deletedEvent = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url === "http://api.test/auth/login" && method === "POST") {
        return jsonResponse({ token: "admin-token" });
      }

      if (url === "http://api.test/events" && method === "GET") {
        const apiEvents = [
          { slug: "expo-fortaleza-2026", name: "Expo Fortaleza 2026", year: 2026 },
          { slug: "evento-temporario-2027", name: "Evento Temporário 2027", year: 2027 }
        ];
        return jsonResponse(deletedEvent ? apiEvents.slice(0, 1) : apiEvents);
      }

      if (url === "http://api.test/stands?eventSlug=expo-fortaleza-2026" || url === "http://api.test/stands?eventSlug=evento-temporario-2027") {
        return jsonResponse(sampleStands);
      }

      if (url === "http://api.test/purchases?eventSlug=expo-fortaleza-2026" || url === "http://api.test/purchases?eventSlug=evento-temporario-2027") {
        return jsonResponse([]);
      }

      if (url === "http://api.test/events/expo-fortaleza-2026/payment-config" || url === "http://api.test/events/evento-temporario-2027/payment-config") {
        return jsonResponse({
          eventSlug: url.includes("temporario") ? "evento-temporario-2027" : "expo-fortaleza-2026",
          pixCopyPaste: "PIX-EVENTO",
          installments: defaultPaymentInstallments()
        });
      }

      if (url === "http://api.test/events/evento-temporario-2027" && method === "DELETE") {
        expect(init?.headers).toEqual(expect.any(Headers));
        deletedEvent = true;
        return jsonResponse({ deleted: true, slug: "evento-temporario-2027" });
      }

      return jsonResponse({ message: `Unexpected ${method} ${url}` }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/admin");

    const eventsPanel = await screen.findByLabelText("Eventos cadastrados");
    await user.click(within(eventsPanel).getByRole("button", { name: "Gerenciar Evento Temporário 2027" }));
    await user.click(await screen.findByRole("button", { name: "Excluir evento" }));
    await user.click(screen.getByRole("button", { name: "Meus eventos" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/events/evento-temporario-2027",
      expect.objectContaining({ method: "DELETE" })
    );
    await waitFor(() => expect(screen.queryByText("Evento Temporário 2027")).not.toBeInTheDocument());
  });

  it("filters public stands by available status", async () => {
    const user = userEvent.setup();
    renderAt("/venda");

    await user.selectOptions(screen.getByLabelText("Status público"), "available");

    const publicList = screen.getByLabelText("Lista de Estandes - Público");
    expect(within(publicList).getByText("C-02")).toBeInTheDocument();
    expect(within(publicList).queryByText("A-04")).not.toBeInTheDocument();
  });

  it("blocks interest action for sold stands", () => {
    renderAt("/venda");

    expect(screen.getByRole("button", { name: "Vendido A-04 18m²" })).toBeDisabled();
  });

  it("reserves the stand immediately when the client selects it", async () => {
    const user = userEvent.setup();
    renderAt("/venda");

    await user.click(screen.getByRole("button", { name: "Disponível C-02 64m² selecionado" }));

    expect(screen.getByText("C-02 reservado temporariamente para este cadastro.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reservado C-02 64m² selecionado" })).toBeInTheDocument();
  });

  it("shows validation feedback before submitting interest", async () => {
    const user = userEvent.setup();
    renderAt("/venda");

    await user.click(screen.getByRole("button", { name: "Enviar solicitação" }));

    expect(screen.getByText("Informe nome completo ou razão social.")).toBeInTheDocument();
    expect(screen.getByText("Informe um telefone.")).toBeInTheDocument();
  });

  it("auto-fills company name when a valid CNPJ is entered", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "http://api.test/stands") {
        return jsonResponse(sampleStands);
      }

      if (url === "http://api.test/cnpj/07206816000115") {
        return jsonResponse({
          cnpj: "07206816000115",
          legalName: "PEDRO ROGER EVENTOS LTDA",
          address: "AVENIDA BEIRA MAR, 100"
        });
      }

      return jsonResponse({ message: `Unexpected ${url}` }, 500);
    });
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/venda");

    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "cnpj" } });
    fireEvent.change(screen.getByLabelText("Documento"), { target: { value: "07.206.816/0001-15" } });

    await waitFor(() =>
      expect(screen.getByLabelText("Nome completo ou razão social")).toHaveValue("PEDRO ROGER EVENTOS LTDA")
    );
    expect(screen.getByText("Dados do CNPJ preenchidos automaticamente.")).toBeInTheDocument();
  });

  it("renders admin stand status labels without an old lead queue", () => {
    markAdminLoggedIn();
    renderAt("/admin");

    fireEvent.click(screen.getByRole("button", { name: "Gerenciar stands" }));
    const standsAdmin = screen.getByLabelText("Gestão de Estandes - Admin");

    expect(within(standsAdmin).getAllByText("Vendido").length).toBeGreaterThan(0);
    expect(within(standsAdmin).getAllByText("Disponível").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Solicitações Recebidas - Admin")).not.toBeInTheDocument();
  });

  it("keeps admin payment confirmation disabled until a receipt exists", async () => {
    markAdminLoggedIn();
    const purchase = buildPurchaseProfile({
      clientName: "Pedro Roger",
      clientEmail: "pedro@example.com",
      clientDocument: "12345678000199",
      stand: { ...sampleStands[2], status: "reserved" },
      contractUrl: "https://lc-web-quero.s3.us-east-2.amazonaws.com/contracts/contract-C-02.docx"
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.endsWith("/stands")) {
          return jsonResponse(sampleStands);
        }

        if (url.endsWith("/purchases")) {
          return jsonResponse([purchase]);
        }

        return jsonResponse({ token: "admin-token" });
      })
    );

    renderAt("/admin");

    fireEvent.click(screen.getByRole("button", { name: "Ver pagamentos" }));
    const adminPayments = await screen.findByLabelText("Pagamentos de Clientes - Admin");
    await waitFor(() => expect(within(adminPayments).getAllByText("Pedro Roger")).toHaveLength(2));
    const buttons = within(adminPayments).getAllByRole("button", { name: /Aguardando comprovante/ });
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toBeDisabled();
    expect(within(adminPayments).getAllByText("Sem comprovante")).toHaveLength(2);
  });

  it("does not submit a hidden stale stand after filtering", async () => {
    const user = userEvent.setup();
    renderAt("/venda");

    await user.selectOptions(screen.getByLabelText("Status público"), "sold");
    await user.click(screen.getByRole("button", { name: "Enviar solicitação" }));

    expect(screen.getAllByText("Nenhum estande disponível selecionado").length).toBeGreaterThan(0);
    expect(screen.getByText("Selecione um estande disponível.")).toBeInTheDocument();
  });

  it("updates admin stand statuses", async () => {
    const user = userEvent.setup();
    markAdminLoggedIn();
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ message: "offline" }, 500)));
    renderAt("/admin");

    await user.click(screen.getAllByRole("button", { name: "Gerenciar stands" })[0]);
    await user.selectOptions(screen.getByLabelText("Status C-02"), "sold");
    await user.selectOptions(screen.getByLabelText("Status F-07"), "reserved");

    expect(screen.getByLabelText("Status C-02")).toHaveValue("sold");
    expect(screen.getByLabelText("Status F-07")).toHaveValue("reserved");
  });

  it("shows the stand manager with models, map preview and model creation", async () => {
    const user = userEvent.setup();
    markAdminLoggedIn();
    renderAt("/admin");

    await user.click(screen.getAllByRole("button", { name: "Gerenciar stands" })[0]);

    const standManager = screen.getByLabelText("Modelos de stands do evento");
    expect(within(standManager).getByText("GERENCIAR STANDS")).toBeInTheDocument();
    expect(within(standManager).getByLabelText("Selecione o evento")).toHaveValue("expo-fortaleza-2026");
    expect(within(standManager).getByText("3m x 3m")).toBeInTheDocument();
    expect(within(standManager).getByText("Feira de Negócios")).toBeInTheDocument();

    await user.click(within(standManager).getByRole("button", { name: "MAPA" }));
    expect(screen.getByLabelText("Prévia do mapa do evento")).toBeInTheDocument();

    await user.click(within(standManager).getByRole("button", { name: "config" }));
    const modelForm = screen.getByLabelText("Criar modelo de stands");
    await user.type(within(modelForm).getByLabelText("nome"), "Premium");
    await user.type(within(modelForm).getByLabelText("largura"), "4");
    await user.type(within(modelForm).getByLabelText("comprimento"), "4");
    await user.type(within(modelForm).getByLabelText("quantidade"), "12");
    await user.click(within(modelForm).getByRole("button", { name: "CRIAR" }));

    expect(within(standManager).getByText("4m x 4m")).toBeInTheDocument();
    expect(within(standManager).getByText("Premium")).toBeInTheDocument();
  });

  it("lets the admin select a stand from the map preview", async () => {
    const user = userEvent.setup();
    markAdminLoggedIn();
    renderAt("/admin");

    await user.click(screen.getByRole("button", { name: "Gerenciar stands" }));
    await user.click(screen.getByRole("button", { name: "MAPA" }));

    await user.click(screen.getByRole("button", { name: /A-04/ }));

    expect(screen.getByText("Estande selecionado: A-04")).toBeInTheDocument();
  });

  it("lets the admin create event stands from setup batches", async () => {
    const user = userEvent.setup();
    markAdminLoggedIn();
    renderAt("/admin");

    await user.click(screen.getByRole("button", { name: "Criar evento" }));
    await user.type(screen.getByLabelText("Nome do novo evento"), "Expo Fortaleza 2026");
    await user.click(screen.getByRole("button", { name: "Avançar para stands" }));
    await user.click(screen.getByRole("button", { name: "Avançar para pagamento" }));
    await user.click(screen.getByRole("button", { name: "Revisar evento" }));
    await user.click(screen.getByRole("button", { name: "Criar evento e gerar stands" }));

    expect(await screen.findByLabelText("Gerenciamento de Expo Fortaleza 2026")).toBeInTheDocument();
    expect(screen.getByDisplayValue("expo-fortaleza-2026")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Gerenciar stands" })[0]);
    expect(screen.getByLabelText("Total de Estandes: 90")).toBeInTheDocument();

    const standsAdmin = screen.getByLabelText("Gestão de Estandes - Admin");
    expect(within(standsAdmin).getByText("N-01")).toBeInTheDocument();
    expect(within(standsAdmin).getByText("G-10")).toBeInTheDocument();
    expect(within(standsAdmin).getAllByText("Feira de Negócios / 3x3")).toHaveLength(80);
    expect(within(standsAdmin).getAllByText("Feira Gastronômica / Barraca")).toHaveLength(10);
  });

  it("lets the admin generate and copy a public sales form link", async () => {
    const user = userEvent.setup();
    markAdminLoggedIn();
    renderAt("/admin");

    await user.click(screen.getByRole("button", { name: "Gerenciar Expo Fortaleza 2026" }));

    const expectedLink = `${window.location.origin}/venda?evento=expo-fortaleza-2026&form=venda#formulario-venda`;
    expect(screen.getByLabelText("Link público do formulário de venda")).toHaveValue(expectedLink);
    expect(screen.getByRole("link", { name: "Abrir formulário" })).toHaveAttribute("href", expectedLink);

    const writeText = vi.spyOn(window.navigator.clipboard, "writeText").mockResolvedValue(undefined);
    await user.click(screen.getByRole("button", { name: "Copiar link" }));

    expect(writeText).toHaveBeenCalledWith(expectedLink);
  });

  it("lets the admin save the PIX copy-paste code by event", async () => {
    const user = userEvent.setup();
    markAdminLoggedIn();
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    const pixValue = "000201PIX-NOVO-EVENTO";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url === "http://api.test/auth/login" && method === "POST") {
        return jsonResponse({ token: "admin-token" });
      }

      if (url === "http://api.test/events" && method === "GET") {
        return jsonResponse([{ slug: "expo-fortaleza-2026", name: "Expo Fortaleza 2026", year: 2026 }]);
      }

      if ((url === "http://api.test/stands" || url === "http://api.test/stands?eventSlug=expo-fortaleza-2026") && method === "GET") {
        return jsonResponse(sampleStands);
      }

      if (url === "http://api.test/purchases" && method === "GET") {
        return jsonResponse([]);
      }

      if (url === "http://api.test/events/expo-fortaleza-2026/payment-config" && method === "GET") {
        return jsonResponse({
          eventSlug: "expo-fortaleza-2026",
          pixCopyPaste: "PIX-ANTIGO",
          installments: defaultPaymentInstallments()
        });
      }

      if (url === "http://api.test/events/expo-fortaleza-2026/payment-config" && method === "POST") {
        expect(JSON.parse(String(init?.body))).toMatchObject({ pixCopyPaste: pixValue });
        return jsonResponse({
          eventSlug: "expo-fortaleza-2026",
          pixCopyPaste: pixValue,
          installments: defaultPaymentInstallments()
        });
      }

      return jsonResponse({ message: `Unexpected ${method} ${url}` }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/admin");

    await user.click(screen.getByRole("button", { name: "Gerenciar Expo Fortaleza 2026" }));
    const pixInput = await screen.findByLabelText("PIX copia e cola do evento");
    fireEvent.change(pixInput, { target: { value: pixValue } });
    await user.click(screen.getByRole("button", { name: "Salvar PIX do evento" }));

    expect(await screen.findByText("PIX salvo com sucesso para este evento.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/events/expo-fortaleza-2026/payment-config",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("captures a digital signature with location, date, and time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T23:40:00.000Z"));
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: vi.fn((success: PositionCallback) =>
          success({
            coords: {
              latitude: -3.7319,
              longitude: -38.5267,
              accuracy: 12
            } as GeolocationCoordinates,
            timestamp: Date.now()
          } as GeolocationPosition)
        )
      }
    });

    renderAt("/venda");

    fireEvent.change(screen.getByLabelText("Assinante"), { target: { value: "Pedro Roger" } });
    fireEvent.change(screen.getByLabelText("Documento do assinante"), { target: { value: "123.456.789-01" } });
    fireEvent.click(screen.getByLabelText("Li e aceito assinar este contrato digitalmente."));
    fireEvent.click(screen.getByRole("button", { name: "Assinar digitalmente" }));

    expect(screen.getByText("Desenhe sua assinatura no campo usando o dedo ou mouse.")).toBeInTheDocument();

    const signaturePad = screen.getByLabelText("Campo para assinar com o dedo");
    fireEvent.pointerDown(signaturePad, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(signaturePad, { clientX: 80, clientY: 44, pointerId: 1 });
    fireEvent.pointerUp(signaturePad, { clientX: 120, clientY: 54, pointerId: 1 });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Assinar digitalmente" }));
      await Promise.resolve();
    });
    expect(screen.getByText("Assinatura digital registrada.")).toBeInTheDocument();
    expect(screen.getByText("18/07/2026 às 23:40:00")).toBeInTheDocument();
    expect(screen.getByText("-3.731900, -38.526700")).toBeInTheDocument();
    expect(screen.getByText("Traço capturado")).toBeInTheDocument();
  });

  it("retries signature geolocation when precise location is unavailable", async () => {
    const getCurrentPosition = vi
      .fn()
      .mockImplementationOnce((_success: PositionCallback, error: PositionErrorCallback) =>
        error({ code: 2, message: "Position unavailable" } as GeolocationPositionError)
      )
      .mockImplementationOnce((success: PositionCallback) =>
        success({
          coords: {
            latitude: -3.7319,
            longitude: -38.5267,
            accuracy: 120
          } as GeolocationCoordinates,
          timestamp: Date.now()
        } as GeolocationPosition)
      );
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: { getCurrentPosition }
    });
    renderAt("/venda");

    fireEvent.change(screen.getByLabelText("Assinante"), { target: { value: "Pedro Roger" } });
    fireEvent.change(screen.getByLabelText("Documento do assinante"), { target: { value: "07.206.816/0001-15" } });
    fireEvent.click(screen.getByLabelText("Li e aceito assinar este contrato digitalmente."));
    const signaturePad = screen.getByLabelText("Campo para assinar com o dedo");
    fireEvent.pointerDown(signaturePad, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(signaturePad, { clientX: 80, clientY: 44, pointerId: 1 });
    fireEvent.pointerUp(signaturePad, { clientX: 120, clientY: 54, pointerId: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Assinar digitalmente" }));

    expect(await screen.findByText("Assinatura digital registrada.")).toBeInTheDocument();
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
  });

  it("runs the real client sale flow through receipt upload", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ message: "API offline neste teste" }, 503)));
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: vi.fn((success: PositionCallback) =>
          success({
            coords: {
              latitude: -3.7319,
              longitude: -38.5267,
              accuracy: 12
            } as GeolocationCoordinates,
            timestamp: Date.now()
          } as GeolocationPosition)
        )
      }
    });
    renderAt("/venda");

    fireEvent.click(screen.getByRole("button", { name: "Disponível C-02 64m² selecionado" }));
    fireEvent.change(screen.getByLabelText("Nome completo ou razão social"), { target: { value: "Maria Silva" } });
    fireEvent.change(screen.getByLabelText("Documento"), { target: { value: "12345678901" } });
    fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "(85) 99999-1111" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "maria@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar solicitação" }));

    expect(screen.getByText("Cadastro concluído. Agora assine o contrato para abrir seu perfil de pagamentos.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reservado C-02 64m² selecionado" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Assinante"), { target: { value: "Maria Silva" } });
    fireEvent.change(screen.getByLabelText("Documento do assinante"), { target: { value: "123.456.789-01" } });
    fireEvent.click(screen.getByLabelText("Li e aceito assinar este contrato digitalmente."));
    const signaturePad = screen.getByLabelText("Campo para assinar com o dedo");
    fireEvent.pointerDown(signaturePad, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(signaturePad, { clientX: 80, clientY: 44, pointerId: 1 });
    fireEvent.pointerUp(signaturePad, { clientX: 120, clientY: 54, pointerId: 1 });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Assinar digitalmente" }));
      await Promise.resolve();
    });
    const profile = await screen.findByLabelText("Perfil do Cliente");
    expect(within(profile).getByText("C-02 · 64m²")).toBeInTheDocument();
    expect(within(profile).getByRole("link", { name: "Baixar contrato" })).toHaveAttribute(
      "href",
      "http://localhost:3000/purchases/purchase-expo-fortaleza-2026-stand-c-02/contract/download"
    );
    expect((within(profile).getByLabelText("PIX copia e cola") as HTMLTextAreaElement).value).toContain("BR.GOV.BCB.PIX");
    expect(within(profile).getByText("Pagamento em aguardo")).toBeInTheDocument();
    expect(within(profile).getByText("R$ 1.500,00")).toBeInTheDocument();
    expect(within(profile).getByText("R$ 2.000,00")).toBeInTheDocument();

    const receiptInput = screen.getByLabelText("Comprovante 1ª parcela") as HTMLInputElement;
    fireEvent.change(receiptInput, {
      target: {
        files: [new File(["pix"], "pix-entrada.png", { type: "image/png" })]
      }
    });

    expect(within(profile).getByText("Em análise")).toBeInTheDocument();
  });

  it("syncs the real sales flow with the API", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: vi.fn((success: PositionCallback) =>
          success({
            coords: {
              latitude: -3.7319,
              longitude: -38.5267,
              accuracy: 12
            } as GeolocationCoordinates,
            timestamp: Date.now()
          } as GeolocationPosition)
        )
      }
    });
    let purchase: ClientPurchaseProfile | null = null;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url === "http://api.test/stands" && method === "GET") {
        return jsonResponse(sampleStands);
      }

      if (url === "http://api.test/events" && method === "GET") {
        return jsonResponse([{ slug: "expo-fortaleza-2026", name: "Expo Fortaleza 2026", year: 2026 }]);
      }

      if (url === "http://api.test/events/expo-fortaleza-2026/payment-config" && method === "GET") {
        return jsonResponse({
          eventSlug: "expo-fortaleza-2026",
          pixCopyPaste: "000201PIX-EVENTO-API",
          installments: defaultPaymentInstallments()
        });
      }

      if (url === "http://api.test/auth/login" && method === "POST") {
        return jsonResponse({ token: "admin-token" });
      }

      if ((url === "http://api.test/purchases" || url === "http://api.test/purchases?eventSlug=expo-fortaleza-2026") && method === "GET") {
        return jsonResponse(purchase ? [purchase] : []);
      }

      if (url === "http://api.test/stands/stand-c-02/reserve" && method === "POST") {
        return jsonResponse({ ...sampleStands[2], status: "reserved", exhibitor: "Reserva em andamento" });
      }

      if (url === "http://api.test/contracts/generate" && method === "POST") {
        return jsonResponse({
          id: "contract-api-c-02",
          contractUrl: "s3://expomanage/contracts/generated/contract-api-c-02.docx"
        });
      }

      if (url === "http://api.test/purchases" && method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}")) as { contractUrl: string };
        purchase = buildPurchaseProfile({
          eventSlug: "expo-fortaleza-2026",
          clientName: "Maria API",
          clientEmail: "maria.api@example.com",
          stand: { ...sampleStands[2], status: "reserved" },
          contractUrl: body.contractUrl
        });
        return jsonResponse(purchase);
      }

      if (
        (
          url === "http://api.test/purchases/purchase-stand-c-02/installments/installment-1/receipt" ||
          url === "http://api.test/purchases/purchase-expo-fortaleza-2026-stand-c-02/installments/installment-1/receipt"
        ) &&
        method === "POST"
      ) {
        purchase = {
          ...purchase!,
          installments: purchase!.installments.map((installment) =>
            installment.id === "installment-1"
              ? {
                  ...installment,
                  status: "under_review",
                  receipt: {
                    fileName: "pix-api.png",
                    url: "https://lc-web-quero.s3.us-east-2.amazonaws.com/receipts/pix-api.png",
                    uploadedAt: "2026-07-19T21:10:00.000Z"
                  }
                }
              : installment
          )
        };
        return jsonResponse(purchase);
      }

      if (
        (
          url === "http://api.test/purchases/purchase-stand-c-02/installments/installment-1/paid" ||
          url === "http://api.test/purchases/purchase-expo-fortaleza-2026-stand-c-02/installments/installment-1/paid"
        ) &&
        method === "PATCH"
      ) {
        purchase = {
          ...purchase!,
          installments: purchase!.installments.map((installment) =>
            installment.id === "installment-1" ? { ...installment, status: "paid" } : installment
          )
        };
        return jsonResponse(purchase);
      }

      return jsonResponse({ message: `Unexpected ${method} ${url}` }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = renderAt("/venda");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/stands?eventSlug=expo-fortaleza-2026",
      expect.anything()
    ));
    fireEvent.click(screen.getByRole("button", { name: "Disponível C-02 64m² selecionado" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "http://api.test/stands/stand-c-02/reserve",
        expect.objectContaining({ method: "POST" })
      )
    );

    fireEvent.change(screen.getByLabelText("Nome completo ou razão social"), { target: { value: "Maria API" } });
    fireEvent.change(screen.getByLabelText("Documento"), { target: { value: "12345678901" } });
    fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "(85) 99999-1111" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "maria.api@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar solicitação" }));

    expect(screen.getByText("Cadastro concluído. Agora assine o contrato para abrir seu perfil de pagamentos.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Assinante"), { target: { value: "Maria API" } });
    fireEvent.change(screen.getByLabelText("Documento do assinante"), { target: { value: "123.456.789-01" } });
    fireEvent.click(screen.getByLabelText("Li e aceito assinar este contrato digitalmente."));
    const signaturePad = screen.getByLabelText("Campo para assinar com o dedo");
    fireEvent.pointerDown(signaturePad, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(signaturePad, { clientX: 80, clientY: 44, pointerId: 1 });
    fireEvent.pointerUp(signaturePad, { clientX: 120, clientY: 54, pointerId: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Assinar digitalmente" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "http://api.test/contracts/generate",
        expect.objectContaining({ method: "POST" })
      )
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "http://api.test/purchases",
        expect.objectContaining({ method: "POST" })
      )
    );

    const receiptInput = screen.getByLabelText("Comprovante 1ª parcela") as HTMLInputElement;
    fireEvent.change(receiptInput, {
      target: {
        files: [new File(["pix"], "pix-api.png", { type: "image/png" })]
      }
    });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "http://api.test/purchases/purchase-expo-fortaleza-2026-stand-c-02/installments/installment-1/receipt",
        expect.objectContaining({ method: "POST" })
      )
    );

    unmount();
    markAdminLoggedIn();
    renderAt("/admin");

    fireEvent.click(screen.getByRole("button", { name: "Ver pagamentos" }));
    const adminPayments = await screen.findByLabelText("Pagamentos de Clientes - Admin");
    await waitFor(() => expect(within(adminPayments).getAllByText("Maria API")).toHaveLength(2));
    expect(within(adminPayments).getByRole("link", { name: "Visualizar comprovante 1ª parcela" })).toHaveAttribute(
      "href",
      "https://lc-web-quero.s3.us-east-2.amazonaws.com/receipts/pix-api.png"
    );

    fireEvent.click(
      within(adminPayments).getByRole("button", {
        name: "Marcar 1ª parcela de Maria API como paga"
      })
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "http://api.test/purchases/purchase-expo-fortaleza-2026-stand-c-02/installments/installment-1/paid",
        expect.objectContaining({ method: "PATCH" })
      )
    );
    expect(within(adminPayments).getByText("Paga")).toBeInTheDocument();
  });
});

function markAdminLoggedIn() {
  window.sessionStorage.setItem("expomanage.adminSession", "true");
  window.sessionStorage.setItem("expomanage.adminToken", "admin-token");
}

function renderAt(path: string) {
  window.history.pushState({}, "", path);
  return render(<App />);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
