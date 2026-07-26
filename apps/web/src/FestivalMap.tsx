import { Sparkles } from "lucide-react";
import { type Stand, standStatusLabels } from "@expomanage/shared";

export type FestivalMapMode = "public" | "admin";

type FestivalMapProps = {
  stands: Stand[];
  mode: FestivalMapMode;
  selectedStandId?: string;
  onStandClick: (stand: Stand) => void;
};

type StandGroup = {
  businessLeft: Stand[];
  businessRight: Stand[];
  food: Stand[];
  fallback: Stand[];
};

type LeftSideItem =
  | { kind: "street"; label: string }
  | { kind: "landmark"; label: string; detail: string };

const leftSideItems: LeftSideItem[] = [
  { kind: "street", label: "Rua Santos Dumont" },
  { kind: "landmark", label: "Sefaz", detail: "Serviços públicos" },
  { kind: "street", label: "Tv. Cel. Valente" },
  { kind: "landmark", label: "Teatro Francisca Clotilde", detail: "Simpósio" },
  { kind: "street", label: "R. Barão de Messejanas" },
  { kind: "landmark", label: "Instituto do Museu Jaguaribano", detail: "Referência local" },
  { kind: "landmark", label: "Aracaty Club", detail: "Clube social" }
];

function standNumber(stand: Stand) {
  const numericCode = stand.code.match(/\d+/)?.[0] ?? "0";
  return Number(numericCode);
}

function isBusinessStand(stand: Stand) {
  return stand.code.startsWith("N-") || stand.type?.toLowerCase().includes("negócios");
}

function isFoodStand(stand: Stand) {
  return stand.code.startsWith("G-") || stand.type?.toLowerCase().includes("gastron");
}

function sortByStandNumber(first: Stand, second: Stand) {
  return standNumber(first) - standNumber(second);
}

function standMapLabel(stand: Stand) {
  const numericCode = stand.code.match(/\d+/)?.[0];
  return numericCode ?? stand.code;
}

function buildStandAriaLabel(stand: Stand, isSelected: boolean) {
  return `${standStatusLabels[stand.status]} ${stand.code} ${stand.size}${isSelected ? " selecionado" : ""}`;
}

function groupStands(stands: Stand[]): StandGroup {
  const business = [...stands].filter(isBusinessStand).sort(sortByStandNumber);
  const food = [...stands].filter(isFoodStand).sort(sortByStandNumber);
  const fallback = [...stands].filter((stand) => !isBusinessStand(stand) && !isFoodStand(stand));
  const businessMidpoint = Math.ceil(business.length / 2);

  return {
    businessLeft: business.slice(0, businessMidpoint).reverse(),
    businessRight: business.slice(businessMidpoint),
    food,
    fallback
  };
}

function StandButton({
  stand,
  isSelected,
  mode,
  onClick
}: {
  stand: Stand;
  isSelected: boolean;
  mode: FestivalMapMode;
  onClick: (stand: Stand) => void;
}) {
  const isInteractive = mode === "admin" || stand.status === "available" || isSelected;

  return (
    <button
      type="button"
      className={`festival-map-stand ${stand.status} ${isSelected ? "is-selected" : ""} ${mode === "admin" ? "is-admin" : ""}`}
      disabled={!isInteractive}
      onClick={() => onClick(stand)}
      aria-pressed={isSelected}
      aria-label={buildStandAriaLabel(stand, isSelected)}
      title={`${stand.code} · ${stand.size} · ${standStatusLabels[stand.status]}`}
    >
      <strong>{standMapLabel(stand)}</strong>
      <span>{stand.size}</span>
    </button>
  );
}

function WalkwayTrees({ count }: { count: number }) {
  return (
    <div className="fmap-walkway" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className={index % 2 === 0 ? "fmap-tree" : "fmap-bench"} />
      ))}
    </div>
  );
}

