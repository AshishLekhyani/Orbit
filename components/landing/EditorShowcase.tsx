export function EditorShowcase() {
  return (
    <div className="mt-[72px] w-full max-w-[1080px] overflow-hidden rounded-t-md border border-[#24262B] bg-[#121316] shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
      <div className="flex h-[38px] items-center gap-2.5 border-b border-border-subtle bg-[#141518] px-3.5">
        <div className="flex gap-1.5">
          <span className="block h-[9px] w-[9px] rounded-full bg-[#2E3036]" />
          <span className="block h-[9px] w-[9px] rounded-full bg-[#2E3036]" />
          <span className="block h-[9px] w-[9px] rounded-full bg-[#2E3036]" />
        </div>
        <span className="ml-2 font-mono text-[11px] text-text-muted">
          portfolio / src / main.js
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="grid h-5 w-5 place-items-center rounded-full border border-[#121316] bg-collab-1 text-[9px] font-semibold text-bg-base">
            RS
          </span>
          <span className="grid h-5 w-5 place-items-center rounded-full border border-[#121316] bg-collab-2 text-[9px] font-semibold text-bg-base">
            MO
          </span>
        </div>
      </div>

      <div className="grid min-h-[320px] grid-cols-1 md:grid-cols-[1.25fr_1fr]">
        <div className="border-r border-border-subtle py-4 font-mono text-[12.5px] leading-[21px]">
          <CodeLine n={1}>
            <Kw>const</Kw> <Plain>projects </Plain>
            <Pn>=</Pn> <Fn>load</Fn>
            <Pn>()</Pn>
          </CodeLine>
          <CodeLine n={2}>{""}</CodeLine>
          <CodeLine n={3} active>
            <Kw>function</Kw> <Fn>render</Fn>
            <Pn>(</Pn>
            <Plain>root</Plain>
            <Pn>{") {"}</Pn>
          </CodeLine>
          <CodeLine n={4}>
            <Plain>&nbsp;&nbsp;root.innerHTML </Plain>
            <Pn>=</Pn> <Plain>projects</Plain>
          </CodeLine>
          <CodeLine n={5}>
            <Plain>&nbsp;&nbsp;&nbsp;&nbsp;.</Plain>
            <Fn>map</Fn>
            <Pn>(</Pn>
            <Plain>card</Plain>
            <Pn>)</Pn>
          </CodeLine>
          <CodeLine n={6}>
            <Plain>&nbsp;&nbsp;&nbsp;&nbsp;.</Plain>
            <Fn>join</Fn>
            <Pn>(</Pn>
            <Str>{"''"}</Str>
            <Pn>)</Pn>
            <span className="ml-0.5 inline-block h-[17px] w-[2px] translate-y-[3px] bg-collab-1" />
            <span className="ml-0.5 rounded-tl-[3px] rounded-tr-[3px] rounded-br-[3px] bg-collab-1 px-[5px] py-px font-sans text-[10px] text-bg-base">
              Rahul
            </span>
          </CodeLine>
          <CodeLine n={7}>
            <Pn>{"}"}</Pn>
          </CodeLine>
        </div>

        <div className="bg-[#FAF8F5] px-6 py-7">
          <div className="font-sans text-[#1A1815]">
            <div className="text-[10px] tracking-[0.16em] text-[#8A8378] uppercase">
              Product engineer
            </div>
            <div className="mt-2.5 text-[26px] leading-[1.15] font-semibold tracking-[-0.02em]">
              I design and build interfaces that last.
            </div>
            <div className="mt-[22px] grid grid-cols-2 gap-2.5">
              <div className="h-16 rounded border border-[#E4DED4] bg-[repeating-linear-gradient(135deg,#F2EDE6_0_6px,#EDE7DE_6px_12px)]" />
              <div className="h-16 rounded border border-[#E4DED4] bg-[repeating-linear-gradient(135deg,#F2EDE6_0_6px,#EDE7DE_6px_12px)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CodeLine({
  n,
  children,
  active,
}: {
  n: number;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <div className={`flex px-4 ${active ? "bg-accent/5" : ""}`}>
      <span
        className={`mr-4 w-[26px] text-right ${active ? "text-accent" : "text-[#45474D]"}`}
      >
        {n}
      </span>
      <span>{children}</span>
    </div>
  );
}

function Kw({ children }: { children: React.ReactNode }) {
  return <span className="text-syntax-keyword">{children}</span>;
}
function Fn({ children }: { children: React.ReactNode }) {
  return <span className="text-syntax-function">{children}</span>;
}
function Str({ children }: { children: React.ReactNode }) {
  return <span className="text-syntax-string">{children}</span>;
}
function Pn({ children }: { children: React.ReactNode }) {
  return <span className="text-syntax-punctuation">{children}</span>;
}
function Plain({ children }: { children: React.ReactNode }) {
  return <span className="text-syntax-plain">{children}</span>;
}
