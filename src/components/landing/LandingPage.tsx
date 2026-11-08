/**
 * Landing Page pública em "/" — vitrine do Banco de Currículos.
 *
 * Redesign premium alinhado ao /login (painel bordô, anéis dourados, serifa
 * Literata, cantos grandes). Princípios aplicados (skills emil-design-eng e
 * apple-design):
 *  - Movimento com propósito: entrada do hero (rara, pode ter "delight"),
 *    revelação ao rolar (transition, interrompível), contagem do match,
 *    barras e colunas que crescem só quando entram na tela.
 *  - Só transform/opacity/filter; curva forte cubic-bezier(0.23,1,0.32,1);
 *    press com scale(0.97); hover só em mouse (hover:hover + pointer:fine).
 *  - Paralaxe do hero com suavização (lerp ~ mola amortecida), desligada em
 *    toque e em prefers-reduced-motion. Cabeçalho em material translúcido.
 *  - Tipografia: títulos grandes com tracking negativo e leading curto.
 *  - Dark mode: usa os tokens remapeados do index.css; fundos translúcidos
 *    ganham variante `dark:` explícita.
 *
 * Landmark main único #conteudo (destino do skip-link do App, [S8-2]).
 * Os CTAs levam a "/login" via `onNavigate` (SPA, sem reload).
 */
import {
  createElement,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Building2,
  Calendar,
  Check,
  FileText,
  GraduationCap,
  Kanban,
  Target,
} from "lucide-react";

type LandingPageProps = {
  /** Navegação SPA para "/login" (sem reload da página). */
  onNavigate: (path: string) => void;
};

const BENEFITS = [
  {
    icon: FileText,
    title: "Gerador de CV em PDF",
    description:
      "Monte seu currículo no portal com skills, idiomas e disponibilidade e exporte um PDF profissional em minutos.",
  },
  {
    icon: Target,
    title: "Match Score Inteligente",
    description:
      "Cada candidatura mostra a compatibilidade do seu perfil com a vaga, calculada no servidor com dados reais do seu currículo.",
  },
  {
    icon: Kanban,
    title: "Gestão Ágil de Vagas",
    description:
      "Empresas publicam vagas e acompanham o funil completo em um Kanban auditável, do inscrito à contratação.",
  },
] as const;

const STEPS = [
  {
    title: "Crie seu perfil",
    description:
      "Cadastre-se como aluno, monte seu currículo e deixe seu talento visível para as empresas parceiras.",
  },
  {
    title: "Candidate-se às vagas",
    description:
      "Veja o Match Score de cada oportunidade e candidate-se em um clique.",
  },
  {
    title: "Acompanhe cada etapa",
    description:
      "Triagem, entrevista e resultado em tempo real, você sabe exatamente onde está em cada processo seletivo.",
  },
] as const;

const CONTACT_DEMO = [
  { id: "dados", vaga: "Analista de Dados Jr.", initial: true },
  { id: "front", vaga: "Desenvolvedor(a) Front-end", initial: false },
  { id: "mkt", vaga: "Estágio em Marketing Digital", initial: false },
] as const;

const KANBAN = [
  { name: "Inscritos", cards: 3 },
  { name: "Triagem", cards: 2 },
  { name: "Entrevista", cards: 2 },
  { name: "Contratados", cards: 1 },
] as const;

const CARD =
  "rounded-[2rem] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04),0_16px_40px_-20px_rgba(15,23,42,0.16)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)]";

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

/** true quando o elemento entra na tela (uma vez). Sem IO, mostra tudo. */
function useInView<T extends Element>(threshold = 0.25) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (node === null) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen] as const;
}

