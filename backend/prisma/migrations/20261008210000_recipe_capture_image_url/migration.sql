-- Foto del plato de la captura (de la web o la propia foto subida), ya subida
-- a nuestro almacenamiento. Se copia a la receta al pasarla a Recetas.
ALTER TABLE "recipe_captures" ADD COLUMN "imageUrl" TEXT;
