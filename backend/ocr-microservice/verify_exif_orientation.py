"""
Test de regresión: orientación EXIF de fotos de móvil.

Reproduce el bug del albarán que llegado desde iPhone se leía girado: la cámara
guarda la rotación como tag EXIF (0x0112) y PIL no la aplica al decodificar.

Sin ImageOps.exif_transpose la imagen se procesa en su orientación cruda
(apaisada) y el OCR lee basura. Con exif_transpose se corrige.

Se ejecuta con el intérprete del microservicio:
    venv/bin/python verify_exif_orientation.py
"""
import io
import sys
from PIL import Image, ImageOps, TiffImagePlugin

# El tag 0x0112 (274) es EXIF Orientation. 6 = rotar 90° en sentido horario.
EXIF_ORIENTATION = 0x0112


def build_tagged_image(orientation: int) -> bytes:
    """Crea un JPEG asimétrico (120x40) con un tag EXIF de orientación."""
    # Mitad izquierda roja, mitad derecha azul: la rotación es detectable por
    # muestreo de píxeles, no solo por dimensiones.
    img = Image.new("RGB", (120, 40))
    px = img.load()
    for x in range(120):
        for y in range(40):
            px[x, y] = (220, 0, 0) if x < 60 else (0, 0, 220)

    exif = img.getexif()
    exif[EXIF_ORIENTATION] = orientation

    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif.tobytes())
    return buf.getvalue()


def build_plain_image() -> bytes:
    """JPEG asimétrico sin tag de orientación (como llegan imágenes del ordenador)."""
    img = Image.new("RGB", (120, 40), (0, 160, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def main() -> int:
    failures = []

    def check(name, cond, detail=""):
        if cond:
            print(f"  PASS: {name}")
        else:
            print(f"  FAIL: {name} {detail}")
            failures.append(name)

    print("== Reproduce el bug: foto vertical de móvil (EXIF orientation=6) ==")
    data6 = build_tagged_image(6)

    # Ruta con BUG (sin exif_transpose) — así es como se procesaba antes.
    buggy = Image.open(io.BytesIO(data6))
    print(f"  Sin exif_transpose: size={buggy.size} (apaisada, GIRADA)")
    check("buggy mantiene orientación cruda", buggy.size == (120, 40),
          f"esperaba (120,40), got {buggy.size}")

    # Ruta FIX (con exif_transpose) — lo que hace document_processor ahora.
    fixed = ImageOps.exif_transpose(Image.open(io.BytesIO(data6)))
    print(f"  Con exif_transpose: size={fixed.size} (vertical, CORREGIDA)")
    check("fixed corrige a vertical", fixed.size == (40, 120),
          f"esperaba (40,120), got {fixed.size}")

    print("\n== No-op: imagen ya vertical del ordenador (sin tag EXIF) ==")
    plain = build_plain_image()
    before = Image.open(io.BytesIO(plain))
    after = ImageOps.exif_transpose(Image.open(io.BytesIO(plain)))
    print(f"  size antes={before.size}, después={after.size}")
    check("no-op no altera imágenes verticales", after.size == before.size == (120, 40),
          f"esperaba (120,40), got before={before.size} after={after.size}")

    print("\n== Preservación de .format (necesario para la rama HEIC) ==")
    opened = Image.open(io.BytesIO(data6))
    fmt = opened.format
    transposed = ImageOps.exif_transpose(opened)
    transposed.format = fmt  # lo que hace el fix
    check(".format conservado tras transpose", transposed.format == "JPEG",
          f"esperaba JPEG, got {transposed.format!r}")

    print("\n== Cobertura de todos los tags de orientación (1-8) ==")
    # Geometría EXIF real: los tags que implican rotación de 90° (5,6,7,8)
    # intercambian ancho/alto; el resto (1 normal, 2 espejo-H, 3 180°, 4
    # espejo-V) conservan las dimensiones (aunque mueven el contenido).
    swap_dims = {5, 6, 7, 8}
    for tag in range(1, 9):
        d = build_tagged_image(tag)
        result = ImageOps.exif_transpose(Image.open(io.BytesIO(d)))
        expected = (40, 120) if tag in swap_dims else (120, 40)
        check(f"orientation={tag} dimensiones", result.size == expected,
              f"esperaba {expected}, got {result.size}")

    print("\n== Contenido: orientation=3 (180°) invierte las mitades rojo/azul ==")
    d3 = build_tagged_image(3)
    r3 = ImageOps.exif_transpose(Image.open(io.BytesIO(d3)))
    # Tras 180°, la esquina superior-izquierda (antes roja) pasa a ser azul.
    corner = r3.getpixel((5, 5))
    check("180° mueve el contenido (esquina ahora azul)",
          corner[2] > corner[0], f"got pixel {corner}")

    print()
    if failures:
        print(f"RESULTADO: {len(failures)} chequeo(s) FALLARON: {failures}")
        return 1
    print("RESULTADO: OK — exif_transpose corrige la orientación de fotos de móvil")
    return 0


if __name__ == "__main__":
    sys.exit(main())
