import { ConfigService } from "@nestjs/config";
import { BunnyStorageService } from "./bunny-storage.service";

function makeConfig(env: Record<string, string | undefined>): ConfigService {
  return { get: (k: string) => env[k] } as unknown as ConfigService;
}

const FULL_ENV = {
  BUNNY_STORAGE_ZONE: "chefchek",
  BUNNY_STORAGE_PASSWORD: "img-pass",
  BUNNY_CDN_URL: "https://chefchek.b-cdn.net/",
  BUNNY_BACKUP_STORAGE_ZONE: "chefchek-backups",
  BUNNY_BACKUP_STORAGE_PASSWORD: "bk-pass",
};

describe("BunnyStorageService", () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.NODE_ENV;
  });

  it("reports zones disabled when env is missing", () => {
    const svc = new BunnyStorageService(makeConfig({}));
    expect(svc.imagesEnabled).toBe(false);
    expect(svc.backupsEnabled).toBe(false);
  });

  it("reports zones enabled with full env", () => {
    const svc = new BunnyStorageService(makeConfig(FULL_ENV));
    expect(svc.imagesEnabled).toBe(true);
    expect(svc.backupsEnabled).toBe(true);
  });

  it("throws on init in production when unconfigured", () => {
    process.env.NODE_ENV = "production";
    const svc = new BunnyStorageService(makeConfig({}));
    expect(() => svc.onModuleInit()).toThrow(/Bunny\.net no configurado/);
  });

  it("does not throw on init in dev when unconfigured", () => {
    const svc = new BunnyStorageService(makeConfig({}));
    expect(() => svc.onModuleInit()).not.toThrow();
  });

  it("uploadImage PUTs to the storage API and returns the CDN URL", async () => {
    const svc = new BunnyStorageService(makeConfig(FULL_ENV));
    const url = await svc.uploadImage(
      "uploads/users/abc.jpg",
      Buffer.from("x"),
      "image/jpeg",
    );
    expect(url).toBe("https://chefchek.b-cdn.net/uploads/users/abc.jpg");
    const [reqUrl, init] = fetchMock.mock.calls[0];
    expect(reqUrl).toBe(
      "https://storage.bunnycdn.com/chefchek/uploads/users/abc.jpg",
    );
    expect(init.method).toBe("PUT");
    expect(init.headers.AccessKey).toBe("img-pass");
  });

  it("uploadImage throws when the API responds non-2xx", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });
    const svc = new BunnyStorageService(makeConfig(FULL_ENV));
    await expect(
      svc.uploadImage("uploads/users/a.jpg", Buffer.from("x"), "image/jpeg"),
    ).rejects.toThrow(/401/);
  });

  it("sanitizes path traversal in keys", async () => {
    const svc = new BunnyStorageService(makeConfig(FULL_ENV));
    await svc.uploadBackup("backups/../../etc/passwd", Buffer.from("x"));
    const [reqUrl] = fetchMock.mock.calls[0];
    expect(reqUrl).not.toContain("..");
    expect(reqUrl).toBe(
      "https://storage.bunnycdn.com/chefchek-backups/backups/etc/passwd",
    );
  });

  it("deleteBackup tolerates a 404 from the API", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    const svc = new BunnyStorageService(makeConfig(FULL_ENV));
    await expect(
      svc.deleteBackup("backups/x/gone.json"),
    ).resolves.toBeUndefined();
  });

  it("openBackupStream returns a Readable for a 200 response", async () => {
    const { Readable } = await import("node:stream");
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: Readable.toWeb(Readable.from(["{}"])),
    });
    const svc = new BunnyStorageService(makeConfig(FULL_ENV));
    const stream = await svc.openBackupStream("backups/x/y.json");
    expect(typeof stream.pipe).toBe("function");
  });
});
