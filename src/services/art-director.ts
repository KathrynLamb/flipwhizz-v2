// src/services/art-director.ts

interface SceneContext {
    stylePrompt: string;      // e.g. "Watercolor, soft pastel colors, whimsical"
    characterDescription: string; // e.g. "A 5yo boy named Leo with curly hair"
    locationDescription: string;  // e.g. "A magical forest with glowing mushrooms"
    pageAction: string;       // e.g. "Leo is chasing a blue butterfly"
  }
  
  export class ArtDirector {
    static composePrompt(ctx: SceneContext): string {
      // We front-load the style to ensure the AI prioritizes the aesthetic
      return `
        ${ctx.stylePrompt}.
        Character: ${ctx.characterDescription}.
        Setting: ${ctx.locationDescription}.
        Action: ${ctx.pageAction}.
        
        Keep the character consistent. High detail, 8k resolution, cinematic lighting.
        Negative prompt: blurry, deformed hands, extra limbs, text, watermark, bad anatomy.
      `.trim();
    }
  }