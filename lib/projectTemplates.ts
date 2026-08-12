import type { FileType } from "@prisma/client";

export type ProjectTemplateId = "blank" | "landing-page";

interface StarterFile {
  path: string;
  name: string;
  type: FileType;
  content: string;
}

const BLANK_FILES: StarterFile[] = [
  {
    path: "index.html",
    name: "index.html",
    type: "HTML",
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>New Project</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <h1>Hello, Orbit</h1>

  <script src="script.js"></script>
</body>
</html>
`,
  },
  {
    path: "styles.css",
    name: "styles.css",
    type: "CSS",
    content: `body {
  margin: 0;
  font-family: system-ui, sans-serif;
}
`,
  },
  {
    path: "script.js",
    name: "script.js",
    type: "JS",
    content: `console.log("Ready");
`,
  },
];

const LANDING_PAGE_FILES: StarterFile[] = [
  {
    path: "index.html",
    name: "index.html",
    type: "HTML",
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Landing Page</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="nav">
    <span class="mark">Brand</span>
    <nav>
      <a href="#features">Features</a>
      <a href="#contact">Contact</a>
    </nav>
  </header>

  <main class="hero">
    <p class="eyebrow">Now in beta</p>
    <h1>Build something people want.</h1>
    <p class="lede">A starting point for your next idea - edit this copy, this layout, this everything.</p>
    <button id="cta">Get started</button>
  </main>

  <section id="features" class="grid">
    <article class="card">
      <h2>Fast</h2>
      <p>Ship in hours, not weeks.</p>
    </article>
    <article class="card">
      <h2>Simple</h2>
      <p>No build step to fight with.</p>
    </article>
    <article class="card">
      <h2>Yours</h2>
      <p>Edit every line.</p>
    </article>
  </section>

  <script src="script.js"></script>
</body>
</html>
`,
  },
  {
    path: "styles.css",
    name: "styles.css",
    type: "CSS",
    content: `:root {
  --ink: #14151a;
  --muted: #6b6f76;
  --line: #e6e6ea;
  --paper: #ffffff;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: system-ui, sans-serif;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 32px;
  border-bottom: 1px solid var(--line);
}

.mark {
  font-weight: 700;
}

.nav nav {
  display: flex;
  gap: 20px;
}

.nav a {
  color: var(--muted);
  text-decoration: none;
  font-size: 14px;
}

.hero {
  padding: 96px 32px;
  max-width: 640px;
}

.eyebrow {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}

h1 {
  margin: 14px 0 16px;
  font-size: 42px;
  line-height: 1.1;
  letter-spacing: -0.02em;
}

.lede {
  margin: 0 0 28px;
  font-size: 17px;
  line-height: 1.6;
  color: var(--muted);
  max-width: 44ch;
}

button {
  padding: 12px 22px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  background: var(--ink);
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  padding: 0 32px 96px;
}

.card {
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 10px;
}

.card h2 {
  margin: 0 0 8px;
  font-size: 16px;
}

.card p {
  margin: 0;
  font-size: 14px;
  color: var(--muted);
}
`,
  },
  {
    path: "script.js",
    name: "script.js",
    type: "JS",
    content: `document.getElementById("cta").addEventListener("click", () => {
  console.log("CTA clicked");
});
`,
  },
];

export function starterFiles(template: ProjectTemplateId): StarterFile[] {
  return template === "blank" ? BLANK_FILES : LANDING_PAGE_FILES;
}
