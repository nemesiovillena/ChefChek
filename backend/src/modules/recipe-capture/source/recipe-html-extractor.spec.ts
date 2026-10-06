import { extractRecipeSourceText } from "./recipe-html-extractor";

describe("extractRecipeSourceText", () => {
  it("incluye en crudo los datos estructurados y el texto visible", () => {
    const html = `<!doctype html><html><head>
      <title>Tarta de queso</title>
      <style>body { color: red }</style>
      <script type="application/ld+json">{"@type":"Recipe","name":"Tarta de queso","recipeIngredient":["500 g queso crema"]}</script>
      <script>window.analytics = "no debe aparecer";</script>
    </head><body>
      <nav><a href="/">Men&uacute; principal</a></nav>
      <h1>Tarta de queso</h1>
      <!-- comentario oculto -->
      <ul><li>500 g de queso crema</li><li>3 huevos</li></ul>
      <p>Hornear a 180&deg;C &amp; dejar enfriar.</p>
      <footer>Aviso legal</footer>
    </body></html>`;

    const text = extractRecipeSourceText(html);

    expect(text).toContain("DATOS ESTRUCTURADOS DE LA PÁGINA:");
    expect(text).toContain('"recipeIngredient":["500 g queso crema"]');
    expect(text).toContain("500 g de queso crema\n3 huevos");
    expect(text).toContain("Hornear a 180°C & dejar enfriar.");
    expect(text).not.toContain("analytics");
    expect(text).not.toContain("color: red");
    expect(text).not.toContain("Menú principal");
    expect(text).not.toContain("Aviso legal");
    expect(text).not.toContain("comentario oculto");
  });

  it("devuelve solo el texto cuando la página no trae datos estructurados", () => {
    const text = extractRecipeSourceText(
      "<html><body><h2>Gazpacho</h2><p>1 kg de tomate</p><p>Triturar</p></body></html>",
    );

    expect(text).toBe(
      "TEXTO DE LA PÁGINA:\nGazpacho\n1 kg de tomate\nTriturar",
    );
  });

  it("separa las celdas de una tabla de ingredientes", () => {
    const text = extractRecipeSourceText(
      "<table><tr><td>Leche</td><td>1</td><td>50 ml</td></tr></table>",
    );

    expect(text).toContain("Leche 1 50 ml");
  });

  it("no descuadra los índices con caracteres que cambian de longitud en minúsculas", () => {
    const html = `<p>${"İ".repeat(12)}</p><script type="application/ld+json">{"@type":"Recipe","name":"Tarta"}</script><script>var secreto=1;</script><p>fin</p>`;

    const text = extractRecipeSourceText(html);

    expect(text).toContain('{"@type":"Recipe","name":"Tarta"}\n');
    expect(text).not.toContain("secreto");
    expect(text).toContain("fin");
  });

  it("conserva el resto de la página tras un elemento omitible sin cerrar", () => {
    const text = extractRecipeSourceText(
      "<p>antes</p><iframe src=x><p>después</p>",
    );

    expect(text).toContain("antes");
    expect(text).toContain("después");
  });

  it("recorta la salida a 30 000 caracteres", () => {
    const html = `<body>${"<p>harina y agua</p>".repeat(20_000)}</body>`;

    expect(extractRecipeSourceText(html).length).toBe(30_000);
  });

  it("limita cuánto ocupan los datos estructurados", () => {
    const block = `<script type="application/ld+json">${"x".repeat(15_000)}</script>`;
    const text = extractRecipeSourceText(`${block}${block}${block}<p>fin</p>`);

    const structured = text.split("TEXTO DE LA PÁGINA:")[0];
    expect(structured.length).toBeLessThan(20_200);
    expect(text).toContain("fin");
  });

  // El análisis corre en el mismo proceso que atiende a todos los tenants:
  // una página maliciosa no puede bloquearlo. Con coste lineal, 2 MB se
  // recorren en milisegundos; con retroceso serían minutos.
  it.each([
    ["aperturas ld+json sin cerrar", '<script type="application/ld+json">'],
    ["aperturas de etiqueta sin cerrar", "<div "],
    ["comentarios sin cerrar", "<!-- "],
    ["entidades truncadas", "&amp"],
    ["navs sin cerrar", "<nav>"],
  ])("procesa en tiempo acotado una página hostil: %s", (_name, unit) => {
    const html = unit.repeat(Math.ceil((2 * 1024 * 1024) / unit.length));

    const start = Date.now();
    extractRecipeSourceText(html);

    expect(Date.now() - start).toBeLessThan(500);
  });
});
