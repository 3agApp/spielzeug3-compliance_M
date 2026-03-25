/**
 * BunnyDoc API Wrapper
 * Docs: https://support.bunnydoc.com/docs/api/
 *
 * Authentication: Authorization: Api-Key {API_KEY}
 */

const BUNNYDOC_BASE_URL = "https://api.bunnydoc.com/v1";

export interface BunnyDocRecipient {
  role: string;
  name: string;
  email: string;
  accessCode?: string;
}

export interface BunnyDocField {
  apiLabel: string;
  value: string | boolean | number;
  readOnly?: 0 | 1;
}

export interface CreateSignatureRequestParams {
  apiKey: string;
  templateId: string;
  title: string;
  emailMessage?: string;
  signingOrder?: boolean;
  recipients: BunnyDocRecipient[];
  fields?: BunnyDocField[];
}

export interface BunnyDocSignatureResponse {
  error: number;
  message: string;
  envelopeId?: string;
  recipients?: Array<{
    name: string;
    email: string;
    signatureRequestLink?: string;
  }>;
}

export interface BunnyDocWebhookSubscribeParams {
  apiKey: string;
  hookUrl: string;
  webhookEvents?: string[];
}

/**
 * Creates a signature request from a BunnyDoc template.
 */
export async function bunnydocCreateSignatureRequest(
  params: CreateSignatureRequestParams
): Promise<BunnyDocSignatureResponse> {
  const { apiKey, ...body } = params;

  const response = await fetch(`${BUNNYDOC_BASE_URL}/createSignatureRequestFromTemplate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Api-Key ${apiKey}`,
    },
    body: JSON.stringify({
      templateId: body.templateId,
      title: body.title,
      emailMessage: body.emailMessage ?? "",
      signingOrder: body.signingOrder ?? false,
      recipients: body.recipients,
      fields: body.fields ?? [],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`BunnyDoc API error ${response.status}: ${text}`);
  }

  return response.json();
}

/**
 * Subscribes to BunnyDoc webhook events.
 * BunnyDoc will send a POST to hookUrl and expects 'BUNNYDOC API EVENT RECEIVED' in the response.
 */
export async function bunnydocSubscribeWebhook(
  params: BunnyDocWebhookSubscribeParams
): Promise<{ id?: string; error: number; message: string }> {
  const { apiKey, hookUrl, webhookEvents } = params;

  const response = await fetch(`${BUNNYDOC_BASE_URL}/subscribeWebhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Api-Key ${apiKey}`,
    },
    body: JSON.stringify({
      hookUrl,
      webhookEvents: webhookEvents ?? [
        "signatureRequestViewed",
        "signatureRequestSigned",
        "signatureRequestCompleted",
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`BunnyDoc webhook subscribe error ${response.status}: ${text}`);
  }

  return response.json();
}

/**
 * Unsubscribes from a BunnyDoc webhook.
 */
export async function bunnydocUnsubscribeWebhook(
  apiKey: string,
  webhookId: string
): Promise<{ error: number; message: string; identifier?: string }> {
  const response = await fetch(`${BUNNYDOC_BASE_URL}/unsubscribeWebhook/${webhookId}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Api-Key ${apiKey}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`BunnyDoc unsubscribe error ${response.status}: ${text}`);
  }

  return response.json();
}
