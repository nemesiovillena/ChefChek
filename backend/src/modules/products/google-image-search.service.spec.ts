import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { ServiceUnavailableException } from "@nestjs/common";
import axios from "axios";
import { GoogleImageSearchService } from "./google-image-search.service";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("GoogleImageSearchService", () => {
  let service: GoogleImageSearchService;
  let configValues: Record<string, string>;

  beforeEach(async () => {
    configValues = {
      GOOGLE_CSE_API_KEY: "test-key",
      GOOGLE_CSE_ENGINE_ID: "test-cx",
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleImageSearchService,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => configValues[key] },
        },
      ],
    }).compile();

    service = module.get<GoogleImageSearchService>(GoogleImageSearchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("maps a successful Google response to ImageSearchResult[]", async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        items: [
          {
            link: "https://tienda.com/foto-full.jpg",
            title: "Producto X",
            image: {
              thumbnailLink: "https://tienda.com/thumb.jpg",
              contextLink: "https://tienda.com/pagina",
            },
          },
        ],
      },
    });

    const result = await service.search("Producto X 5L");

    expect(result).toEqual([
      {
        url: "https://tienda.com/foto-full.jpg",
        thumbnailUrl: "https://tienda.com/thumb.jpg",
        title: "Producto X",
        sourcePage: "https://tienda.com/pagina",
      },
    ]);
  });

  it("returns [] when Google responds without items", async () => {
    mockedAxios.get.mockResolvedValue({ data: {} });

    const result = await service.search("artículo sin resultados");

    expect(result).toEqual([]);
  });

  it("throws ServiceUnavailableException on Google 403 (quota exceeded)", async () => {
    mockedAxios.isAxiosError = jest.fn().mockReturnValue(true) as any;
    mockedAxios.get.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403 },
    });

    await expect(service.search("cualquier cosa")).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it("throws ServiceUnavailableException when credentials are missing", async () => {
    configValues.GOOGLE_CSE_API_KEY = "";
    configValues.GOOGLE_CSE_ENGINE_ID = "";

    await expect(service.search("cualquier cosa")).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });
});
