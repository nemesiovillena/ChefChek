import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { ServiceUnavailableException } from "@nestjs/common";
import axios from "axios";
import { PexelsImageSearchService } from "./pexels-image-search.service";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("PexelsImageSearchService", () => {
  let service: PexelsImageSearchService;
  let configValues: Record<string, string>;

  beforeEach(async () => {
    configValues = {
      PEXELS_API_KEY: "test-key",
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PexelsImageSearchService,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => configValues[key] },
        },
      ],
    }).compile();

    service = module.get<PexelsImageSearchService>(PexelsImageSearchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("maps a successful Pexels response to ImageSearchResult[]", async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        photos: [
          {
            alt: "Producto X",
            url: "https://www.pexels.com/photo/producto-x-123",
            src: {
              large2x: "https://images.pexels.com/full.jpg",
              medium: "https://images.pexels.com/medium.jpg",
            },
          },
        ],
      },
    });

    const result = await service.search("Producto X 5L");

    expect(result).toEqual([
      {
        url: "https://images.pexels.com/full.jpg",
        thumbnailUrl: "https://images.pexels.com/medium.jpg",
        title: "Producto X",
        sourcePage: "https://www.pexels.com/photo/producto-x-123",
      },
    ]);
  });

  it("returns [] when Pexels responds without photos", async () => {
    mockedAxios.get.mockResolvedValue({ data: {} });

    const result = await service.search("artículo sin resultados");

    expect(result).toEqual([]);
  });

  it("throws ServiceUnavailableException on Pexels 429 (rate limit)", async () => {
    mockedAxios.isAxiosError = jest.fn().mockReturnValue(true) as any;
    mockedAxios.get.mockRejectedValue({
      isAxiosError: true,
      response: { status: 429 },
    });

    await expect(service.search("cualquier cosa")).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it("throws ServiceUnavailableException on Pexels 401 (invalid key)", async () => {
    mockedAxios.isAxiosError = jest.fn().mockReturnValue(true) as any;
    mockedAxios.get.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401 },
    });

    await expect(service.search("cualquier cosa")).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it("throws ServiceUnavailableException when credentials are missing", async () => {
    configValues.PEXELS_API_KEY = "";

    await expect(service.search("cualquier cosa")).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });
});
