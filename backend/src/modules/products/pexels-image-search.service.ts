import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

export interface ImageSearchResult {
  url: string;
  thumbnailUrl?: string;
  title?: string;
  sourcePage?: string;
}

const PEXELS_SEARCH_ENDPOINT = "https://api.pexels.com/v1/search";
const MAX_RESULTS = 8;

// Palabras sin valor de búsqueda para nombres de artículos en español (mismo
// criterio: quitarlas mejora la relevancia de resultados en Pexels, que
// indexa mayoritariamente en inglés).
const SPANISH_STOPWORDS = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "un",
  "una",
  "y",
  "o",
  "a",
  "en",
  "con",
  "para",
  "por",
  "como",
]);

function cleanQuery(name: string): string {
  const cleaned = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !SPANISH_STOPWORDS.has(w))
    .slice(0, 4)
    .join(" ");
  return cleaned || name;
}

@Injectable()
export class PexelsImageSearchService {
  private readonly logger = new Logger(PexelsImageSearchService.name);

  constructor(private readonly configService: ConfigService) {}

  async search(query: string): Promise<ImageSearchResult[]> {
    const apiKey = this.configService.get<string>("PEXELS_API_KEY");

    if (!apiKey) {
      throw new ServiceUnavailableException(
        "Búsqueda de imágenes no configurada (falta PEXELS_API_KEY)",
      );
    }

    try {
      const response = await axios.get(PEXELS_SEARCH_ENDPOINT, {
        headers: { Authorization: apiKey },
        params: {
          query: cleanQuery(query),
          per_page: MAX_RESULTS,
          orientation: "landscape",
          size: "medium",
          locale: "es-ES",
        },
        timeout: 10000,
      });

      const photos = response.data?.photos ?? [];
      return photos.map((photo: any) => ({
        url: photo.src?.large2x ?? photo.src?.landscape,
        thumbnailUrl: photo.src?.medium,
        title: photo.alt,
        sourcePage: photo.url,
      }));
    } catch (error) {
      const status = axios.isAxiosError(error)
        ? error.response?.status
        : undefined;
      this.logger.error(
        `Error buscando imágenes en Pexels (query="${query}"): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      if (status === 429) {
        throw new ServiceUnavailableException(
          "Búsqueda de imágenes no disponible (límite de Pexels alcanzado)",
        );
      }
      if (status === 401) {
        throw new ServiceUnavailableException(
          "Búsqueda de imágenes no disponible (clave de Pexels inválida)",
        );
      }
      throw new ServiceUnavailableException(
        "Búsqueda de imágenes no disponible en este momento",
      );
    }
  }
}
