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

const GOOGLE_CSE_ENDPOINT = "https://www.googleapis.com/customsearch/v1";
const MAX_RESULTS = 8;

@Injectable()
export class GoogleImageSearchService {
  private readonly logger = new Logger(GoogleImageSearchService.name);

  constructor(private readonly configService: ConfigService) {}

  async search(query: string): Promise<ImageSearchResult[]> {
    const apiKey = this.configService.get<string>("GOOGLE_CSE_API_KEY");
    const engineId = this.configService.get<string>("GOOGLE_CSE_ENGINE_ID");

    if (!apiKey || !engineId) {
      throw new ServiceUnavailableException(
        "Búsqueda de imágenes no configurada (faltan GOOGLE_CSE_API_KEY / GOOGLE_CSE_ENGINE_ID)",
      );
    }

    try {
      const response = await axios.get(GOOGLE_CSE_ENDPOINT, {
        params: {
          key: apiKey,
          cx: engineId,
          q: query,
          searchType: "image",
          safe: "active",
          num: MAX_RESULTS,
        },
        timeout: 10000,
      });

      const items = response.data?.items ?? [];
      return items.map((item: any) => ({
        url: item.link,
        thumbnailUrl: item.image?.thumbnailLink,
        title: item.title,
        sourcePage: item.image?.contextLink,
      }));
    } catch (error) {
      const status = axios.isAxiosError(error)
        ? error.response?.status
        : undefined;
      this.logger.error(
        `Error buscando imágenes en Google (query="${query}"): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      if (status === 403) {
        throw new ServiceUnavailableException(
          "Búsqueda de imágenes no disponible (límite diario de Google alcanzado)",
        );
      }
      throw new ServiceUnavailableException(
        "Búsqueda de imágenes no disponible en este momento",
      );
    }
  }
}
