import { Landmark, MapPinned, Sparkles, Trees } from "lucide-react";
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

  return {
    businessLeft: business.filter((stand) => standNumber(stand) <= 40).sort((first, second) => standNumber(second) - standNumber(first)),
    businessRight: business.filter((stand) => standNumber(stand) > 40),
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
    >
      <strong>{standMapLabel(stand)}</strong>
      <span>{stand.size}</span>
    </button>
  );
}

export function FestivalMap({ stands, mode, selectedStandId, onStandClick }: FestivalMapProps) {
  const groups = groupStands(stands);
  const selectedStand = stands.find((stand) => stand.id === selectedStandId) ?? null;
  const isFestivalLayout = groups.businessLeft.length > 0 || groups.businessRight.length > 0 || groups.food.length > 0;

  return (
    <div
      className={`festival-map-shell ${mode === "admin" ? "is-admin" : "is-public"}`}
      aria-label={mode === "admin" ? "Prévia do mapa do evento" : "Mapa interativo do evento"}
    >
      <div className="festival-map-orbit festival-map-orbit-one" aria-hidden="true" />
      <div className="festival-map-orbit festival-map-orbit-two" aria-hidden="true" />

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
        <div className="festival-map-canvas">
          <section className="festival-map-food-zone" aria-label="Feira Gastronômica">
            <div className="festival-map-zone-tag">
              <MapPinned size={14} />
              <span>Feira Gastronômica</span>
            </div>
            <div className="festival-map-road-label">Av. Cel. Alexanzito</div>
            <div className="festival-map-food-grid">
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
          </section>

          <div className="festival-map-main">
            <aside className="festival-map-landmarks" aria-hidden="true">
              <article className="festival-landmark festival-landmark--purple">
                <Trees size={28} />
                <strong>Praça Doutor Leite</strong>
                <span>Área kids e descanso</span>
              </article>
              <article className="festival-landmark festival-landmark--white">
                <Landmark size={28} />
                <strong>Sefaz</strong>
                <span>Serviços públicos</span>
              </article>
              <article className="festival-landmark festival-landmark--white">
                <Landmark size={28} />
                <strong>Teatro Francisca Clotilde</strong>
                <span>Espaço cultural</span>
              </article>
              <article className="festival-landmark festival-landmark--white">
                <Landmark size={28} />
                <strong>Instituto do Museu Jaguaribano</strong>
                <span>Referência local</span>
              </article>
            </aside>

            <section className="festival-map-business-zone" aria-label="Feira de Negócios">
              <div className="festival-map-zone-tag festival-map-zone-tag--business">
                <MapPinned size={14} />
                <span>Feira de Negócios</span>
              </div>

              <div className="festival-map-business-grid">
                <div className="festival-map-column">
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

                <div className="festival-map-walkway" aria-hidden="true">
                  {Array.from({ length: 8 }, (_, index) => (
                    <span key={index} />
                  ))}
                </div>

                <div className="festival-map-column">
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

              <div className="festival-map-street festival-map-street--bottom">Av. Cel. Alexanzito</div>
            </section>

            <aside className="festival-map-legend" aria-hidden="true">
              <div className="festival-map-legend-card">
                <span><i className="festival-swatch business" /> Feira de Negócios</span>
                <span><i className="festival-swatch food" /> Feira Gastronômica</span>
                <span><i className="festival-swatch kids" /> Espaço Kids</span>
                <span><i className="festival-swatch stage" /> Palco</span>
                <span><i className="festival-swatch restroom" /> Banheiros</span>
              </div>
            </aside>
          </div>
        </div>
      ) : (
        <div className="festival-map-canvas festival-map-canvas--fallback">
          <aside className="festival-map-landmarks" aria-hidden="true">
            <article className="festival-landmark festival-landmark--purple">
              <Trees size={28} />
              <strong>Praça Doutor Leite</strong>
              <span>Área kids e descanso</span>
            </article>
            <article className="festival-landmark festival-landmark--white">
              <Landmark size={28} />
              <strong>Entorno do evento</strong>
              <span>Mapa compacto para seleção rápida</span>
            </article>
          </aside>

          <section className="festival-map-fallback-zone" aria-label="Mapa compacto de estandes">
            <div className="festival-map-zone-tag festival-map-zone-tag--fallback">
              <MapPinned size={14} />
              <span>Seleção rápida</span>
            </div>
            <div className="festival-map-fallback-grid">
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

          <aside className="festival-map-legend" aria-hidden="true">
            <div className="festival-map-legend-card">
              <span><i className="festival-swatch business" /> Disponível</span>
              <span><i className="festival-swatch food" /> Vendido</span>
              <span><i className="festival-swatch stage" /> Reservado</span>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