/** Contagem 0→alvo com ease-out forte; sem movimento → valor final direto. */
function useCountUp(target: number, active: boolean, duration = 1400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setValue(Math.round(target * (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, target, duration]);
  return value;
}

/**
 * Paralaxe do palco do hero: o ponteiro define um alvo e um rAF suaviza
 * (decaimento exponencial, sem overshoot). Só em mouse e sem reduced-motion.
 * Escreve `transform` direto em cada camada (sem CSS vars no pai).
 */
function useParallax(stageRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const stage = stageRef.current;
    if (stage === null) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || reduce.matches) return;

    const host = stage.closest<HTMLElement>("[data-parallax-host]") ?? stage;
    const layers = Array.from(stage.querySelectorAll<HTMLElement>("[data-depth]"));
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let frame = 0;

    const paint = () => {
      current.x += (target.x - current.x) * 0.08;
      current.y += (target.y - current.y) * 0.08;
      for (const layer of layers) {
        const depth = Number(layer.dataset.depth ?? "0");
        const tilt =
          layer.dataset.tilt === undefined
            ? ""
            : ` rotateY(${(current.x * 3).toFixed(2)}deg) rotateX(${(current.y * -3).toFixed(2)}deg)`;
        layer.style.transform = `translate3d(${(current.x * depth * 14).toFixed(2)}px, ${(current.y * depth * 10).toFixed(2)}px, 0)${tilt}`;
      }
      const settled =
        Math.abs(target.x - current.x) < 0.001 &&
        Math.abs(target.y - current.y) < 0.001;
      frame = settled ? 0 : requestAnimationFrame(paint);
    };
    const kick = () => {
      if (frame === 0) frame = requestAnimationFrame(paint);
    };
    const onMove = (event: PointerEvent) => {
      const box = host.getBoundingClientRect();
      target.x = ((event.clientX - box.left) / box.width - 0.5) * 2;
      target.y = ((event.clientY - box.top) / box.height - 0.5) * 2;
      kick();
    };
    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      kick();
    };
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    return () => {
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(frame);
      for (const layer of layers) layer.style.transform = "";
    };
  }, [stageRef]);
}

/* ------------------------------------------------------------------ */
/* Peças                                                               */
/* ------------------------------------------------------------------ */

/** Revela ao rolar: fade + subida curta + blur de 3px (transition → interrompível). */
function Reveal({
  children,
  delay = 0,
  as = "div",
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  as?: "div" | "li";
  className?: string;
}) {
  const [ref, seen] = useInView<HTMLDivElement>();
  return createElement(
    as as "div",
    {
      ref,
      style: { transitionDelay: seen ? `${delay}ms` : "0ms" },
      className: `transition-[opacity,transform,filter] duration-[800ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-opacity motion-reduce:duration-200 ${
        seen
          ? "translate-y-0 opacity-100 blur-0"
          : "translate-y-5 opacity-0 blur-[3px] motion-reduce:translate-y-0 motion-reduce:blur-0"
      } ${className}`,
    },
    children,
  );
}

/** Anel de progresso (pathLength=1): o traço cresce quando `active`. */
function ScoreRing({ value, active }: { value: number; active: boolean }) {
  const shown = useCountUp(value, active);
  return (
    <span className="relative grid h-16 w-16 shrink-0 place-items-center">
      <svg viewBox="0 0 64 64" fill="none" className="absolute inset-0 -rotate-90">
        <circle cx="32" cy="32" r="27" strokeWidth="5" className="stroke-slate-200" />
        <circle
          cx="32"
          cy="32"
          r="27"
          pathLength={1}
          strokeWidth="5"
          strokeLinecap="round"
          className="stroke-success transition-[stroke-dashoffset] duration-[1400ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
          style={{ strokeDasharray: 1, strokeDashoffset: active ? 1 - value / 100 : 1 }}
        />
      </svg>
      <span className="font-serif text-base font-bold tabular-nums text-slate-900">
        {shown}%
      </span>
    </span>
  );
}

/** Anéis concêntricos dourados — mesma assinatura do painel do login. */
function Rings({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 600 600"
      fill="none"
      className={`pointer-events-none absolute -rotate-90 ${className}`}
    >
      {[60, 110, 160, 210, 260].map((radius, index) => (
        <circle
          key={radius}
          cx="300"
          cy="300"
          r={radius}
          pathLength={1}
          strokeWidth={index === 3 ? 1.5 : 1}
          stroke={index === 3 ? "#c89d3c" : "#ffffff"}
          strokeOpacity={index === 3 ? 0.6 : 0.14}
          className="auth-draw"
          style={{ animationDelay: `${200 + index * 160}ms` }}
        />
      ))}
    </svg>
  );
}

