import type { Template } from "./CreateProjectModal";

const TEMPLATES: { id: Template; name: string; desc: string; tag: string }[] = [
  { id: "landing-page", name: "Landing Page", desc: "Hero, features, CTA", tag: "html/css/js" },
  { id: "blank", name: "Blank", desc: "Start from nothing", tag: "html/css/js" },
];

export function TemplatesSection({ onSelect }: { onSelect: (template: Template) => void }) {
  return (
    <>
      <div className="mt-11 mb-3.5 flex items-baseline justify-between">
        <h2 className="m-0 text-label text-text-muted uppercase">Templates</h2>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(196px,1fr))] gap-3">
        {TEMPLATES.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelect(template.id)}
            className="overflow-hidden rounded-md border border-[#1F2126] bg-[#131418] text-left hover:border-[#33363C]"
          >
            <div className="grid h-[74px] place-items-center border-b border-[#1F2126] bg-[repeating-linear-gradient(135deg,#17181C_0_7px,#1B1D21_7px_14px)]">
              <span className="font-mono text-[10px] tracking-[0.06em] text-syntax-comment">
                {template.tag}
              </span>
            </div>
            <div className="px-3.25 py-2.75">
              <div className="text-ui font-medium text-text-primary">{template.name}</div>
              <div className="mt-0.75 text-[11px] text-text-muted">{template.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
