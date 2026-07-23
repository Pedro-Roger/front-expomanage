import { useEffect, useState, type FormEvent, type PointerEvent, type ReactNode } from "react";
import {
  Bell,
  BookmarkPlus,
  Building2,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileSignature,
  LayoutDashboard,
  ListFilter,
  LogOut,
  LocateFixed,
  Mail,
  Map,
  MessageSquareText,
  Menu,
  Paperclip,
  Power,
  RotateCcw,
  Search,
  Share2,
  Store,
  Trash2,
  X,
  UserCircle
} from "lucide-react";
import {
  buildDashboardStats,
  buildPurchaseProfile,
  buildSignatureRecord,
  defaultExpoEvent,
  defaultEventStandBatches,
  defaultPaymentInstallments,
  defaultPixCopyPaste,
  filterStands,
  formatCurrency,
  generateStandsFromBatches,
  sampleStands,
  paymentInstallmentStatusLabels,
  standStatusLabels,
  validateLeadInput,
  type ClientPurchaseProfile,
  type DocumentType,
  type EventPaymentConfig,
  type EventStandBatch,
  type ExpoEvent,
  type SignatureRecord,
  type Stand,
  type StandStatus
} from "@expomanage/shared";
import { expoApi, readFileAsDataUrl } from "./api";
import { FestivalMap } from "./FestivalMap";

type Feedback = {
  type: "error" | "success";
  messages: string[];
};

type SaveState = "idle" | "saving" | "saved" | "error";

type SignaturePoint = {
  x: number;
  y: number;
};

type ClientDraft = {
  name: string;
  documentType: DocumentType;
  document: string;
  phone: string;
  email: string;
};

type AdminView = "events" | "stands" | "payments" | "contracts" | "settings" | "eventManage";
type StandManagerMode = "models" | "map" | "config";
type EventCreationStep = 1 | 2 | 3 | 4;

const fallbackPublicAssetBaseUrl = "https://lc-web-quero.s3.us-east-2.amazonaws.com";
const publicAssetBaseUrl = import.meta.env.VITE_S3_PUBLIC_BASE_URL || fallbackPublicAssetBaseUrl;
const shouldUseDemoData = import.meta.env.MODE === "test";

function formatStandModelSize(size: string) {
  const normalized = size.trim();
  const match = normalized.match(/^(\d+(?:[,.]\d+)?)\s*x\s*(\d+(?:[,.]\d+)?)$/i);

  if (!match) {
    return normalized;
  }

  return `${match[1]}m x ${match[2]}m`;
}