function LogoChip({ className }: { className: string }) {
  return (
    // bg-[#fff] (e não bg-white) para o dark mode não repintar o logo.
    <span
      className={`grid shrink-0 place-items-center rounded-2xl bg-[#fff] p-1.5 shadow-[0_0_0_1px_rgba(15,23,42,0.08)] ${className}`}
    >
      <img src="/logounicap.png" alt="" className="h-full w-full object-contain" />
    </span>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-95 motion-reduce:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-[#2a0912] ${
        checked ? "bg-secondary" : "bg-white/20"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-[#fff] shadow-md transition-[transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Palco do hero (ilustrativo → aria-hidden)                           */
/* ------------------------------------------------------------------ */

function HeroStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useParallax(stageRef);
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 700);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="relative mx-auto h-[18rem] w-[18rem] sm:h-[30rem] sm:w-[30rem] lg:h-[24.6rem] lg:w-[24.6rem] xl:h-[30rem] xl:w-[30rem]"
    >
      <div
        ref={stageRef}
        className="absolute left-0 top-0 h-[30rem] w-[30rem] origin-top-left scale-[0.6] [perspective:1200px] sm:scale-100 lg:scale-[0.82] xl:scale-100"
      >
        {/* Currículo */}
        <div data-depth="0.4" data-tilt="" className="absolute left-6 top-6 w-[19rem]">
          <div
            className={`${CARD} rise p-6 [animation-delay:240ms]`}
          >
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-primary font-serif text-base font-bold text-white">
                JV
              </span>
              <div>
                <p className="font-serif text-base font-bold leading-tight text-slate-900">
                  João Victor
                </p>
                <p className="text-xs text-slate-500">
                  Ciência da Computação, 8º período
                </p>
              </div>
            </div>
            <p className="mt-5 text-[11px] font-semibold text-slate-700">Skills</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["React", "TypeScript", "SQL", "Figma"].map((skill) => (
                <span
                  key={skill}
                  className="rounded-full bg-[#FDF2F4] px-2.5 py-1 text-[11px] font-semibold text-primary"
                >
                  {skill}
                </span>
              ))}
            </div>
            <p className="mt-4 text-[11px] font-semibold text-slate-700">Idiomas</p>
            <p className="mt-1 text-xs text-slate-600">Inglês avançado, espanhol básico</p>
            <p className="mt-4 text-[11px] font-semibold text-slate-700">Disponibilidade</p>
            <p className="mt-1 text-xs text-slate-600">Estágio, 6 horas por dia</p>
            <div className="mt-5 flex flex-col gap-2">
              <span className="h-2 w-full rounded-full bg-slate-100" />
              <span className="h-2 w-4/5 rounded-full bg-slate-100" />
              <span className="h-2 w-3/5 rounded-full bg-slate-100" />
            </div>
          </div>
        </div>

        {/* Match */}
        <div data-depth="1" className="absolute bottom-4 left-0 w-[15rem]">
          <div
            className={`${CARD} rise flex items-center gap-3 p-4 [animation-delay:420ms]`}
          >
            <ScoreRing value={92} active={ready} />
            <div>
              <p className="text-sm font-bold text-slate-900">Match com a vaga</p>
              <p className="text-xs text-slate-500">Analista de Dados Jr.</p>
            </div>
          </div>
        </div>

        {/* Processo */}
        <div data-depth="0.8" className="absolute right-0 top-14 w-[14rem]">
          <div className={`${CARD} rise p-4 [animation-delay:540ms]`}>
            <p className="text-xs font-bold text-slate-900">Processo seletivo</p>
            <ul className="mt-3 flex flex-col gap-2.5 text-xs text-slate-600">
              {["Inscrição enviada", "Triagem aprovada"].map((step) => (
                <li key={step} className="flex items-center gap-2">
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-success text-white">
                    <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                  </span>
                  {step}
                </li>
              ))}
              <li className="flex items-center gap-2 font-semibold text-primary">
                <span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-white">
                  <Calendar className="h-2.5 w-2.5" strokeWidth={3} />
                </span>
                Entrevista na quinta
              </li>
            </ul>
          </div>
        </div>

        {/* PDF pronto */}
        <div data-depth="1.3" className="absolute bottom-24 right-4">
          <span className="rise inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-bold text-slate-900 shadow-lg [animation-delay:660ms]">
            <FileText className="h-3.5 w-3.5" />
            PDF pronto
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Seções                                                              */
/* ------------------------------------------------------------------ */

function BenefitHead({
  icon: Icon,
  title,
  description,
}: {
  icon: (typeof BENEFITS)[number]["icon"];
  title: string;
  description: string;
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className="grid h-11 w-11 place-items-center rounded-2xl bg-[#FDF2F4] text-primary"
      >
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-5 font-serif text-2xl font-bold tracking-[-0.02em] text-primary">
        {title}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">{description}</p>
    </>
  );
}

function MatchBars() {
  const [ref, seen] = useInView<HTMLDivElement>();
  const total = useCountUp(87, seen);
  const rows = [
    { label: "Habilidades", value: 0.9 },
    { label: "Idiomas", value: 1 },
    { label: "Disponibilidade", value: 0.7 },
  ];
  return (
    <div ref={ref} className="mt-6 rounded-2xl bg-slate-50 p-5">
      <p className="font-serif text-5xl font-bold tabular-nums tracking-[-0.03em] text-slate-900">
        {total}%
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {rows.map((row, index) => (
          <li key={row.label}>
            <div className="flex justify-between text-xs font-semibold text-slate-600">
              <span>{row.label}</span>
              <span className="tabular-nums">{Math.round(row.value * 100)}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full origin-left rounded-full bg-primary transition-[transform] duration-[1200ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
                style={{
                  transform: `scaleX(${seen ? row.value : 0.04})`,
                  transitionDelay: seen ? `${index * 120}ms` : "0ms",
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KanbanPreview() {
  const [ref, seen] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="mt-6 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-4">
      {KANBAN.map((column, columnIndex) => (
        <div key={column.name}>
          <p className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-700">
            {column.name}
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] tabular-nums text-slate-500">
              {column.cards}
            </span>
          </p>
          <div className="flex flex-col gap-2">
            {Array.from({ length: column.cards }, (_, cardIndex) => (
              <div
                key={cardIndex}
                style={{ transitionDelay: seen ? `${columnIndex * 80 + cardIndex * 60}ms` : "0ms" }}
                className={`rounded-xl bg-white p-3 shadow-level1 transition-[opacity,transform] duration-[700ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-opacity ${
                  seen ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0 motion-reduce:translate-y-0"
                }`}
              >
                <span className="block h-2 w-3/4 rounded-full bg-slate-100" />
                <span className="mt-2 block h-2 w-1/2 rounded-full bg-slate-100" />
                {columnIndex === 3 ? (
                  <span className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-bold text-success">
                    <Check className="h-3 w-3" strokeWidth={3.5} />
                    Contratado
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PdfPreview() {
  return (
    <div className="group relative mt-6 h-52 overflow-hidden rounded-2xl bg-slate-50">
      {[
        { rotate: "-rotate-3", left: "left-[14%]", hover: "[@media(hover:hover)_and_(pointer:fine)]:group-hover:-translate-x-2 [@media(hover:hover)_and_(pointer:fine)]:group-hover:-rotate-6" },
        { rotate: "rotate-2", left: "left-[34%]", hover: "[@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-2 [@media(hover:hover)_and_(pointer:fine)]:group-hover:rotate-3" },
      ].map((sheet, index) => (
        <div
          key={index}
          className={`absolute top-8 h-56 w-40 ${sheet.left} ${sheet.rotate} ${sheet.hover} rounded-lg bg-white p-4 shadow-level2 transition-[transform] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none`}
        >
          <span className="block h-3 w-2/3 rounded-full bg-primary/80" />
          <span className="mt-3 block h-2 w-full rounded-full bg-slate-100" />
          <span className="mt-2 block h-2 w-5/6 rounded-full bg-slate-100" />
          <span className="mt-5 block h-2 w-1/3 rounded-full bg-secondary" />
          <span className="mt-2 block h-2 w-full rounded-full bg-slate-100" />
          <span className="mt-2 block h-2 w-4/5 rounded-full bg-slate-100" />
        </div>
      ))}
      <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-slate-900">
        <Check className="h-3 w-3" strokeWidth={3.5} />
        PDF pronto
      </span>
    </div>
  );
}

function ContactDemo() {
  const [granted, setGranted] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CONTACT_DEMO.map((item) => [item.id, item.initial])),
  );
  return (
    <div className="rounded-3xl bg-white/[0.06] p-3 ring-1 ring-white/10 backdrop-blur-md sm:p-4">
      <p className="px-2 pb-3 pt-1 text-xs font-semibold text-white/70">
        Quem pode ver o seu contato
      </p>
      <ul className="flex flex-col gap-2">
        {CONTACT_DEMO.map((item) => {
          const on = granted[item.id] === true;
          return (
            <li key={item.id} className="rounded-2xl bg-white/[0.06] p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{item.vaga}</p>
                  <p className="text-xs text-white/70">
                    {on ? "Contato liberado" : "Contato oculto"}
                  </p>
                </div>
                <Switch
                  checked={on}
                  onChange={(next) => setGranted((prev) => ({ ...prev, [item.id]: next }))}
                  label={`Liberar contato para a vaga ${item.vaga}`}
                />
              </div>
              <p
                aria-hidden={!on}
                className={`mt-3 select-none text-sm font-medium text-[#e9cf94] transition-[filter,opacity] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-opacity ${
                  on ? "opacity-100 blur-0" : "opacity-60 blur-[6px]"
                }`}
              >
                marina@exemplo.com.br
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Step({ index, title, description }: { index: number; title: string; description: string }) {
  const [ref, seen] = useInView<HTMLLIElement>();
  return (
    <li ref={ref} className="relative flex flex-col gap-3">
      <span
        aria-hidden="true"
        className="relative z-10 grid h-10 w-10 place-items-center rounded-full bg-primary font-serif text-lg font-bold text-white"
      >
        {index + 1}
      </span>
      {index < STEPS.length - 1 ? (
        <span aria-hidden="true" className="absolute left-14 right-4 top-5 hidden h-px bg-slate-200 md:block">
          <span
            className="block h-full origin-left bg-secondary transition-[transform] duration-[1200ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
            style={{ transform: `scaleX(${seen ? 1 : 0})`, transitionDelay: `${index * 200}ms` }}
          />
        </span>
      ) : null}
      <h3 className="font-serif text-xl font-bold tracking-[-0.02em] text-primary">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-600">{description}</p>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export function LandingPage({ onNavigate }: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function goToLogin(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    onNavigate("/login");
  }

  /** Rolagem suave até a seção (instantânea com reduced-motion) + foco. */
  function goToSection(event: MouseEvent<HTMLAnchorElement>, id: string) {
    const target = document.getElementById(id);
    if (target === null) return;
    event.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    target.focus({ preventScroll: true });
  }

  // O hover (claro e escuro) vive em .nav-link no index.css, com regra
  // `.dark` própria, para não herdar o bordô sobre fundo escuro.
  const navLink =
    "nav-link rounded-md px-3 py-2 text-sm font-semibold text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";
  const goldBtn =
    "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-secondary px-7 text-sm font-bold text-slate-900 transition-[transform,filter] !duration-150 ease-out active:scale-[0.97] motion-reduce:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-primary [@media(hover:hover)_and_(pointer:fine)]:hover:brightness-105";
  const glassBtn =
    "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-7 text-sm font-bold text-white backdrop-blur-md transition-[transform,background-color] !duration-150 ease-out active:scale-[0.97] motion-reduce:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-primary [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/20";

  return (
    <div className="min-h-screen bg-canvas">
      {/* Cabeçalho: material translúcido; a linha só aparece ao rolar. */}
      <header
        className={`sticky top-0 z-40 border-b bg-white/70 backdrop-blur-xl backdrop-saturate-150 transition-[border-color] duration-300 dark:bg-[#0f1218]/70 [@media(prefers-reduced-transparency:reduce)]:bg-white [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none ${
          scrolled ? "border-slate-200/70 dark:border-white/10" : "border-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 md:grid md:grid-cols-[1fr_auto_1fr]">
          <div className="flex items-center gap-3">
            <LogoChip className="h-10 w-10" />
            <div>
              <p className="font-serif text-base font-bold leading-tight tracking-tight text-primary">
                Banco de Currículos
              </p>
              <p className="hidden text-xs text-a11y-slate-500 sm:block">
                Universidade Católica de Pernambuco
              </p>
            </div>
          </div>
          <nav aria-label="Navegação da vitrine" className="hidden md:block">
            <ul className="flex items-center gap-2">
              <li>
                <a href="#beneficios" onClick={(e) => goToSection(e, "beneficios")} className={navLink}>
                  Benefícios
                </a>
              </li>
              <li>
                <a href="#como-funciona" onClick={(e) => goToSection(e, "como-funciona")} className={navLink}>
                  Como funciona
                </a>
              </li>
            </ul>
          </nav>
          <a
            href="/login"
            onClick={goToLogin}
            className="group inline-flex h-11 items-center justify-center gap-2 justify-self-end rounded-full bg-primary px-6 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(107,20,38,0.25)] ring-1 ring-black/10 dark:ring-0 transition-[filter,box-shadow,transform] !duration-200 !ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] active:!duration-100 motion-reduce:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [@media(hover:hover)_and_(pointer:fine)]:hover:brightness-110"
          >
            Entrar
          </a>
        </div>
      </header>

      <main
        id="conteudo"
        tabIndex={-1}
        aria-label="Banco de Currículos — apresentação"
        className="outline-none"
      >
        {/* Hero */}
        <div className="px-3 pt-3 sm:px-4">
          <section
            data-parallax-host=""
            className="relative overflow-hidden rounded-[2rem] bg-primary text-white sm:rounded-[2.5rem]"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(48rem_32rem_at_100%_0%,rgba(200,157,60,0.26),transparent_62%),radial-gradient(40rem_30rem_at_0%_100%,rgba(0,0,0,0.38),transparent_60%)]"
            />
            <Rings className="-bottom-52 -right-52 h-[50rem] w-[50rem]" />

            <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-16 sm:px-10 sm:py-24 lg:grid-cols-2 lg:py-28">
              <div>
                <p className="rise inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-[#e9cf94] ring-1 ring-white/15 [animation-delay:60ms]">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-secondary" />
                  Universidade Católica de Pernambuco
                </p>
                <h1 className="rise mt-6 max-w-xl font-serif text-[2.75rem] font-bold leading-[1.02] tracking-[-0.035em] [animation-delay:140ms] sm:text-6xl xl:text-[4.5rem]">
                  O seu futuro começa aqui.
                </h1>
                <p className="rise mt-4 max-w-lg font-serif text-xl leading-snug tracking-[-0.01em] text-[#e9cf94] [animation-delay:220ms] sm:text-2xl">
                  Conectando os talentos da UNICAP ao mercado.
                </p>
                <p className="rise mt-6 max-w-lg text-base leading-relaxed text-white/85 [animation-delay:300ms] sm:text-lg">
                  O Banco de Currículos reúne alunos e empresas em um processo seletivo
                  transparente: currículo em PDF, match inteligente e acompanhamento de
                  cada etapa da inscrição à contratação.
                </p>
                <div className="rise mt-9 flex flex-wrap gap-3 [animation-delay:380ms]">
                  <a href="/login" onClick={goToLogin} className={goldBtn}>
                    <GraduationCap className="h-4 w-4" aria-hidden="true" />
                    Entrar como Aluno
                  </a>
                  <a href="/login" onClick={goToLogin} className={glassBtn}>
                    <Building2 className="h-4 w-4" aria-hidden="true" />
                    Portal da Empresa
                  </a>
                </div>
              </div>
              <HeroStage />
            </div>
          </section>
        </div>

        {/* Benefícios (bento) */}
        <section
          id="beneficios"
          aria-labelledby="beneficios-title"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 outline-none sm:px-6 sm:py-28"
        >
          <Reveal>
            <h2
              id="beneficios-title"
              className="max-w-2xl font-serif text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-primary sm:text-5xl"
            >
              Por que o Banco de Currículos?
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Tudo o que aluno e empresa precisam para se encontrar, em um só lugar e
              com privacidade desde o primeiro clique.
            </p>
          </Reveal>
          <ul className="mt-12 grid gap-4 md:grid-cols-6">
            <Reveal as="li" className={`${CARD} p-6 sm:p-8 md:col-span-4`}>
              <BenefitHead {...BENEFITS[0]} />
              <PdfPreview />
            </Reveal>
            <Reveal as="li" delay={80} className={`${CARD} p-6 sm:p-8 md:col-span-2`}>
              <BenefitHead {...BENEFITS[1]} />
              <MatchBars />
            </Reveal>
            <Reveal as="li" delay={120} className={`${CARD} p-6 sm:p-8 md:col-span-6`}>
              <BenefitHead {...BENEFITS[2]} />
              <KanbanPreview />
            </Reveal>
          </ul>
        </section>

        {/* Privacidade: demo interativa */}
        <div className="px-3 sm:px-4">
          <section
            aria-labelledby="privacidade-title"
            className="relative overflow-hidden rounded-[2rem] bg-[#2a0912] text-white sm:rounded-[2.5rem]"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_28rem_at_0%_0%,rgba(200,157,60,0.2),transparent_60%)]"
            />
            <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-16 sm:px-10 sm:py-24 lg:grid-cols-2 lg:gap-16">
              <Reveal>
                <h2
                  id="privacidade-title"
                  className="font-serif text-4xl font-bold leading-[1.05] tracking-[-0.03em] sm:text-5xl"
                >
                  Seu contato, sua decisão.
                </h2>
                <p className="mt-4 max-w-md text-base leading-relaxed text-white/80 sm:text-lg">
                  Você libera ou revoga o contato por vaga, em conformidade com a LGPD.
                  Experimente ao lado: ligue e desligue cada vaga.
                </p>
              </Reveal>
              <Reveal delay={100}>
                <ContactDemo />
              </Reveal>
            </div>
          </section>
        </div>

        {/* Como funciona */}
        <section
          id="como-funciona"
          aria-labelledby="como-funciona-title"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 outline-none sm:px-6 sm:py-28"
        >
          <Reveal>
            <h2
              id="como-funciona-title"
              className="font-serif text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-primary sm:text-5xl"
            >
              Como funciona
            </h2>
          </Reveal>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map((step, index) => (
              <Step key={step.title} index={index} {...step} />
            ))}
          </ol>
        </section>

        {/* Chamada final */}
        <div className="px-3 pb-3 sm:px-4 sm:pb-4">
          <section
            aria-labelledby="cta-title"
            className="relative overflow-hidden rounded-[2rem] bg-primary px-6 py-16 text-center text-white sm:rounded-[2.5rem] sm:px-10 sm:py-24"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(48rem_32rem_at_50%_0%,rgba(200,157,60,0.26),transparent_62%)]"
            />
            <Rings className="-bottom-72 left-1/2 h-[46rem] w-[46rem] -translate-x-1/2" />
            <div className="relative">
              <Reveal>
                <h2
                  id="cta-title"
                  className="mx-auto max-w-2xl font-serif text-4xl font-bold leading-[1.05] tracking-[-0.03em] sm:text-5xl"
                >
                  Pronto para dar o próximo passo na sua carreira?
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
                  Crie sua conta como aluno ou acesse o painel da sua empresa e publique
                  a primeira vaga hoje mesmo.
                </p>
                <div className="mt-9 flex flex-wrap justify-center gap-3">
                  <a href="/login" onClick={goToLogin} className={goldBtn}>
                    <GraduationCap className="h-4 w-4" aria-hidden="true" />
                    Entrar como Aluno
                  </a>
                  <a href="/login" onClick={goToLogin} className={glassBtn}>
                    <Building2 className="h-4 w-4" aria-hidden="true" />
                    Portal da Empresa
                  </a>
                </div>
              </Reveal>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <LogoChip className="h-11 w-11" />
            <div>
              <p className="font-serif text-lg font-bold tracking-tight text-primary">
                Banco de Currículos
              </p>
              <p className="mt-1 max-w-xs text-sm leading-relaxed text-slate-600">
                Universidade Católica de Pernambuco
              </p>
            </div>
          </div>
          <nav aria-label="Links do rodapé">
            <ul className="flex flex-col gap-2 text-sm text-slate-600">
              <li>
                <a
                  href="/login"
                  onClick={goToLogin}
                  className="foot-link font-semibold text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Entrar
                </a>
              </li>
              <li>
                <a
                  href="#beneficios"
                  onClick={(e) => goToSection(e, "beneficios")}
                  className="foot-link focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Benefícios
                </a>
              </li>
              <li>
                <a
                  href="#como-funciona"
                  onClick={(e) => goToSection(e, "como-funciona")}
                  className="foot-link focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Como funciona
                </a>
              </li>
            </ul>
          </nav>
        </div>
        <div className="border-t border-slate-100 py-4 text-center text-xs text-a11y-slate-500">
          © {new Date().getFullYear()} Universidade Católica de Pernambuco. Todos os
          direitos reservados.
        </div>
      </footer>
    </div>
  );
}