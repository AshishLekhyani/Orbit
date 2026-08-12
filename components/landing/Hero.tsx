import { Button } from "@/components/shared/Button";

export function Hero() {
  return (
    <div className="flex flex-col items-center px-8 pt-24">
      <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#26282D] bg-[#141518] py-[5px] pr-3 pl-2">
        <span className="block h-1.5 w-1.5 rounded-full bg-accent" />
        <span className="text-xs tracking-[0.01em] text-text-tertiary">
          Real-time collaboration, now in public beta
        </span>
      </div>

      <h1 className="m-0 max-w-[15ch] text-center text-[60px] leading-[1.05] font-semibold tracking-[-0.035em] text-text-primary text-balance">
        Build together. Right in your browser.
      </h1>

      <p className="mt-[22px] max-w-[54ch] text-center text-[17px] leading-[1.6] text-text-tertiary">
        Write, run, and collaborate on code without leaving your browser. No local setup, no
        waiting — open a project and start typing.
      </p>

      <div className="mt-[34px] flex gap-2.5">
        <Button href="/signin" variant="primary">
          Start building
        </Button>
        <Button href="/signin" variant="secondary">
          Explore demo
        </Button>
      </div>
    </div>
  );
}
