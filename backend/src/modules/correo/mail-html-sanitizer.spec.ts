import { filterInlineStyle, sanitizeMailHtml } from "./mail-html-sanitizer";

describe("sanitizeMailHtml", () => {
  it("elimina <script> y su contenido", () => {
    const out = sanitizeMailHtml("<p>Hola</p><script>alert(1)</script>");
    expect(out).toBe("<p>Hola</p>");
  });

  it("elimina atributos on* (onerror, onclick)", () => {
    const out = sanitizeMailHtml(
      '<img src="cid:x" onerror="alert(1)"><a href="https://a.es" onclick="x()">a</a>',
    );
    expect(out).not.toMatch(/onerror|onclick/i);
  });

  it("elimina enlaces javascript:", () => {
    const out = sanitizeMailHtml('<a href="javascript:alert(1)">pulsa</a>');
    expect(out).not.toMatch(/javascript/i);
  });

  it("enlaces → nueva pestaña con noopener noreferrer", () => {
    const out = sanitizeMailHtml(
      '<a href="https://warynessy.com" target="_self">web</a>',
    );
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it("quita background= de tablas y celdas", () => {
    const out = sanitizeMailHtml(
      '<table background="https://t.es/a.gif"><tr><td background="https://t.es/p.gif">x</td></tr></table>',
    );
    expect(out).not.toMatch(/background=/i);
    expect(out).not.toContain("t.es");
  });

  it("quita url() de style y conserva el resto del formato", () => {
    const out = sanitizeMailHtml(
      '<div style="color: red; background-image: url(https://t.es/p.gif); background: url(//t.es/x)">x</div>',
    );
    expect(out).toMatch(/color:\s*red/);
    expect(out).not.toContain("t.es");
  });

  it("quita srcset y poster", () => {
    const out = sanitizeMailHtml(
      '<img src="cid:a" srcset="https://t.es/a.png 2x"><video poster="https://t.es/p.png"></video>',
    );
    expect(out).not.toMatch(/srcset|poster|t\.es/);
  });

  it("descarta bloques <style> con @import y <link>", () => {
    const out = sanitizeMailHtml(
      '<style>@import url(https://t.es/a.css); body{color:red}</style><link rel="stylesheet" href="https://t.es/b.css"><p>x</p>',
    );
    expect(out).toBe("<p>x</p>");
  });

  it("descarta form, iframe, object, embed y base", () => {
    const out = sanitizeMailHtml(
      '<base href="https://t.es/"><form action="https://t.es"><input name="p"></form><iframe src="https://t.es"></iframe><object data="x"></object><embed src="x">',
    );
    expect(out).not.toMatch(/<(form|input|iframe|object|embed|base)/i);
  });

  it("imagen remota (http, https y //) → data-blocked-src sin src", () => {
    const out = sanitizeMailHtml(
      '<img src="https://t.es/pixel.gif"><img src="//t.es/b.gif"><img src="http://t.es/c.gif">',
    );
    expect(out).not.toMatch(/\ssrc=/);
    expect(out).toContain('data-blocked-src="https://t.es/pixel.gif"');
    expect(out).toContain('data-blocked-src="https://t.es/b.gif"');
    expect(out).toContain('data-blocked-src="http://t.es/c.gif"');
  });

  it("un data-blocked-src que venga en el correo se ignora", () => {
    const out = sanitizeMailHtml(
      '<img data-blocked-src="javascript:alert(1)">',
    );
    expect(out).not.toMatch(/javascript/);
  });

  it("cid: → data URI de la imagen incrustada; cid desconocido → sin src", () => {
    const map = new Map([["logo@x", "data:image/png;base64,iVBORw0KGgo="]]);
    const out = sanitizeMailHtml(
      '<img src="cid:logo@x"><img src="cid:otro@x">',
      map,
    );
    expect(out).toContain('src="data:image/png;base64,iVBORw0KGgo="');
    expect(out.match(/\ssrc=/g)).toHaveLength(1);
  });

  it("data: que no sea imagen segura → fuera", () => {
    const out = sanitizeMailHtml(
      '<img src="data:image/svg+xml;base64,PHN2Zz4="><img src="data:text/html,<script>">',
    );
    expect(out).not.toMatch(/\ssrc=/);
  });
});

describe("filterInlineStyle", () => {
  it("descarta propiedades fuera de la lista y valores con escapes CSS", () => {
    expect(
      filterInlineStyle("position: fixed; color: blue; width: u\\72 l(x)"),
    ).toBe("color: blue");
  });
});