export function App() {
  const [events, setEvents] = useState<ExpoEvent[]>(shouldUseDemoData ? [defaultExpoEvent] : []);
  const [activeEventSlug, setActiveEventSlug] = useState(() => readEventSlugFromUrl() || (shouldUseDemoData ? defaultExpoEvent.slug : ""));
  const [stands, setStands] = useState<Stand[]>(
    shouldUseDemoData ? sampleStands.map((stand) => ({ ...stand, eventSlug: defaultExpoEvent.slug })) : []
  );
  const [status, setStatus] = useState<StandStatus | "all">("all");
  const [size, setSize] = useState("");
  const [search, setSearch] = useState("");
  const [selectedStandId, setSelectedStandId] = useState(shouldUseDemoData ? "stand-c-02" : "");
  const [selectedAdminStandId, setSelectedAdminStandId] = useState(shouldUseDemoData ? "stand-a-04" : "");
  const [documentType, setDocumentType] = useState<DocumentType>("cpf");
  const [interestName, setInterestName] = useState("");
  const [interestDocument, setInterestDocument] = useState("");
  const [lastCnpjLookup, setLastCnpjLookup] = useState("");
  const [cnpjLookupNotice, setCnpjLookupNotice] = useState("");
  const [feedback, setFeedback] = useState<Feedback>({ type: "error", messages: [] });
  const [adminNotice, setAdminNotice] = useState("");
  const [paymentSaveState, setPaymentSaveState] = useState<SaveState>("idle");
  const [paymentSaveMessage, setPaymentSaveMessage] = useState("");
  const [signatureRecord, setSignatureRecord] = useState<SignatureRecord | null>(null);
  const [signatureFeedback, setSignatureFeedback] = useState<Feedback>({ type: "error", messages: [] });
  const [signaturePoints, setSignaturePoints] = useState<SignaturePoint[]>([]);
  const [isDrawingSignature, setIsDrawingSignature] = useState(false);
  const [eventName, setEventName] = useState("");
  const [eventFormSlug, setEventFormSlug] = useState("");
  const [eventCreationStep, setEventCreationStep] = useState<EventCreationStep>(1);
  const [eventBatches, setEventBatches] = useState<EventStandBatch[]>(defaultEventStandBatches);
  const [paymentConfig, setPaymentConfig] = useState<EventPaymentConfig>({
    eventSlug: defaultExpoEvent.slug,
    pixCopyPaste: "",
    installments: defaultPaymentInstallments()
  });
  const [salesFormLink, setSalesFormLink] = useState("");
  const [managedFormSlug, setManagedFormSlug] = useState("");
  const [managedFormLink, setManagedFormLink] = useState("");
  const [inactiveEventSlugs, setInactiveEventSlugs] = useState<string[]>([]);
  const [managingEventSlug, setManagingEventSlug] = useState(shouldUseDemoData ? defaultExpoEvent.slug : "");
  const [purchases, setPurchases] = useState<ClientPurchaseProfile[]>([]);
  const [activePurchaseId, setActivePurchaseId] = useState("");
  const [clientDraft, setClientDraft] = useState<ClientDraft | null>(null);
  const [routePath, setRoutePath] = useState(window.location.pathname);
  const [adminSession, setAdminSession] = useState(() => window.sessionStorage.getItem("expomanage.adminSession") === "true");
  const [adminView, setAdminView] = useState<AdminView>("events");
  const [standManagerMode, setStandManagerMode] = useState<StandManagerMode>("models");
  const [isAdminSidebarOpen, setIsAdminSidebarOpen] = useState(false);
  const [loginFeedback, setLoginFeedback] = useState<Feedback>({ type: "error", messages: [] });
  const isLoginRoute = routePath === "/" || (routePath.startsWith("/admin") && !adminSession);
  const isSalesRoute = routePath.startsWith("/venda");
  const isAdminRoute = routePath.startsWith("/admin") && adminSession;
  const isClientRoute = routePath.startsWith("/cliente");
  const activeEvent = events.find((event) => event.slug === activeEventSlug) ?? events[0] ?? null;
  const adminViewTitle: Record<AdminView, string> = {
    events: "Meus eventos",
    stands: "Gerenciar stands",
    payments: "Ver pagamentos",
    contracts: "Ver contratos",
    settings: "Criar evento",
    eventManage: "Gerenciar evento"
  };
  const managedEvent = events.find((event) => event.slug === managingEventSlug) ?? activeEvent;
  const eventCreationSteps: { step: EventCreationStep; label: string }[] = [
    { step: 1, label: "Dados" },
    { step: 2, label: "Stands" },
    { step: 3, label: "Pagamento" },
    { step: 4, label: "Revisão" }
  ];
  const draftEventSlug = slugify(eventFormSlug || eventName);
  const draftSalesFormLink = buildSalesFormLink(draftEventSlug);

  const standSizeOptions = Array.from(new Set(stands.map((stand) => stand.size)));
  const visibleStands = filterStands(stands, { status, size, search });
  const selectedVisibleStand = visibleStands.find((stand) => stand.id === selectedStandId) ?? null;
  const selectedSellableStand =
    selectedVisibleStand && selectedVisibleStand.status !== "sold" ? selectedVisibleStand : null;
  const stats = buildDashboardStats(stands, []);
  const activePurchase = purchases.find((purchase) => purchase.id === activePurchaseId) ?? null;
  const validPurchases = purchases.filter((purchase) => Array.isArray(purchase.installments));

  useEffect(() => {
    let mounted = true;

    if (!isSalesRoute && !isAdminRoute) {
      return;
    }

    async function syncApiState() {
      let eventSlug = activeEventSlug;

      if (isAdminRoute) {
        try {
          const apiEvents = await expoApi.listEvents();
          const safeApiEvents = Array.isArray(apiEvents) ? apiEvents : [];

          if (mounted) {
            setEvents(safeApiEvents);
          }

          if (!safeApiEvents.some((event) => event.slug === eventSlug)) {
            eventSlug = safeApiEvents[0]?.slug ?? "";
            if (mounted) {
              setActiveEventSlug(eventSlug);
              setManagingEventSlug(eventSlug);
            }
          }
        } catch {
          if (mounted && !shouldUseDemoData) {
            setAdminNotice("Não consegui carregar os eventos da API.");
          }
        }
      }

      const apiEventSlug = eventSlug || undefined;

      try {
        const apiStands = await expoApi.listStands(apiEventSlug);
        if (mounted) {
          setStands(Array.isArray(apiStands) ? apiStands : []);
        }
      } catch {
        if (mounted && !shouldUseDemoData) {
          setStands([]);
        }
      }

      if (!isAdminRoute) {
        return;
      }

      try {
        const [apiPurchases, apiPaymentConfig] = await Promise.all([
          expoApi.listPurchases(apiEventSlug),
          expoApi.getPaymentConfig(eventSlug)
        ]);

        if (mounted) {
          setPurchases(apiPurchases);
          setPaymentConfig(apiPaymentConfig);
        }
      } catch {
        if (mounted && !shouldUseDemoData) {
          setPurchases([]);
        }
      }
    }

    void syncApiState();

    return () => {
      mounted = false;
    };
  }, [activeEventSlug, isAdminRoute, isSalesRoute]);

  function navigate(path: string) {
    window.history.pushState({}, "", path);
    setRoutePath(path);
  }

  async function lookupCompanyDocument(value: string) {
    const digits = value.replace(/\D/g, "");

    setInterestDocument(value);

    if (documentType !== "cnpj") {
      setCnpjLookupNotice("");
      return;
    }

    if (digits.length !== 14) {
      setCnpjLookupNotice("");
      return;
    }

    if (digits === lastCnpjLookup) {
      return;
    }

    setLastCnpjLookup(digits);
    setCnpjLookupNotice("Buscando dados do CNPJ...");

    try {
      const company = await expoApi.lookupCnpj(digits);
      setInterestName(company.legalName);
      setCnpjLookupNotice("Dados do CNPJ preenchidos automaticamente.");
    } catch {
      setCnpjLookupNotice("CNPJ não encontrado na base da Receita importada.");
    }
  }

  function logout() {
    window.sessionStorage.removeItem("expomanage.adminSession");
    window.sessionStorage.removeItem("expomanage.adminToken");
    setAdminSession(false);
    setIsAdminSidebarOpen(false);
    setActivePurchaseId("");
    setClientDraft(null);
    setLoginFeedback({ type: "error", messages: [] });
    navigate("/");
  }

  async function submitAdminLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("adminEmail") ?? "").trim();
    const password = String(data.get("adminPassword") ?? "");

    if (!email || !password) {
      setLoginFeedback({ type: "error", messages: ["Informe e-mail e senha do admin."] });
      return;
    }

    try {
      await expoApi.loginAdmin(email, password);
      window.sessionStorage.setItem("expomanage.adminSession", "true");
      setAdminSession(true);
      setIsAdminSidebarOpen(false);
      setLoginFeedback({ type: "error", messages: [] });
      navigate("/admin");
    } catch {
      setLoginFeedback({ type: "error", messages: ["Credenciais administrativas inválidas."] });
    }
  }

  async function submitClientLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const cnpj = String(data.get("clientCnpj") ?? "").replace(/\D/g, "");

    if (cnpj.length !== 14) {
      setLoginFeedback({ type: "error", messages: ["CNPJ deve ter 14 dígitos."] });
      return;
    }

    try {
      const profiles = await expoApi.listPurchasesByClientDocument(cnpj);

      if (profiles.length === 0) {
        setLoginFeedback({ type: "error", messages: ["Nenhuma compra encontrada para este CNPJ."] });
        return;
      }

      setPurchases((current) => [
        ...profiles,
        ...current.filter((item) => !profiles.some((profile) => profile.id === item.id))
      ]);
      setActivePurchaseId(profiles.length === 1 ? profiles[0].id : "");
      setLoginFeedback({ type: "error", messages: [] });
      navigate("/cliente");
    } catch {
      setLoginFeedback({ type: "error", messages: ["Nenhuma compra encontrada para este CNPJ."] });
    }
  }

  function submitInterest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const errors = validateLeadInput({
      name: String(data.get("name") ?? ""),
      documentType,
      document: String(data.get("document") ?? ""),
      phone: String(data.get("phone") ?? ""),
      email: String(data.get("email") ?? ""),
      standId: selectedSellableStand?.id ?? ""
    });

    if (errors.length) {
      setFeedback({ type: "error", messages: errors });
      return;
    }

    if (!selectedSellableStand) {
      setFeedback({ type: "error", messages: ["Selecione um estande disponível."] });
      return;
    }

    const draft: ClientDraft = {
      name: String(data.get("name") ?? "").trim(),
      documentType,
      document: String(data.get("document") ?? "").trim(),
      phone: String(data.get("phone") ?? "").trim(),
      email: String(data.get("email") ?? "").trim()
    };

    setClientDraft(draft);
    setFeedback({
      type: "success",
      messages: ["Cadastro concluído. Agora assine o contrato para abrir seu perfil de pagamentos."]
    });
  }

  function reserveStand(stand: Stand) {
    if (stand.status !== "available") {
      return;
    }

    setSelectedStandId(stand.id);
    setSignatureRecord(null);
    setSignaturePoints([]);
    const localReservedStand: Stand = { ...stand, status: "reserved", exhibitor: clientDraft?.name ?? "Reserva em andamento" };

    setStands((current) =>
      current.map((item) =>
        item.id === stand.id ? localReservedStand : item
      )
    );
    setFeedback({ type: "success", messages: [`${stand.code} reservado temporariamente para este cadastro.`] });

    void expoApi
      .reserveStand(stand.id)
      .then((reservedStand) => {
        setStands((current) => current.map((item) => (item.id === stand.id ? reservedStand : item)));
      })
      .catch(() => {
        // Optimistic local reservation keeps the client from losing progress offline.
      });
  }

  async function updateStandStatus(id: string, nextStatus: StandStatus) {
    try {
      const updated = await expoApi.updateStandStatus(id, nextStatus);
      setStands((current) => current.map((stand) => (stand.id === id ? updated : stand)));
    } catch {
      setStands((current) =>
        current.map((stand) => (stand.id === id ? { ...stand, status: nextStatus } : stand))
      );
    }
    setAdminNotice("Status do estande atualizado.");
  }

  function exportCsv() {
    const rows = ["code,size,status", ...stands.map((stand) => `${stand.code},${stand.size},${stand.status}`)];
    void navigator.clipboard?.writeText(rows.join("\n"));
    setAdminNotice("CSV pronto para exportação.");
  }

  function updateEventBatch(index: number, field: keyof EventStandBatch, value: string) {
    setEventBatches((current) =>
      current.map((batch, batchIndex) =>
        batchIndex === index
          ? { ...batch, [field]: field === "quantity" ? Number(value) : value }
          : batch
      )
    );
  }

  function resetEventCreationDraft() {
    setEventName("");
    setEventFormSlug("");
    setEventCreationStep(1);
    setEventBatches(defaultEventStandBatches);
    setPaymentConfig({
      eventSlug: "",
      pixCopyPaste: "",
      installments: defaultPaymentInstallments()
    });
    setSalesFormLink("");
  }

  function openEventCreationWizard() {
    resetEventCreationDraft();
    setAdminView("settings");
    setIsAdminSidebarOpen(false);
  }

  function openEventManager(slug: string) {
    selectActiveEvent(slug);
    setManagingEventSlug(slug);
    setManagedFormSlug(slug);
    setManagedFormLink(buildSalesFormLink(slug));
    setSelectedAdminStandId("");
    setAdminView("eventManage");
  }

  function addStandModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeEvent) {
      setAdminNotice("Crie ou selecione um evento antes de adicionar modelos de stands.");
      return;
    }

    const data = new FormData(event.currentTarget);
    const type = String(data.get("standModelName") ?? "").trim();
    const width = Number(data.get("standModelWidth"));
    const length = Number(data.get("standModelLength"));
    const quantity = Math.floor(Number(data.get("standModelQuantity")));

    if (!type || width <= 0 || length <= 0 || quantity <= 0) {
      setAdminNotice("Preencha nome, largura, comprimento e quantidade do modelo.");
      return;
    }

    setEventBatches((current) => [
      ...current,
      {
        type,
        size: `${width}x${length}`,
        quantity
      }
    ]);
    setStandManagerMode("models");
    setAdminNotice(`Modelo ${type} criado para ${activeEvent.name}.`);
    event.currentTarget.reset();
  }

  function selectActiveEvent(slug: string) {
    const event = events.find((item) => item.slug === slug);

    setActiveEventSlug(slug);
    setStatus("all");
    setSize("");
    setSearch("");
    setSelectedStandId("");
    setSelectedAdminStandId("");
    setSalesFormLink("");
    setPaymentConfig({
      eventSlug: slug,
      pixCopyPaste: defaultPixCopyPaste,
      installments: defaultPaymentInstallments()
    });
    setAdminNotice(event ? `Administrando ${event.name}.` : "Selecione ou crie um evento.");
    setIsAdminSidebarOpen(false);
  }

  async function submitEventSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEventSlug = draftEventSlug;
    const generatedStands = generateStandsFromBatches(eventBatches, nextEventSlug);

    if (!eventName.trim()) {
      setAdminNotice("Informe o nome do evento antes de gerar os estandes.");
      return;
    }

    if (generatedStands.length === 0) {
      setAdminNotice("Informe pelo menos um lote com quantidade maior que zero.");
      return;
    }

    const localEvent: ExpoEvent = {
      slug: nextEventSlug,
      name: eventName.trim(),
      year: extractYear(eventName)
    };

    setEvents((current) => [localEvent, ...current.filter((item) => item.slug !== localEvent.slug)]);
    setActiveEventSlug(localEvent.slug);
    setManagingEventSlug(localEvent.slug);
    setManagedFormSlug(localEvent.slug);
    setManagedFormLink(buildSalesFormLink(localEvent.slug));
    setStands(generatedStands);
    setPurchases([]);
    setPaymentConfig((current) => ({ ...current, eventSlug: localEvent.slug }));
    setStatus("all");
    setSize("");
    setSearch("");
    setSelectedStandId(generatedStands[0].id);
    setSelectedAdminStandId(generatedStands[0].id);
    setSignatureRecord(null);
    setSignaturePoints([]);
    setSalesFormLink("");
    setEventCreationStep(4);
    setAdminView("eventManage");
    setAdminNotice(`Evento ${localEvent.name} configurado com ${generatedStands.length} estandes.`);

    try {
      const savedEvent = await expoApi.upsertEvent(localEvent);
      const savedStands = await expoApi.generateEventStands(savedEvent.slug, eventBatches);
      const savedPaymentConfig = await expoApi.upsertPaymentConfig(savedEvent.slug, {
        pixCopyPaste: paymentConfig.pixCopyPaste,
        installments: paymentConfig.installments
      });
      setEvents((current) => [savedEvent, ...current.filter((item) => item.slug !== savedEvent.slug)]);
      setActiveEventSlug(savedEvent.slug);
      setManagingEventSlug(savedEvent.slug);
      setManagedFormSlug(savedEvent.slug);
      setManagedFormLink(buildSalesFormLink(savedEvent.slug));
      setStands(savedStands);
      setPaymentConfig(savedPaymentConfig);
      setSelectedStandId(savedStands[0]?.id ?? "");
      setSelectedAdminStandId(savedStands[0]?.id ?? "");
    } catch {
      setAdminNotice("Não consegui salvar o evento na API. Confira a conexão e tente novamente.");
    }
  }

  function generateSalesFormLink() {
    const targetSlug = managingEventSlug || activeEventSlug;

    if (!targetSlug) {
      setAdminNotice("Crie ou selecione um evento antes de gerar o link.");
      return;
    }

    const link = buildSalesFormLink(targetSlug);
    setSalesFormLink(link);
    setAdminNotice("Link de venda gerado.");
  }

  function copySalesFormLink() {
    if (!salesFormLink) {
      setAdminNotice("Gere o link de venda antes de copiar.");
      return;
    }

    void window.navigator.clipboard?.writeText(salesFormLink);
    setAdminNotice("Link de venda copiado.");
  }

  function copyManagedFormLink() {
    if (!managedEvent) {
      setAdminNotice("Selecione um evento antes de copiar o link.");
      return;
    }

    const slug = slugify(managedFormSlug || managedEvent.slug);
    const link = buildSalesFormLink(slug);
    setManagedFormLink(link);
    void window.navigator.clipboard?.writeText(link);
    setAdminNotice("Link do formulário copiado.");
  }

  function saveManagedFormUrl() {
    if (!managedEvent) {
      setAdminNotice("Selecione um evento antes de alterar a URL.");
      return;
    }

    const nextSlug = slugify(managedFormSlug);

    if (!nextSlug) {
      setAdminNotice("Informe a URL do formulário.");
      return;
    }

    setEvents((current) =>
      current.map((event) => (event.slug === managedEvent.slug ? { ...event, slug: nextSlug } : event))
    );
    setStands((current) =>
      current.map((stand) =>
        (stand.eventSlug ?? defaultExpoEvent.slug) === managedEvent.slug ? { ...stand, eventSlug: nextSlug } : stand
      )
    );
    setActiveEventSlug(nextSlug);
    setManagingEventSlug(nextSlug);
    setManagedFormSlug(nextSlug);
    setManagedFormLink(buildSalesFormLink(nextSlug));
    setAdminNotice("URL do formulário atualizada.");
  }

  function toggleManagedEventActive() {
    if (!managedEvent) {
      setAdminNotice("Selecione um evento antes de alterar o status.");
      return;
    }

    setInactiveEventSlugs((current) =>
      current.includes(managedEvent.slug)
        ? current.filter((slug) => slug !== managedEvent.slug)
        : [...current, managedEvent.slug]
    );
  }

  async function removeManagedEvent() {
    if (!managedEvent) {
      setAdminNotice("Selecione um evento antes de excluir.");
      return;
    }

    const remainingEvents = events.filter((event) => event.slug !== managedEvent.slug);
    const nextEvent = remainingEvents[0] ?? null;

    try {
      await expoApi.deleteEvent(managedEvent.slug);
    } catch {
      setAdminNotice("Não consegui excluir o evento na API. Tente novamente.");
      return;
    }

    setEvents(remainingEvents);
    setInactiveEventSlugs((current) => current.filter((slug) => slug !== managedEvent.slug));
    setActiveEventSlug(nextEvent?.slug ?? "");
    setManagingEventSlug(nextEvent?.slug ?? "");
    setManagedFormSlug(nextEvent?.slug ?? "");
    setManagedFormLink(nextEvent ? buildSalesFormLink(nextEvent.slug) : "");
    setStands([]);
    setPurchases([]);
    setAdminView("events");
    setAdminNotice(`${managedEvent.name} excluído.`);
  }

  function goToEventCreationStep(nextStep: EventCreationStep) {
    if (nextStep > 1 && !eventName.trim()) {
      setAdminNotice("Informe o nome do evento para continuar.");
      return;
    }

    if (nextStep > 2 && generateStandsFromBatches(eventBatches, draftEventSlug).length === 0) {
      setAdminNotice("Informe pelo menos um lote de stands para continuar.");
      return;
    }

    setEventCreationStep(nextStep);
  }

  async function savePaymentConfig() {
    if (!activeEventSlug) {
      setAdminNotice("Crie ou selecione um evento antes de salvar o PIX.");
      setPaymentSaveState("error");
      setPaymentSaveMessage("Nenhum evento selecionado.");
      return;
    }

    const pixCopyPaste = paymentConfig.pixCopyPaste.trim();

    if (!pixCopyPaste) {
      setAdminNotice("Informe o PIX copia e cola do evento.");
      setPaymentSaveState("error");
      setPaymentSaveMessage("Informe o PIX copia e cola antes de salvar.");
      return;
    }

    const nextConfig: EventPaymentConfig = {
      eventSlug: activeEventSlug,
      pixCopyPaste,
      installments: paymentConfig.installments.length ? paymentConfig.installments : defaultPaymentInstallments()
    };

    setPaymentConfig(nextConfig);
    setPaymentSaveState("saving");
    setPaymentSaveMessage("Salvando PIX do evento...");

    try {
      const saved = await expoApi.upsertPaymentConfig(activeEventSlug, {
        pixCopyPaste: nextConfig.pixCopyPaste,
        installments: nextConfig.installments
      });
      setPaymentConfig(saved);
      setPaymentSaveState("saved");
      setPaymentSaveMessage("PIX salvo com sucesso para este evento.");
    } catch {
      // Local config remains visible if the API is unavailable during development.
      setPaymentSaveState("error");
      setPaymentSaveMessage("Não consegui confirmar na API. Mantive o PIX na tela, confira a conexão.");
    }

    setAdminNotice("PIX do evento salvo.");
  }

  function submitSignature(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const signerName = String(data.get("signerName") ?? "").trim();
    const signerDocument = String(data.get("signerDocument") ?? "").trim();
    const accepted = data.get("acceptedSignature") === "on";

    if (!signerName || !signerDocument || !accepted) {
      setSignatureFeedback({
        type: "error",
        messages: ["Informe assinante, documento e aceite para registrar a assinatura digital."]
      });
      return;
    }

    if (signaturePoints.length < 2) {
      setSignatureFeedback({
        type: "error",
        messages: ["Desenhe sua assinatura no campo usando o dedo ou mouse."]
      });
      return;
    }

    if (!selectedSellableStand) {
      setSignatureFeedback({
        type: "error",
        messages: ["Selecione um estande disponível ou reservado para este cadastro antes de assinar."]
      });
      return;
    }

    if (!navigator.geolocation) {
      setSignatureFeedback({
        type: "error",
        messages: ["Geolocalização não está disponível neste navegador."]
      });
      return;
    }

    void captureSignaturePosition()
      .then(async (position) => {
        const record = buildSignatureRecord({
          signerName,
          signerDocument,
          standCode: selectedSellableStand.code,
          signedAt: new Date(),
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          signaturePath: serializeSignature(signaturePoints)
        });
        setSignatureRecord(record);
        setSignatureFeedback({ type: "success", messages: ["Assinatura digital registrada."] });
        let contractUrl = buildPublicAssetUrl(`contracts/contract-${selectedSellableStand.code}.docx`);

        try {
          const contract = await expoApi.generateContract({
            sponsor: {
              documentType,
              document: clientDraft?.document ?? signerDocument,
              legalName: clientDraft?.name ?? signerName,
              representativeName: signerName,
              representativeRole: "Representante legal",
              representativeRg: "",
              representativeCpf: signerDocument,
              phone: clientDraft?.phone ?? "",
              email: clientDraft?.email ?? "cliente@expomanage.local"
            },
            stand: {
              code: selectedSellableStand.code,
              size: selectedSellableStand.size,
              area: selectedSellableStand.area
            },
            sponsorSignatureDataUrl: signaturePointsToPngDataUrl(signaturePoints)
          });
          contractUrl = contract.contractUrl;
        } catch {
          // Missing APCC signature/S3 config should not block the immediate payment step.
        }

        const localPurchase = buildPurchaseProfile({
          eventSlug: activeEventSlug,
          clientName: clientDraft?.name ?? signerName,
          clientEmail: clientDraft?.email ?? "cliente@expomanage.local",
          clientDocument: clientDraft?.document ?? signerDocument,
          stand: selectedSellableStand,
          contractUrl,
          pixCopyPaste: paymentConfig.pixCopyPaste
        });

        setPurchases((current) => [localPurchase, ...current.filter((item) => item.id !== localPurchase.id)]);
        setActivePurchaseId(localPurchase.id);

        void (async () => {
          let purchase = localPurchase;

          try {
            purchase = await expoApi.createPurchase({
              eventSlug: activeEventSlug,
              clientName: localPurchase.clientName,
              clientEmail: localPurchase.clientEmail,
              clientDocument: clientDraft?.document ?? signerDocument,
              standId: selectedSellableStand.id,
              contractUrl: localPurchase.contractUrl
            });
          } catch {
            // If API purchase creation fails, show the local profile so payment instructions are not blocked.
          }

          setPurchases((current) => [purchase, ...current.filter((item) => item.id !== purchase.id)]);
          setActivePurchaseId(purchase.id);
        })();
      })
      .catch((error: GeolocationPositionError) => {
        setSignatureFeedback({
          type: "error",
          messages: [formatGeolocationError(error)]
        });
      });
  }

  function startSignature(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setSignatureRecord(null);
    setSignatureFeedback({ type: "error", messages: [] });
    setIsDrawingSignature(true);
    setSignaturePoints([readSignaturePoint(event)]);
  }

  function drawSignature(event: PointerEvent<HTMLDivElement>) {
    if (!isDrawingSignature) {
      return;
    }

    const point = readSignaturePoint(event);
    setSignaturePoints((current) => [...current, point]);
  }

  function endSignature(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setIsDrawingSignature(false);
  }

  function clearSignature() {
    setSignatureRecord(null);
    setSignaturePoints([]);
    setSignatureFeedback({ type: "error", messages: [] });
  }

  async function attachReceipt(purchaseId: string, installmentId: string, files: FileList | null) {
    const file = files?.[0];

    if (!file) {
      return;
    }

    setPurchases((current) =>
      current.map((purchase) =>
        purchase.id === purchaseId
          ? {
              ...purchase,
              installments: purchase.installments.map((installment) =>
                installment.id === installmentId
                  ? {
                      ...installment,
                      status: "under_review",
                      receipt: {
                        fileName: file.name,
                        url: buildPublicAssetUrl(`receipts/${encodeURIComponent(file.name)}`),
                        uploadedAt: new Date().toISOString()
                      }
                    }
                  : installment
              )
            }
          : purchase
      )
    );

    try {
      const updated = await expoApi.attachReceipt(purchaseId, installmentId, {
        fileName: file.name,
        dataUrl: await readFileAsDataUrl(file),
        contentType: file.type || "application/octet-stream"
      });
      setPurchases((current) => current.map((purchase) => (purchase.id === purchaseId ? updated : purchase)));
    } catch {
      // The optimistic receipt remains visible while local development has no API/S3.
    }
  }

  async function markInstallmentPaid(purchaseId: string, installmentId: string) {
    const applyPaidStatus = (current: ClientPurchaseProfile[]) =>
      current.map((purchase) => {
        if (purchase.id !== purchaseId) {
          return purchase;
        }

        const installments = purchase.installments.map((installment) =>
          installment.id === installmentId ? { ...installment, status: "paid" as const } : installment
        );

        return {
          ...purchase,
          installments,
          paymentStatus: installments.every((installment) => installment.status === "paid")
            ? ("Pagamento confirmado" as const)
            : ("Pagamento em aguardo" as const)
        };
      });

    setPurchases(applyPaidStatus);

    try {
      const updated = await expoApi.markInstallmentPaid(purchaseId, installmentId);
      setPurchases((current) => current.map((purchase) => (purchase.id === purchaseId ? updated : purchase)));
    } catch {
      // Optimistic paid status remains visible if admin API is unavailable in local development.
    }
    setAdminNotice("Pagamento confirmado pelo admin.");
  }

  return (
    <div className="shell">
      {!isLoginRoute && !isAdminRoute ? (
        <header className="topbar">
          <div className="brand">
            <LayoutDashboard size={22} />
            <h1>ExpoManage</h1>
          </div>
          <div className="topbar-actions">
            <a className="topbar-link" href={isAdminRoute ? buildSalesFormLink(activeEventSlug) : "/"}>
              {isAdminRoute ? "Ver formulário" : "Login"}
            </a>
            {isAdminRoute || isClientRoute ? (
              <button className="topbar-logout" type="button" onClick={logout}>
                <LogOut size={16} />
                Sair
              </button>
            ) : null}
            <button className="icon-button" aria-label="Notificações">
              <Bell size={18} />
            </button>
            <div className="avatar">AM</div>
          </div>
        </header>
      ) : null}

      <main className={`workspace ${isAdminRoute ? "admin-only" : "public-only"} ${isLoginRoute ? "login-only" : ""}`}>
        {isLoginRoute ? (
          <section className="login-panel" aria-labelledby="login-title">
            <div className="login-brand">
              <div className="brand-mark">
                <LayoutDashboard size={24} />
              </div>
              <div>
                <span>ExpoManage</span>
                <strong>Painel de eventos</strong>
              </div>
            </div>
            <div className="login-access-card">
              <h2 className="sr-only" id="login-title">Login ExpoManage</h2>
              <div className="login-grid">
                <form className="login-card admin-login-card" onSubmit={submitAdminLogin}>
                  <div className="panel-title">
                    <UserCircle size={18} />
                    <h3>Admin</h3>
                  </div>
                  <p>Gerencie stands, contratos e status dos pagamentos.</p>
                  <label>
                    E-mail do admin
                    <input name="adminEmail" type="email" />
                  </label>
                  <label>
                    Senha do admin
                    <input name="adminPassword" type="password" />
                  </label>
                  <button className="primary-action full" type="submit">Entrar como admin</button>
                </form>
                <form className="login-card client-login-card" onSubmit={submitClientLogin}>
                  <div className="panel-title">
                    <Building2 size={18} />
                    <h3>Cliente CNPJ</h3>
                  </div>
                  <p>Acesse o stand comprado, contrato e parcelas usando o CNPJ.</p>
                  <label>
                    CNPJ do cliente
                    <input name="clientCnpj" placeholder="00.000.000/0000-00" />
                  </label>
                  <button className="secondary-action full" type="submit">Entrar com CNPJ</button>
                  <a className="sales-inline-link" href="/venda">Ainda não escolheu um stand? Abrir formulário</a>
                </form>
              </div>
            </div>
            <div className={`feedback ${loginFeedback.type}`} aria-live="polite">
              {loginFeedback.messages.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          </section>
        ) : null}

        {isSalesRoute ? (
        <section className="public-pane" aria-labelledby="reservation-title">
          <div className="section-heading">
            <div>
              <h2 id="reservation-title">Reserva de Estandes</h2>
              <p>Seleção pública com disponibilidade em tempo real e bloqueio de estandes vendidos.</p>
            </div>
          </div>

          <div className="map-and-form">
            <section className="map-panel" aria-label="Mapa de Estandes">
              <div className="panel-title">
                <Map size={18} />
                <h3>{activeEvent ? `Layout do ${activeEvent.name}` : "Layout do evento"}</h3>
              </div>
              <div className="legend">
                <span className="legend-item available">Disponível</span>
                <span className="legend-item sold">Ocupado</span>
                <span className="legend-item reserved">Reservado</span>
                <span className="legend-item selected">Selecionado</span>
              </div>
              <FestivalMap
                stands={visibleStands}
                mode="public"
                selectedStandId={selectedStandId}
                onStandClick={reserveStand}
              />
            </section>

            <section className="interest-panel" id="formulario-venda" aria-label="Formulário de Interesse">
              <div className="panel-title">
                <Mail size={18} />
                <h3>Formulário de Interesse</h3>
              </div>
              <form onSubmit={submitInterest}>
                <label>
                  Nome completo ou razão social
                  <input
                    name="name"
                    onChange={(event) => setInterestName(event.target.value)}
                    placeholder="Nome do interessado"
                    value={interestName}
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Tipo
                    <select
                      value={documentType}
                      onChange={(event) => {
                        const nextType = event.target.value as DocumentType;
                        setDocumentType(nextType);
                        setCnpjLookupNotice("");
                        setLastCnpjLookup("");
                      }}
                    >
                      <option value="cpf">CPF</option>
                      <option value="cnpj">CNPJ</option>
                    </select>
                  </label>
                  <label>
                    Documento
                    <input
                      name="document"
                      onChange={(event) => void lookupCompanyDocument(event.target.value)}
                      placeholder="Somente números"
                      value={interestDocument}
                    />
                  </label>
                </div>
                {cnpjLookupNotice ? <p className="cnpj-lookup-notice">{cnpjLookupNotice}</p> : null}
                <label>
                  Telefone
                  <input name="phone" placeholder="(85) 99999-9999" />
                </label>
                <label>
                  E-mail
                  <input name="email" placeholder="contato@empresa.com" />
                </label>
                <div className="locked-selection">
                  <span>Estande selecionado</span>
                  <strong>{selectedSellableStand ? `${selectedSellableStand.code} · ${selectedSellableStand.size}` : "Nenhum estande disponível selecionado"}</strong>
                </div>
                <button className="primary-action full" type="submit">
                  Enviar solicitação
                </button>
              </form>
              <div className={`feedback ${feedback.type}`} aria-live="polite">
                {feedback.messages.map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </div>
            </section>
          </div>

          <section className="list-panel" aria-label="Lista de Estandes - Público">
            <div className="filters">
              <label>
                Buscar código
                <div className="input-icon">
                  <Search size={16} />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="A-04" />
                </div>
              </label>
              <label>
                Status público
                <select value={status} onChange={(event) => setStatus(event.target.value as StandStatus | "all")}>
                  <option value="all">Todos</option>
                  <option value="available">Disponível</option>
                  <option value="sold">Vendido</option>
                  <option value="reserved">Reservado</option>
                </select>
              </label>
              <label>
                Metragem
                <select value={size} onChange={(event) => setSize(event.target.value)}>
                  <option value="">Todas</option>
                  {standSizeOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="stand-list">
              {visibleStands.length === 0 ? (
                <p className="empty-state">Nenhum estande encontrado.</p>
              ) : (
                visibleStands.map((stand) => (
                  <article className="stand-card" key={stand.id}>
                    <div>
                      <strong>{stand.code}</strong>
                      <span>{stand.type} / {stand.size}</span>
                    </div>
                    <span className={`status ${stand.status}`}>{standStatusLabels[stand.status]}</span>
                    <b>{formatCurrency(stand.price)}</b>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="signature-panel" aria-label="Assinatura Digital do Contrato">
            <div className="panel-title">
              <FileSignature size={18} />
              <h3>Assinatura Digital do Contrato</h3>
            </div>
            <form onSubmit={submitSignature}>
              <div className="form-grid">
                <label>
                  Assinante
                  <input name="signerName" placeholder="Nome de quem assina" />
                </label>
                <label>
                  Documento do assinante
                  <input name="signerDocument" placeholder="CPF ou CNPJ" />
                </label>
              </div>
              <div className="locked-selection">
                <span>Contrato vinculado ao estande</span>
                <strong>{selectedSellableStand ? `${selectedSellableStand.code} · ${selectedSellableStand.size}` : "Nenhum estande disponível selecionado"}</strong>
              </div>
              <div className="signature-pad-group">
                <span>Assinatura no dedo</span>
                <div
                  aria-label="Campo para assinar com o dedo"
                  className="signature-pad"
                  role="img"
                  onPointerDown={startSignature}
                  onPointerMove={drawSignature}
                  onPointerUp={endSignature}
                  onPointerLeave={endSignature}
                >
                  {signaturePoints.length > 1 ? (
                    <svg viewBox="0 0 320 140" aria-hidden="true">
                      <polyline points={serializeSignature(signaturePoints)} />
                    </svg>
                  ) : (
                    <p>Assine aqui</p>
                  )}
                </div>
                <button className="secondary-action full" type="button" onClick={clearSignature}>
                  Limpar assinatura
                </button>
              </div>
              <label className="check-row">
                <input name="acceptedSignature" type="checkbox" />
                Li e aceito assinar este contrato digitalmente.
              </label>
              <button className="primary-action full" type="submit">
                <LocateFixed size={17} />
                Assinar digitalmente
              </button>
            </form>
            <div className={`feedback ${signatureFeedback.type}`} aria-live="polite">
              {signatureFeedback.messages.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
            {signatureRecord ? (
              <dl className="signature-proof">
                <div>
                  <dt>Data e hora</dt>
                  <dd>{signatureRecord.signedDate} às {signatureRecord.signedTime}</dd>
                </div>
                <div>
                  <dt>Localização</dt>
                  <dd>{signatureRecord.latitude.toFixed(6)}, {signatureRecord.longitude.toFixed(6)}</dd>
                </div>
                <div>
                  <dt>Precisão</dt>
                  <dd>{Math.round(signatureRecord.accuracy ?? 0)} m</dd>
                </div>
                <div>
                  <dt>Assinatura</dt>
                  <dd>Traço capturado</dd>
                </div>
                <div>
                  <dt>ID da assinatura</dt>
                  <dd>{signatureRecord.id}</dd>
                </div>
              </dl>
            ) : null}
          </section>

          {activePurchase ? (
            <ClientProfilePanel purchase={activePurchase} onAttachReceipt={attachReceipt} />
          ) : null}
        </section>
        ) : null}

        {isClientRoute && !activePurchase && validPurchases.length > 0 ? (
          <ClientPurchasesChooser purchases={validPurchases} onChoose={setActivePurchaseId} />
        ) : null}

        {isClientRoute && activePurchase ? (
          <ClientProfilePanel purchase={activePurchase} onAttachReceipt={attachReceipt} />
        ) : null}

        {isAdminRoute ? (
        <div className={`admin-layout ${isAdminSidebarOpen ? "sidebar-open" : ""}`}>
          <button
            className="admin-sidebar-backdrop"
            type="button"
            aria-label="Fechar menu administrativo"
            onClick={() => setIsAdminSidebarOpen(false)}
          />
          <aside className="admin-sidebar" aria-label="Menu administrativo">
            <div className="admin-sidebar-brand">
              <LayoutDashboard size={24} />
              <div className="admin-sidebar-brand-copy">
                <strong>ExpoManage</strong>
                <span>Painel administrativo</span>
              </div>
              <button
                className="admin-sidebar-close"
                type="button"
                aria-label="Fechar menu"
                onClick={() => setIsAdminSidebarOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <nav className="admin-nav">
              {(["events", "stands", "payments", "contracts", "settings"] as AdminView[]).map((view) => (
                <button
                  key={view}
                  className={adminView === view ? "is-active" : ""}
                  type="button"
                  onClick={() => {
                    setAdminView(view);
                    setIsAdminSidebarOpen(false);
                  }}
                >
                  {adminViewTitle[view]}
                </button>
              ))}
            </nav>
            <div className="admin-sidebar-user">
              <div className="admin-user-avatar">AP</div>
              <div>
                <strong>APCC</strong>
                <button type="button" onClick={logout}>Sair</button>
              </div>
            </div>
          </aside>

        <section className="admin-pane admin-content" aria-labelledby="dashboard-title">
          <div className="admin-mobile-header">
            <button
              className="admin-sidebar-toggle"
              type="button"
              aria-label="Abrir menu administrativo"
              onClick={() => setIsAdminSidebarOpen(true)}
            >
              <Menu size={18} />
              Menu
            </button>
          </div>
          <div className="section-heading">
            <div>
              <h2 id="dashboard-title" className="sr-only">Dashboard Administrativo</h2>
              <h2>{adminViewTitle[adminView]}</h2>
            </div>
            {adminView !== "events" ? (
              <button className="secondary-action" onClick={exportCsv}>
                <Download size={17} />
                Exportar CSV
              </button>
            ) : null}
          </div>

          {adminView === "events" ? (
          <section className="event-list-panel" aria-label="Eventos cadastrados">
            <div className="panel-title">
              <Building2 size={18} />
              <h3>Meus eventos</h3>
            </div>
            {events.length === 0 ? (
              <p className="empty-state">Nenhum evento cadastrado ainda. Crie o primeiro evento para começar.</p>
            ) : null}
            <div className="event-card-grid">
              {events.map((event) => (
                <article className={`event-card ${event.slug === activeEventSlug ? "is-active" : ""}`} key={event.slug}>
                  <div>
                    <span>{event.slug === activeEventSlug ? "Em gerenciamento" : "Evento disponível"}</span>
                    <strong>{event.name}</strong>
                    <small>{event.slug}</small>
                  </div>
                  <button
                    className={event.slug === activeEventSlug ? "primary-action full" : "secondary-action full"}
                    type="button"
                    onClick={() => openEventManager(event.slug)}
                    aria-label={`Gerenciar ${event.name}`}
                  >
                    Gerenciar
                  </button>
                </article>
              ))}
              <button className="event-card create-event-card" type="button" onClick={openEventCreationWizard}>
                <span>Criar novo</span>
                <strong>Criar evento</strong>
                <small>Configure nome, stands, PIX e link público</small>
              </button>
            </div>
          </section>
          ) : null}

          {adminView === "stands" ? (
          <>
            <section className="stand-manager-board" aria-label="Modelos de stands do evento">
              <div className="stand-manager-head">
                <div>
                  <h3>GERENCIAR STANDS</h3>
                  <label>
                    Selecione o evento
                    <select value={activeEventSlug} onChange={(event) => selectActiveEvent(event.target.value)}>
                      <option value="">Nenhum evento selecionado</option>
                      {events.map((event) => (
                        <option key={event.slug} value={event.slug}>{event.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="stand-manager-actions" aria-label="Alternar visualização de stands">
                  <button
                    className={standManagerMode === "map" ? "stand-tool-button is-active" : "stand-tool-button"}
                    type="button"
                    onClick={() => setStandManagerMode(standManagerMode === "map" ? "models" : "map")}
                  >
                    MAPA
                  </button>
                  <button
                    className={standManagerMode === "config" ? "stand-tool-button is-active" : "stand-tool-button"}
                    type="button"
                    onClick={() => setStandManagerMode(standManagerMode === "config" ? "models" : "config")}
                  >
                    config
                  </button>
                </div>
              </div>

              {activeEvent ? (
              <div className="stand-manager-layout">
                <div className="stand-model-grid">
                  {eventBatches.map((batch, index) => (
                    <article className="stand-model-card" key={`${batch.type}-${batch.size}-${index}`}>
                      <strong>{formatStandModelSize(batch.size)}</strong>
                      <span>{batch.type}</span>
                      <small>{batch.quantity} unidades</small>
                    </article>
                  ))}
                </div>

                {standManagerMode === "map" ? (
                  <FestivalMap
                    stands={stands}
                    mode="admin"
                    selectedStandId={selectedAdminStandId}
                    onStandClick={(stand) => setSelectedAdminStandId(stand.id)}
                  />
                ) : null}

                {standManagerMode === "config" ? (
                  <aside className="stand-model-config" aria-label="Criar modelo de stands">
                    <h4>Criar Modelo de stands</h4>
                    <form onSubmit={addStandModel}>
                      <label>
                        nome
                        <input name="standModelName" />
                      </label>
                      <label>
                        largura
                        <input min="1" name="standModelWidth" type="number" />
                      </label>
                      <label>
                        comprimento
                        <input min="1" name="standModelLength" type="number" />
                      </label>
                      <label>
                        quantidade
                        <input min="1" name="standModelQuantity" type="number" />
                      </label>
                      <button className="stand-create-button" type="submit">CRIAR</button>
                    </form>
                  </aside>
                ) : null}
              </div>
              ) : (
                <p className="empty-state">Crie ou selecione um evento para configurar os stands.</p>
              )}
            </section>

            <div className="stats-grid">
              <Stat label="Total de Estandes" value={stats.totalStands} icon={<Store size={18} />} />
              <Stat label="Disponíveis" value={stats.availableStands} icon={<BookmarkPlus size={18} />} />
              <Stat label="Vendidos" value={stats.soldStands} icon={<Building2 size={18} />} />
              <Stat label="Reservados" value={stats.reservedStands} icon={<MessageSquareText size={18} />} />
            </div>
          </>
          ) : null}

          {adminView === "settings" ? (
          <section className="setup-panel event-wizard" aria-label="Criação guiada do evento">
            <div className="panel-title">
              <Building2 size={18} />
              <h3>Criar evento</h3>
            </div>
            <div className="wizard-steps" aria-label="Etapas de criação do evento">
              {eventCreationSteps.map((item) => (
                <button
                  className={eventCreationStep === item.step ? "is-active" : ""}
                  key={item.step}
                  type="button"
                  onClick={() => goToEventCreationStep(item.step)}
                >
                  <span>{item.step}</span>
                  {item.label}
                </button>
              ))}
            </div>
            <form onSubmit={submitEventSetup}>
              {eventCreationStep === 1 ? (
                <div className="wizard-card">
                  <span className="wizard-kicker">Passo 1 de 4</span>
                  <h4>Dados básicos</h4>
                  <label>
                    Nome do novo evento
                    <input
                      placeholder="Ex: Expo Fortaleza 2027"
                      value={eventName}
                      onChange={(event) => {
                        const nextName = event.target.value;
                        setEventName(nextName);
                        setEventFormSlug(slugify(nextName));
                      }}
                    />
                  </label>
                  <label>
                    URL do formulário
                    <div className="slug-input">
                      <span>/venda?evento=</span>
                      <input
                        placeholder="expo-fortaleza-2027"
                        value={eventFormSlug}
                        onChange={(event) => setEventFormSlug(slugify(event.target.value))}
                      />
                    </div>
                  </label>
                  <button className="primary-action" type="button" onClick={() => goToEventCreationStep(2)}>
                    Avançar para stands
                  </button>
                </div>
              ) : null}

              {eventCreationStep === 2 ? (
                <div className="wizard-card">
                  <span className="wizard-kicker">Passo 2 de 4</span>
                  <h4>Modelos e quantidade de stands</h4>
                  <div className="batch-grid" aria-label="Lotes de estandes do evento">
                    {eventBatches.map((batch, index) => (
                      <div className="batch-row" key={`batch-${index + 1}`}>
                        <strong>Lote {index + 1}</strong>
                        <label>
                          Quantidade lote {index + 1}
                          <input
                            min="0"
                            type="number"
                            value={batch.quantity}
                            onChange={(event) => updateEventBatch(index, "quantity", event.target.value)}
                          />
                        </label>
                        <label>
                          Tamanho lote {index + 1}
                          <input
                            value={batch.size}
                            onChange={(event) => updateEventBatch(index, "size", event.target.value)}
                          />
                        </label>
                        <label>
                          Tipo lote {index + 1}
                          <input
                            value={batch.type}
                            onChange={(event) => updateEventBatch(index, "type", event.target.value)}
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="wizard-actions">
                    <button className="secondary-action" type="button" onClick={() => goToEventCreationStep(1)}>
                      Voltar
                    </button>
                    <button className="primary-action" type="button" onClick={() => goToEventCreationStep(3)}>
                      Avançar para pagamento
                    </button>
                  </div>
                </div>
              ) : null}

              {eventCreationStep === 3 ? (
                <div className="wizard-card">
                  <span className="wizard-kicker">Passo 3 de 4</span>
                  <h4>PIX e link público</h4>
                  <label>
                    PIX copia e cola do evento
                    <textarea
                      placeholder="Cole aqui o PIX copia e cola que será exibido para o expositor"
                      value={paymentConfig.pixCopyPaste}
                      onChange={(event) => setPaymentConfig((current) => ({
                        ...current,
                        eventSlug: draftEventSlug,
                        pixCopyPaste: event.target.value
                      }))}
                      rows={4}
                    />
                  </label>
                  <label>
                    Prévia do link público
                    <input readOnly value={draftSalesFormLink} />
                  </label>
                  <div className="wizard-actions">
                    <button className="secondary-action" type="button" onClick={() => goToEventCreationStep(2)}>
                      Voltar
                    </button>
                    <button className="primary-action" type="button" onClick={() => goToEventCreationStep(4)}>
                      Revisar evento
                    </button>
                  </div>
                </div>
              ) : null}

              {eventCreationStep === 4 ? (
                <div className="wizard-card wizard-review">
                  <span className="wizard-kicker">Passo 4 de 4</span>
                  <h4>Revisão final</h4>
                  <div className="review-grid">
                    <span>Evento<strong>{eventName || "Nome pendente"}</strong></span>
                    <span>URL<strong>{draftEventSlug || "url-pendente"}</strong></span>
                    <span>Stands<strong>{generateStandsFromBatches(eventBatches, draftEventSlug).length}</strong></span>
                    <span>PIX<strong>{paymentConfig.pixCopyPaste.trim() ? "Configurado" : "Pode configurar depois"}</strong></span>
                  </div>
                  <div className="wizard-actions">
                    <button className="secondary-action" type="button" onClick={() => goToEventCreationStep(3)}>
                      Voltar
                    </button>
                    <button className="primary-action" type="submit">
                      Criar evento e gerar stands
                    </button>
                  </div>
                </div>
              ) : null}
            </form>
          </section>
          ) : null}

          {adminView === "eventManage" && managedEvent ? (
          <section className="setup-panel event-manage-panel" aria-label={`Gerenciamento de ${managedEvent.name}`}>
            <div className="panel-title">
              <Building2 size={18} />
              <h3>{managedEvent.name}</h3>
            </div>
            <div className="event-management-grid">
              <article className="event-management-card">
                <span>Status</span>
                <strong>{inactiveEventSlugs.includes(managedEvent.slug) ? "Inativo" : "Ativo"}</strong>
                <button className="secondary-action full" type="button" onClick={toggleManagedEventActive}>
                  {inactiveEventSlugs.includes(managedEvent.slug) ? <RotateCcw size={17} /> : <Power size={17} />}
                  {inactiveEventSlugs.includes(managedEvent.slug) ? "Reativar evento" : "Inativar evento"}
                </button>
              </article>
              <article className="event-management-card">
                <span>Stands</span>
                <strong>{stands.length}</strong>
                <button className="secondary-action full" type="button" onClick={() => setAdminView("stands")}>
                  <Store size={17} />
                  Gerenciar stands
                </button>
              </article>
            </div>
            <div className="sales-link-box">
              <div>
                <strong>URL do formulário</strong>
                <p>Defina o endereço público que será enviado para os expositores.</p>
              </div>
              <div className="generated-link">
                <label>
                  Slug do formulário
                  <div className="slug-input">
                    <span>/venda?evento=</span>
                    <input
                      value={managedFormSlug}
                      onChange={(event) => {
                        const nextSlug = slugify(event.target.value);
                        setManagedFormSlug(nextSlug);
                        setManagedFormLink(buildSalesFormLink(nextSlug));
                      }}
                    />
                  </div>
                </label>
                <label>
                  Link público do formulário de venda
                  <input readOnly value={managedFormLink || buildSalesFormLink(managedFormSlug || managedEvent.slug)} />
                </label>
                <div className="link-actions">
                  <button className="primary-action" type="button" onClick={saveManagedFormUrl}>
                    <Share2 size={17} />
                    Salvar URL do formulário
                  </button>
                  <button className="secondary-action" type="button" onClick={copyManagedFormLink}>
                    <Copy size={17} />
                    Copiar link
                  </button>
                  <a className="secondary-action" href={managedFormLink || buildSalesFormLink(managedEvent.slug)}>
                    <ExternalLink size={17} />
                    Abrir formulário
                  </a>
                </div>
              </div>
            </div>
            <div className="payment-config-box">
              <label>
                PIX copia e cola do evento
                <textarea
                  value={paymentConfig.pixCopyPaste}
                  onChange={(event) => {
                    setPaymentSaveState("idle");
                    setPaymentSaveMessage("");
                    setPaymentConfig((current) => ({
                      ...current,
                      eventSlug: managedEvent.slug,
                      pixCopyPaste: event.target.value
                    }));
                  }}
                  rows={4}
                />
              </label>
              <button
                className="secondary-action full"
                type="button"
                onClick={savePaymentConfig}
                disabled={paymentSaveState === "saving"}
              >
                <Copy size={17} />
                {paymentSaveState === "saving" ? "Salvando PIX..." : "Salvar PIX do evento"}
              </button>
              {paymentSaveMessage ? (
                <p className={`inline-save-status ${paymentSaveState}`} aria-live="polite">
                  {paymentSaveMessage}
                </p>
              ) : null}
            </div>
            <div className="danger-zone">
              <div>
                <strong>Excluir evento</strong>
                <p>Remove este evento e os dados vinculados no banco.</p>
              </div>
              <button className="danger-action" type="button" onClick={removeManagedEvent}>
                <Trash2 size={17} />
                Excluir evento
              </button>
            </div>
          </section>
          ) : null}

          {adminView === "eventManage" && !managedEvent ? (
            <section className="setup-panel event-manage-panel">
              <p className="empty-state">Nenhum evento selecionado para gerenciar.</p>
              <button className="primary-action" type="button" onClick={openEventCreationWizard}>
                Criar evento
              </button>
            </section>
          ) : null}

          {adminView === "stands" ? (
          <section className="table-panel" aria-label="Gestão de Estandes - Admin">
            <div className="panel-title">
              <ListFilter size={18} />
              <h3>Gestão de Estandes</h3>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Estande / ID</th>
                    <th>Tipo / Metragem</th>
                    <th>Expositor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stands.length === 0 ? (
                    <tr>
                      <td colSpan={4}>Nenhum stand cadastrado para este evento.</td>
                    </tr>
                  ) : stands.map((stand) => (
                    <tr key={stand.id}>
                      <td><strong>{stand.code}</strong><span>{stand.id}</span></td>
                      <td>{stand.type} / {stand.size}</td>
                      <td>{stand.exhibitor ?? "---"}</td>
                      <td>
                        <select
                          className="table-select"
                          aria-label={`Status ${stand.code}`}
                          value={stand.status}
                          onChange={(event) => updateStandStatus(stand.id, event.target.value as StandStatus)}
                        >
                          <option value="available">Disponível</option>
                          <option value="sold">Vendido</option>
                          <option value="reserved">Reservado</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          ) : null}

          {adminView === "payments" ? (
          <section className="table-panel" aria-label="Pagamentos de Clientes - Admin">
            <div className="panel-title">
              <Paperclip size={18} />
              <h3>Pagamentos de Clientes</h3>
            </div>
            {validPurchases.length === 0 ? (
              <p className="empty-state">Nenhum pagamento aguardando análise.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Contrato</th>
                      <th>Parcela</th>
                      <th>Status / Comprovante</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validPurchases.flatMap((purchase) =>
                      purchase.installments.map((installment) => (
                        <tr key={`${purchase.id}-${installment.id}`}>
                          <td>{purchase.clientName}<span>{purchase.stand.code} / {purchase.stand.size}</span></td>
                          <td><a href={expoApi.contractDownloadUrl(purchase.id)}>Contrato</a></td>
                          <td>{installment.label}<span>{formatCurrency(installment.amount)}</span></td>
                          <td>
                            <span className={`payment-status ${installment.status}`}>
                              {paymentInstallmentStatusLabels[installment.status]}
                            </span>
                            {installment.receipt ? (
                              <a className="receipt-link" href={installment.receipt.url}>
                                Visualizar comprovante {installment.label}
                              </a>
                            ) : (
                              <span className="missing-receipt">Sem comprovante</span>
                            )}
                          </td>
                          <td>
                            <button
                              className={`secondary-action payment-confirm-action ${!installment.receipt ? "is-waiting" : ""}`}
                              disabled={!installment.receipt || installment.status === "paid"}
                              onClick={() => markInstallmentPaid(purchase.id, installment.id)}
                              type="button"
                              aria-label={
                                installment.receipt
                                  ? `Marcar ${installment.label} de ${purchase.clientName} como paga`
                                  : `Aguardando comprovante da ${installment.label} de ${purchase.clientName}`
                              }
                            >
                              <CheckCircle2 size={16} />
                              {installment.receipt ? "Confirmar pagamento" : "Aguardando comprovante"}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          ) : null}

          {adminView === "contracts" ? (
          <section className="table-panel" aria-label="Contratos de Clientes - Admin">
            <div className="panel-title">
              <FileSignature size={18} />
              <h3>Contratos</h3>
            </div>
            {validPurchases.length === 0 ? (
              <p className="empty-state">Nenhum contrato gerado para este evento.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Estande</th>
                      <th>Status pagamento</th>
                      <th>Contrato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validPurchases.map((purchase) => (
                      <tr key={purchase.id}>
                        <td>{purchase.clientName}<span>{purchase.clientEmail}</span></td>
                        <td>{purchase.stand.code}<span>{purchase.stand.size}</span></td>
                        <td>{purchase.paymentStatus}</td>
                        <td><a href={expoApi.contractDownloadUrl(purchase.id)}>Baixar contrato</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          ) : null}
        </section>
        </div>
        ) : null}
      </main>
    </div>
  );
}

function ClientProfilePanel(props: {
  purchase: ClientPurchaseProfile;
  onAttachReceipt: (purchaseId: string, installmentId: string, files: FileList | null) => void;
}) {
  const pixCopyPaste = props.purchase.pixCopyPaste || defaultPixCopyPaste;

  return (
    <section className="client-profile-panel" aria-label="Perfil do Cliente">
      <div className="panel-title">
        <UserCircle size={18} />
        <h3>Perfil do Cliente</h3>
      </div>
      <div className="profile-hero">
        <div>
          <span>Cliente</span>
          <strong>{props.purchase.clientName}</strong>
        </div>
        <div>
          <span>Stand comprado</span>
          <strong>{props.purchase.stand.code} · {props.purchase.stand.size}</strong>
        </div>
        <span className="payment-pill">{props.purchase.paymentStatus}</span>
      </div>
      <a className="primary-action full" href={expoApi.contractDownloadUrl(props.purchase.id)}>
        <Download size={17} />
        Baixar contrato
      </a>
      <div className="pix-box">
        <div>
          <strong>PIX copia e cola</strong>
          <p>Use este código para pagar a 1ª parcela imediata e anexe o comprovante abaixo.</p>
        </div>
        <textarea aria-label="PIX copia e cola" readOnly value={pixCopyPaste} />
        <button
          className="secondary-action full"
          type="button"
          onClick={() => void window.navigator.clipboard?.writeText(pixCopyPaste)}
        >
          <Copy size={17} />
          Copiar PIX
        </button>
      </div>
      <div className="installment-list">
        {props.purchase.installments.map((installment) => (
          <article className="installment-card" key={installment.id}>
            <div>
              <strong>{installment.label}</strong>
              <span>{installment.dueLabel}</span>
            </div>
            <b>{formatCurrency(installment.amount)}</b>
            <span className={`payment-status ${installment.status}`}>
              {paymentInstallmentStatusLabels[installment.status]}
            </span>
            <label>
              Comprovante {installment.label}
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(event) => props.onAttachReceipt(props.purchase.id, installment.id, event.target.files)}
              />
            </label>
          </article>
        ))}
      </div>
    </section>
  );
}

function ClientPurchasesChooser(props: {
  purchases: ClientPurchaseProfile[];
  onChoose: (purchaseId: string) => void;
}) {
  return (
    <section className="client-profile-panel" aria-label="Compras do Cliente">
      <div className="panel-title">
        <UserCircle size={18} />
        <h3>Escolha o evento</h3>
      </div>
      <div className="purchase-choice-grid">
        {props.purchases.map((purchase) => (
          <article className="purchase-choice-card" key={purchase.id}>
            <div>
              <span>Evento</span>
              <strong>{purchase.eventSlug ?? defaultExpoEvent.slug}</strong>
            </div>
            <div>
              <span>Stand comprado</span>
              <strong>{purchase.stand.code} · {purchase.stand.size}</strong>
            </div>
            <button
              className="primary-action full"
              type="button"
              onClick={() => props.onChoose(purchase.id)}
              aria-label={`Abrir ${purchase.eventSlug ?? defaultExpoEvent.slug} ${purchase.stand.code} ${purchase.stand.size}`}
            >
              Abrir pagamentos
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function captureSignaturePosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      (firstError) => {
        if (firstError.code === firstError.PERMISSION_DENIED) {
          reject(firstError);
          return;
        }

        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          maximumAge: 300000,
          timeout: 15000
        });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  });
}

function formatGeolocationError(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return "Permissão de localização bloqueada para este site. Libere a localização no navegador para assinar.";
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return "A localização foi permitida, mas o navegador não conseguiu encontrar sua posição. Verifique GPS/Wi-Fi e tente novamente.";
  }

  if (error.code === error.TIMEOUT) {
    return "A localização foi permitida, mas demorou para responder. Tente novamente em alguns segundos.";
  }

  return "Não foi possível capturar a localização. Tente novamente para assinar.";
}

function Stat(props: { label: string; value: number; icon: ReactNode }) {
  return (
    <article className="stat" aria-label={`${props.label}: ${props.value}`}>
      <span>{props.icon}</span>
      <p>{props.label}</p>
      <strong>{props.value}</strong>
    </article>
  );
}

function readSignaturePoint(event: PointerEvent<HTMLDivElement>): SignaturePoint {
  const rect = event.currentTarget.getBoundingClientRect();
  const width = rect.width || 320;
  const height = rect.height || 140;
  const left = rect.left || 0;
  const top = rect.top || 0;

  return {
    x: Math.max(0, Math.min(320, ((event.clientX - left) / width) * 320)),
    y: Math.max(0, Math.min(140, ((event.clientY - top) / height) * 140))
  };
}

function serializeSignature(points: SignaturePoint[]): string {
  return points.map((point) => `${Math.round(point.x)},${Math.round(point.y)}`).join(" ");
}

function signaturePointsToPngDataUrl(points: SignaturePoint[]): string {
  const fallbackPng = "data:image/png;base64,iVBORw0KGgo=";

  if (import.meta.env.MODE === "test") {
    return fallbackPng;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 140;
  const context = (() => {
    try {
      return canvas.getContext("2d");
    } catch {
      return null;
    }
  })();

  if (!context || points.length < 2) {
    return fallbackPng;
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#111827";
  context.lineWidth = 4;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);

  for (const point of points.slice(1)) {
    context.lineTo(point.x, point.y);
  }

  context.stroke();

  try {
    return canvas.toDataURL("image/png");
  } catch {
    return fallbackPng;
  }
}

function buildSalesFormLink(eventSlug: string): string {
  const slug = slugify(eventSlug || defaultExpoEvent.slug);
  return `${window.location.origin}/venda?evento=${slug}&form=venda#formulario-venda`;
}

function buildPublicAssetUrl(key: string): string {
  return `${publicAssetBaseUrl.replace(/\/+$/g, "")}/${key.replace(/^\/+/g, "")}`;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readEventSlugFromUrl(): string {
  return slugify(new URLSearchParams(window.location.search).get("evento") ?? "");
}

function extractYear(value: string): number | undefined {
  const year = value.match(/\b(20\d{2})\b/)?.[1];
  return year ? Number(year) : undefined;
}
