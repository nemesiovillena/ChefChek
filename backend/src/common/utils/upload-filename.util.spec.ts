import { generateUploadFilename } from "./upload-filename.util";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

describe("generateUploadFilename", () => {
  it("devuelve UUID + extensión saneada en minúsculas", () => {
    expect(generateUploadFilename("Foto Perfil.JPG")).toMatch(
      /^[0-9a-f-]{36}\.jpg$/,
    );
    expect(generateUploadFilename("albarán.png")).toMatch(
      /^[0-9a-f-]{36}\.png$/,
    );
  });

  it("es único e impredecible entre llamadas", () => {
    const a = generateUploadFilename("x.jpg");
    const b = generateUploadFilename("x.jpg");
    expect(a).not.toBe(b);
    expect(a).toMatch(UUID_RE);
  });

  it("no propaga separadores de ruta ni caracteres raros de la extensión", () => {
    const name = generateUploadFilename("../../evil.pHp%00.jpg");
    expect(name).toMatch(/^[0-9a-f-]{36}\.jpg$/);
    expect(name).not.toContain("/");
    expect(name).not.toContain("..");
  });

  it("tolera nombre sin extensión", () => {
    expect(generateUploadFilename("sinext")).toMatch(/^[0-9a-f-]{36}$/);
    expect(generateUploadFilename("")).toMatch(/^[0-9a-f-]{36}$/);
  });
});
