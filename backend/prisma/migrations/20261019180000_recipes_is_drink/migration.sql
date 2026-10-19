-- Recetas de bebida (se listan aparte y se ocultan por rol con `recipes.drinks`)
ALTER TABLE "recipes" ADD COLUMN "isDrink" BOOLEAN NOT NULL DEFAULT false;
