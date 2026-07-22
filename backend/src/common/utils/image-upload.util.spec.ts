import { BadRequestException } from "@nestjs/common";
import { assertAllowedImageType } from "./image-upload.util";

const makeFile = (mimetype: string, originalname = "f"): Express.Multer.File =>
  ({
    mimetype,
    originalname,
    buffer: Buffer.from("x"),
  }) as Express.Multer.File;

describe("assertAllowedImageType", () => {
  it.each([
    "image/jpeg",
    "image/jpg", // non-standard JPEG alias some browsers/Android send
    "image/png",
    "image/webp",
    "image/gif",
  ])("accepts %s", (mimetype) => {
    expect(() => assertAllowedImageType(makeFile(mimetype))).not.toThrow();
  });

  it.each([
    "image/heic",
    "image/heif",
    "text/plain",
    "application/octet-stream",
    "image/svg+xml",
  ])("rejects %s with BadRequestException", (mimetype) => {
    expect(() => assertAllowedImageType(makeFile(mimetype))).toThrow(
      BadRequestException,
    );
  });
});
