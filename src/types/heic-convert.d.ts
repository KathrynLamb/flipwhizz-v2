declare module "heic-convert" {
    export type HeicConvertOptions = {
      buffer: Buffer | Uint8Array;
      format: "JPEG" | "PNG";
      quality?: number; // 0..1
    };
  
    const heicConvert: (opts: HeicConvertOptions) => Promise<Uint8Array>;
    export default heicConvert;
  }
  