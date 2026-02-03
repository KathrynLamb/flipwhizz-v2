export interface Env {
  FLIPWHIZZ_PDFS: R2Bucket;
  API_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Secret',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const apiSecret = request.headers.get('X-API-Secret');
      if (apiSecret !== env.API_SECRET) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const url = new URL(request.url);
      const storyId = url.searchParams.get('storyId');

      if (!storyId) {
        return new Response(
          JSON.stringify({ error: 'Missing storyId parameter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const buffer = await request.arrayBuffer();

      if (buffer.byteLength === 0) {
        return new Response(
          JSON.stringify({ error: 'Empty file' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const timestamp = Date.now();
      const key = `pdfs/${storyId}/final-book-${timestamp}.pdf`;

      console.log(`📤 Uploading PDF: ${key} (${buffer.byteLength} bytes)`);

      await env.FLIPWHIZZ_PDFS.put(key, buffer, {
        httpMetadata: {
          contentType: 'application/pdf',
          cacheControl: 'public, max-age=31536000, immutable',
        },
        customMetadata: {
          storyId,
          uploadedAt: new Date().toISOString(),
        },
      });

      console.log(`✅ PDF uploaded successfully: ${key}`);

      // Get your R2 public domain from Cloudflare dashboard
      
const publicUrl = `https://pub-d71d4ad3e48542da80f1605866a17525.r2.dev/${key}`;
      return new Response(
        JSON.stringify({
          success: true,
          url: publicUrl,
          key,
          size: buffer.byteLength,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (error: any) {
      console.error('❌ Upload error:', error);

      return new Response(
        JSON.stringify({
          error: 'Upload failed',
          message: error.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  },
};