export function FestivalMap({ stands, mode, selectedStandId, onStandClick }: FestivalMapProps) {
  const groups = groupStands(stands);
  const selectedStand = stands.find((stand) => stand.id === selectedStandId) ?? null;
  const isFestivalLayout = groups.businessLeft.length > 0 || groups.businessRight.length > 0 || groups.food.length > 0;
  const businessTotal = groups.businessLeft.length + groups.businessRight.length;
  const walkwayTreeCount = Math.min(16, Math.max(4, Math.ceil(groups.businessLeft.length / 3)));

  return (
    <div
      className={`festival-map-shell ${mode === "admin" ? "is-admin" : "is-public"}`}
      aria-label={mode === "admin" ? "Prévia do mapa do evento" : "Mapa interativo do evento"}
    >
      <div className="festival-map-header">
        <div className="festival-map-header-copy">
          <span>Mapa interativo</span>
          <h3>{isFestivalLayout ? "Feira Gastronômica e Feira de Negócios" : "Mapa do evento"}</h3>
        </div>
        <div className="festival-map-header-badge">
          <Sparkles size={14} />
          <span>{mode === "admin" ? "Clique para inspecionar" : "Clique para reservar"}</span>
        </div>
      </div>

      {mode === "admin" ? (
        <p className="festival-map-selection" aria-live="polite">
          {selectedStand ? `Estande selecionado: ${selectedStand.code}` : "Clique em um estande para destacá-lo."}
        </p>
      ) : null}

      {isFestivalLayout ? (
        <div className="fmap">
          <div className="fmap-top">
            <div className="fmap-praca" aria-hidden="true">
              <span className="fmap-restrooms">20 Banheiros Químicos</span>
              <strong>Praça Doutor Leite</strong>
              <em>Espaço Kids</em>
              <span className="fmap-stage">Palco</span>
            </div>

            <div className="fmap-top-right">
              <section className="fmap-food" aria-label="Feira Gastronômica">
                <header>Feira Gastronômica</header>
                <div className="fmap-food-grid">
                  {groups.food.map((stand) => (
                    <StandButton
                      key={stand.id}
                      stand={stand}
                      isSelected={selectedStand?.id === stand.id}
                      mode={mode}
                      onClick={onStandClick}
                    />
                  ))}
                </div>
                <div className="fmap-food-road">Av. Cel. Alexanzito</div>
              </section>
              <div className="fmap-cross-street" aria-hidden="true">Tv. Rad. Carlos Kramer</div>
              <div className="fmap-truck" aria-hidden="true">Carreta · Workshops</div>
            </div>
          </div>

          <div className="fmap-body">
            <aside className="fmap-side fmap-side--left" aria-hidden="true">
              <span className="fmap-street-vertical">R. Padre de Sá Leitão</span>
              <div className="fmap-side-items">
                {leftSideItems.map((item) =>
                  item.kind === "street" ? (
                    <span className="fmap-street" key={item.label}>{item.label}</span>
                  ) : (
                    <article className="fmap-landmark" key={item.label}>
                      <strong>{item.label}</strong>
                      <span>{item.detail}</span>
                    </article>
                  )
                )}
              </div>
            </aside>

            <section className="fmap-business" aria-label="Feira de Negócios">
              <div className="fmap-business-grid">
                <div className="festival-map-column" aria-label="Coluna esquerda da Feira de Negócios">
                  {groups.businessLeft.map((stand) => (
                    <StandButton
                      key={stand.id}
                      stand={stand}
                      isSelected={selectedStand?.id === stand.id}
                      mode={mode}
                      onClick={onStandClick}
                    />
                  ))}
                </div>

                <WalkwayTrees count={walkwayTreeCount} />

                <div className="festival-map-column" aria-label="Coluna direita da Feira de Negócios">
                  {groups.businessRight.map((stand) => (
                    <StandButton
                      key={stand.id}
                      stand={stand}
                      isSelected={selectedStand?.id === stand.id}
                      mode={mode}
                      onClick={onStandClick}
                    />
                  ))}
                </div>
              </div>
            </section>

            <aside className="fmap-side fmap-side--right" aria-hidden="true">
              <span className="fmap-street-vertical">R. Padre de Sá Leitão</span>
            </aside>
          </div>

          <div className="fmap-avenue" aria-hidden="true">
            <span className="fmap-crosswalk" />
            <span>Av. Cel. Alexanzito</span>
            <span className="fmap-crosswalk" />
          </div>

          <aside className="fmap-legend" aria-hidden="true">
            <span><i className="festival-swatch business" /> Feira de Negócios ({businessTotal} estandes)</span>
            <span><i className="festival-swatch food" /> Feira Gastronômica ({groups.food.length} barracas)</span>
            <span><i className="festival-swatch kids" /> Espaço Kids</span>
            <span><i className="festival-swatch stage" /> Espaço de Entretenimento</span>
            <span><i className="festival-swatch restroom" /> Banheiros Químicos</span>
          </aside>
        </div>
      ) : (
        <div className="fmap fmap--fallback">
          <section className="fmap-fallback-zone" aria-label="Mapa compacto de estandes">
            <header aria-hidden="true">Seleção rápida</header>
            <div className="fmap-fallback-grid">
              {groups.fallback.map((stand) => (
                <StandButton
                  key={stand.id}
                  stand={stand}
                  isSelected={selectedStand?.id === stand.id}
                  mode={mode}
                  onClick={onStandClick}
                />
              ))}
            </div>
          </section>
          <aside className="fmap-legend fmap-legend--inline" aria-hidden="true">
            <span><i className="festival-swatch business" /> Disponível</span>
            <span><i className="festival-swatch stage" /> Vendido</span>
            <span><i className="festival-swatch restroom" /> Reservado</span>
          </aside>
        </div>
      )}
    </div>
  );
}
